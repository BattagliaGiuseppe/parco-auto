create or replace function public.set_connected_session_driver(p_team_id uuid, p_session_id uuid, p_driver_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  s public.connected_sessions%rowtype;
  d public.drivers%rowtype;
begin
  if not public.has_team_permission(p_team_id,'devices.edit') or not public.has_team_permission(p_team_id,'events.edit') then
    raise exception 'Permessi devices.edit ed events.edit richiesti';
  end if;
  select * into s from public.connected_sessions where id=p_session_id and team_id=p_team_id;
  if not found then raise exception 'Sessione connessa non trovata'; end if;
  if s.event_car_turn_id is null or s.reconciliation_status <> 'reconciled' then
    raise exception 'La sessione deve essere riconciliata prima di assegnare il pilota';
  end if;
  if p_driver_id is not null then
    select * into d from public.drivers where id=p_driver_id and team_id=p_team_id;
    if not found then raise exception 'Pilota non valido per il team'; end if;
  end if;
  update public.event_car_turns set driver_id=p_driver_id where id=s.event_car_turn_id and team_id=p_team_id;
  return jsonb_build_object('session_id',s.id,'turn_id',s.event_car_turn_id,'driver_id',p_driver_id);
end;
$function$;

revoke all on function public.set_connected_session_driver(uuid,uuid,uuid) from public, anon;
grant execute on function public.set_connected_session_driver(uuid,uuid,uuid) to authenticated, service_role;

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
    'devices',coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'car_id',d.car_id,'car_name',c.name,'name',d.name,'provider',d.provider,'model',d.model,'serial_number',d.serial_number,'external_device_id',d.external_device_id,'source_type',d.source_type,'status',d.status,'capabilities',d.capabilities,'firmware_version',d.firmware_version,'last_seen_at',d.last_seen_at,'created_at',d.created_at,'active_key_prefix',(select k.key_prefix from public.connected_device_keys k where k.device_id=d.id and k.revoked_at is null and(k.expires_at is null or k.expires_at>now()) order by k.created_at desc limit 1),'sessions_count',(select count(*) from public.connected_sessions s where s.device_id=d.id),'last_session_at',(select max(s.started_at) from public.connected_sessions s where s.device_id=d.id)) order by d.created_at desc) from public.connected_devices d join public.cars c on c.id=d.car_id and c.team_id=p_team_id where d.team_id=p_team_id),'[]'::jsonb),
    'cars',case when public.has_team_permission(p_team_id,'devices.edit') then coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'chassis_number',c.chassis_number) order by c.name) from public.cars c where c.team_id=p_team_id),'[]'::jsonb) else '[]'::jsonb end,
    'drivers',case when public.has_team_permission(p_team_id,'devices.edit') and public.has_team_permission(p_team_id,'drivers.view') then coalesce((select jsonb_agg(jsonb_build_object('id',dr.id,'first_name',dr.first_name,'last_name',dr.last_name,'nickname',dr.nickname,'racing_number',dr.racing_number,'is_active',dr.is_active) order by dr.last_name,dr.first_name) from public.drivers dr where dr.team_id=p_team_id and dr.is_active=true),'[]'::jsonb) else '[]'::jsonb end,
    'recent_sessions',coalesce((select jsonb_agg(to_jsonb(x) order by x.started_at desc) from(select s.id,s.device_id,d.name device_name,s.car_id,c.name car_name,s.track_name,s.started_at,s.ended_at,s.engine_seconds,s.track_seconds,s.laps_count,s.best_lap_seconds,s.max_speed,s.max_rpm,s.status,s.reconciliation_status,s.reconciliation_message,s.reconciled_at,s.event_id,e.name event_name,s.event_session_id,s.event_car_turn_id,t.driver_id,case when dr.id is null then null else concat_ws(' ',dr.first_name,dr.last_name) end driver_name from public.connected_sessions s join public.connected_devices d on d.id=s.device_id join public.cars c on c.id=s.car_id left join public.events e on e.id=s.event_id left join public.event_car_turns t on t.id=s.event_car_turn_id left join public.drivers dr on dr.id=t.driver_id where s.team_id=p_team_id order by s.started_at desc limit 20)x),'[]'::jsonb),
    'stats',jsonb_build_object('total',(select count(*) from public.connected_devices where team_id=p_team_id),'active',(select count(*) from public.connected_devices where team_id=p_team_id and status='active'),'online_15m',(select count(*) from public.connected_devices where team_id=p_team_id and status='active' and last_seen_at>=now()-interval '15 minutes'),'sessions_30d',(select count(*) from public.connected_sessions where team_id=p_team_id and started_at>=now()-interval '30 days'),'needs_review',(select count(*) from public.connected_sessions where team_id=p_team_id and reconciliation_status in ('needs_review','failed')))
  ) into r;
  return r;
end;
$function$;
