create or replace function public.connected_devices_page(p_team_id uuid)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare r jsonb;
begin
  if not public.has_team_permission(p_team_id,'devices.view') then raise exception 'Permesso devices.view richiesto'; end if;
  select jsonb_build_object(
    'devices',coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'car_id',d.car_id,'car_name',c.name,'name',d.name,'provider',d.provider,'model',d.model,'serial_number',d.serial_number,'external_device_id',d.external_device_id,'source_type',d.source_type,'status',d.status,'capabilities',d.capabilities,'firmware_version',d.firmware_version,'last_seen_at',d.last_seen_at,'created_at',d.created_at,'default_driver_id',d.default_driver_id,'default_driver_name',case when drv.id is null then null else trim(drv.first_name||' '||drv.last_name) end,'active_key_prefix',(select k.key_prefix from public.connected_device_keys k where k.device_id=d.id and k.revoked_at is null and(k.expires_at is null or k.expires_at>now()) order by k.created_at desc limit 1),'sessions_count',(select count(*) from public.connected_sessions s where s.device_id=d.id),'last_session_at',(select max(s.started_at) from public.connected_sessions s where s.device_id=d.id)) order by d.created_at desc) from public.connected_devices d join public.cars c on c.id=d.car_id and c.team_id=p_team_id left join public.drivers drv on drv.id=d.default_driver_id and drv.team_id=p_team_id where d.team_id=p_team_id),'[]'::jsonb),
    'cars',case when public.has_team_permission(p_team_id,'devices.edit') then coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'chassis_number',c.chassis_number) order by c.name) from public.cars c where c.team_id=p_team_id),'[]'::jsonb) else '[]'::jsonb end,
    'drivers',case when public.has_team_permission(p_team_id,'devices.edit') then coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'first_name',d.first_name,'last_name',d.last_name,'nickname',d.nickname,'racing_number',d.racing_number,'is_active',d.is_active) order by d.last_name,d.first_name) from public.drivers d where d.team_id=p_team_id and d.is_active=true),'[]'::jsonb) else '[]'::jsonb end,
    'circuits',case when public.has_team_permission(p_team_id,'events.view') then coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'city',c.city,'country',c.country,'latitude',c.latitude,'longitude',c.longitude,'detection_radius_m',c.detection_radius_m,'lap_gate_latitude',c.lap_gate_latitude,'lap_gate_longitude',c.lap_gate_longitude,'lap_gate_radius_m',c.lap_gate_radius_m,'min_lap_seconds',c.min_lap_seconds) order by c.name) from public.circuits c where c.team_id=p_team_id),'[]'::jsonb) else '[]'::jsonb end,
    'recent_sessions',coalesce((select jsonb_agg(to_jsonb(x) order by x.started_at desc) from(select s.id,s.device_id,d.name device_name,s.car_id,c.name car_name,s.track_name,s.started_at,s.ended_at,s.engine_seconds,s.track_seconds,s.laps_count,s.best_lap_seconds,s.max_speed,s.max_rpm,s.status,s.activity_type,s.day_group_key,s.gps_latitude,s.gps_longitude,s.track_entry_at,s.track_exit_at,s.detected_circuit_id,s.detection_confidence,ci.name detected_circuit_name,s.reconciliation_status,s.reconciliation_message,s.reconciled_at,s.event_id,e.name event_name,s.event_session_id,s.event_car_turn_id,t.driver_id,case when drv.id is null then null else trim(drv.first_name||' '||drv.last_name) end driver_name from public.connected_sessions s join public.connected_devices d on d.id=s.device_id join public.cars c on c.id=s.car_id left join public.circuits ci on ci.id=s.detected_circuit_id left join public.events e on e.id=s.event_id left join public.event_car_turns t on t.id=s.event_car_turn_id left join public.drivers drv on drv.id=t.driver_id where s.team_id=p_team_id order by s.started_at desc limit 20)x),'[]'::jsonb),
    'day_summaries',coalesce((select jsonb_agg(to_jsonb(ds) order by ds.day_date desc,ds.event_name) from (
      select (min(s.started_at) at time zone 'Europe/Rome')::date as day_date,
             s.event_id,
             e.name as event_name,
             s.detected_circuit_id,
             ci.name as circuit_name,
             count(*)::int as turns_count,
             sum(s.laps_count)::int as laps_count,
             sum(s.track_seconds) as track_seconds,
             sum(s.engine_seconds) as engine_seconds,
             min(s.best_lap_seconds) filter (where s.best_lap_seconds is not null) as best_lap_seconds,
             max(s.max_speed) as max_speed,
             min(s.day_group_key) as day_group_key
        from public.connected_sessions s
        left join public.events e on e.id=s.event_id
        left join public.circuits ci on ci.id=s.detected_circuit_id
       where s.team_id=p_team_id and s.activity_type='track' and s.reconciliation_status='reconciled' and s.started_at>=now()-interval '30 days' and s.event_id is not null
       group by s.event_id,e.name,s.detected_circuit_id,ci.name
       order by day_date desc
       limit 12
    ) ds),'[]'::jsonb),
    'stats',jsonb_build_object('total',(select count(*) from public.connected_devices where team_id=p_team_id),'active',(select count(*) from public.connected_devices where team_id=p_team_id and status='active'),'online_15m',(select count(*) from public.connected_devices where team_id=p_team_id and status='active' and last_seen_at>=now()-interval '15 minutes'),'sessions_30d',(select count(*) from public.connected_sessions where team_id=p_team_id and started_at>=now()-interval '30 days'),'track_30d',(select count(*) from public.connected_sessions where team_id=p_team_id and activity_type='track' and started_at>=now()-interval '30 days'),'engine_only_30d',(select count(*) from public.connected_sessions where team_id=p_team_id and activity_type='engine_only' and started_at>=now()-interval '30 days'),'needs_review',(select count(*) from public.connected_sessions where team_id=p_team_id and reconciliation_status in ('needs_review','failed')))
  ) into r;
  return r;
end;
$function$;
