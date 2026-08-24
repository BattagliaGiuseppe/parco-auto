create or replace function public.connected_devices_page(p_team_id uuid) returns jsonb language plpgsql stable security definer set search_path='public' as $$
declare r jsonb;
begin
 if not public.has_team_permission(p_team_id,'devices.view') then raise exception 'Permesso devices.view richiesto'; end if;
 select jsonb_build_object(
  'devices',coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'car_id',d.car_id,'car_name',c.name,'name',d.name,'provider',d.provider,'model',d.model,'serial_number',d.serial_number,'external_device_id',d.external_device_id,'source_type',d.source_type,'status',d.status,'capabilities',d.capabilities,'firmware_version',d.firmware_version,'last_seen_at',d.last_seen_at,'created_at',d.created_at,'active_key_prefix',(select k.key_prefix from public.connected_device_keys k where k.device_id=d.id and k.revoked_at is null and(k.expires_at is null or k.expires_at>now()) order by k.created_at desc limit 1),'sessions_count',(select count(*) from public.connected_sessions s where s.device_id=d.id),'last_session_at',(select max(s.started_at) from public.connected_sessions s where s.device_id=d.id)) order by d.created_at desc) from public.connected_devices d join public.cars c on c.id=d.car_id and c.team_id=p_team_id where d.team_id=p_team_id),'[]'::jsonb),
  'cars',case when public.has_team_permission(p_team_id,'devices.edit') then coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'chassis_number',c.chassis_number) order by c.name) from public.cars c where c.team_id=p_team_id),'[]'::jsonb) else '[]'::jsonb end,
  'recent_sessions',coalesce((select jsonb_agg(to_jsonb(x) order by x.started_at desc) from(select s.id,s.device_id,d.name device_name,s.car_id,c.name car_name,s.track_name,s.started_at,s.ended_at,s.engine_seconds,s.track_seconds,s.laps_count,s.best_lap_seconds,s.max_speed,s.max_rpm,s.status from public.connected_sessions s join public.connected_devices d on d.id=s.device_id join public.cars c on c.id=s.car_id where s.team_id=p_team_id order by s.started_at desc limit 20)x),'[]'::jsonb),
  'stats',jsonb_build_object('total',(select count(*) from public.connected_devices where team_id=p_team_id),'active',(select count(*) from public.connected_devices where team_id=p_team_id and status='active'),'online_15m',(select count(*) from public.connected_devices where team_id=p_team_id and status='active' and last_seen_at>=now()-interval '15 minutes'),'sessions_30d',(select count(*) from public.connected_sessions where team_id=p_team_id and started_at>=now()-interval '30 days'))
 ) into r;
 return r;
end$$;
revoke all on function public.connected_devices_page(uuid) from public,anon;
grant execute on function public.connected_devices_page(uuid) to authenticated,service_role;
