alter table public.connected_devices
  add column if not exists default_driver_id uuid null references public.drivers(id) on delete set null;

create index if not exists connected_devices_default_driver_idx
  on public.connected_devices(team_id, default_driver_id)
  where default_driver_id is not null;

create or replace function public.set_connected_device_default_driver(
  p_team_id uuid,
  p_device_id uuid,
  p_driver_id uuid
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  d public.connected_devices%rowtype;
begin
  if not public.has_team_permission(p_team_id,'devices.edit') then
    raise exception 'Permesso devices.edit richiesto';
  end if;

  select * into d from public.connected_devices
  where id=p_device_id and team_id=p_team_id;
  if not found then raise exception 'Dispositivo non trovato'; end if;

  if p_driver_id is not null and not exists(
    select 1 from public.drivers
    where id=p_driver_id and team_id=p_team_id and is_active=true
  ) then
    raise exception 'Pilota non valido o non attivo per il team';
  end if;

  update public.connected_devices
  set default_driver_id=p_driver_id, updated_at=now()
  where id=p_device_id and team_id=p_team_id;

  return jsonb_build_object('device_id',p_device_id,'default_driver_id',p_driver_id);
end;
$function$;

revoke all on function public.set_connected_device_default_driver(uuid,uuid,uuid) from public, anon;
grant execute on function public.set_connected_device_default_driver(uuid,uuid,uuid) to authenticated;

create or replace function public.apply_connected_default_driver_to_turn()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_driver_id uuid;
begin
  if new.connected_session_id is not null and new.driver_id is null then
    select d.default_driver_id into v_driver_id
    from public.connected_sessions s
    join public.connected_devices d on d.id=s.device_id and d.team_id=s.team_id
    where s.id=new.connected_session_id and s.team_id=new.team_id;

    if v_driver_id is not null then
      new.driver_id:=v_driver_id;
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_connected_default_driver on public.event_car_turns;
create trigger trg_connected_default_driver
before insert or update of connected_session_id, driver_id on public.event_car_turns
for each row execute function public.apply_connected_default_driver_to_turn();

create or replace function public.connected_devices_page(p_team_id uuid)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare r jsonb;
begin
  if not public.has_team_permission(p_team_id,'devices.view') then
    raise exception 'Permesso devices.view richiesto';
  end if;

  select jsonb_build_object(
    'devices',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',d.id,'car_id',d.car_id,'car_name',c.name,'name',d.name,'provider',d.provider,
        'model',d.model,'serial_number',d.serial_number,'external_device_id',d.external_device_id,
        'source_type',d.source_type,'status',d.status,'capabilities',d.capabilities,
        'firmware_version',d.firmware_version,'last_seen_at',d.last_seen_at,'created_at',d.created_at,
        'default_driver_id',d.default_driver_id,
        'default_driver_name',case when drv.id is null then null else trim(drv.first_name||' '||drv.last_name) end,
        'active_key_prefix',(select k.key_prefix from public.connected_device_keys k where k.device_id=d.id and k.revoked_at is null and(k.expires_at is null or k.expires_at>now()) order by k.created_at desc limit 1),
        'sessions_count',(select count(*) from public.connected_sessions s where s.device_id=d.id),
        'last_session_at',(select max(s.started_at) from public.connected_sessions s where s.device_id=d.id)
      ) order by d.created_at desc)
      from public.connected_devices d
      join public.cars c on c.id=d.car_id and c.team_id=p_team_id
      left join public.drivers drv on drv.id=d.default_driver_id and drv.team_id=p_team_id
      where d.team_id=p_team_id
    ),'[]'::jsonb),
    'cars',case when public.has_team_permission(p_team_id,'devices.edit') then coalesce((
      select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'chassis_number',c.chassis_number) order by c.name)
      from public.cars c where c.team_id=p_team_id
    ),'[]'::jsonb) else '[]'::jsonb end,
    'drivers',case when public.has_team_permission(p_team_id,'devices.edit') then coalesce((
      select jsonb_agg(jsonb_build_object('id',d.id,'first_name',d.first_name,'last_name',d.last_name,'nickname',d.nickname,'racing_number',d.racing_number,'is_active',d.is_active) order by d.last_name,d.first_name)
      from public.drivers d where d.team_id=p_team_id and d.is_active=true
    ),'[]'::jsonb) else '[]'::jsonb end,
    'recent_sessions',coalesce((
      select jsonb_agg(to_jsonb(x) order by x.started_at desc)
      from(
        select s.id,s.device_id,d.name device_name,s.car_id,c.name car_name,s.track_name,s.started_at,s.ended_at,
          s.engine_seconds,s.track_seconds,s.laps_count,s.best_lap_seconds,s.max_speed,s.max_rpm,s.status,
          s.reconciliation_status,s.reconciliation_message,s.reconciled_at,s.event_id,e.name event_name,
          s.event_session_id,s.event_car_turn_id,t.driver_id,
          case when drv.id is null then null else trim(drv.first_name||' '||drv.last_name) end driver_name
        from public.connected_sessions s
        join public.connected_devices d on d.id=s.device_id
        join public.cars c on c.id=s.car_id
        left join public.events e on e.id=s.event_id
        left join public.event_car_turns t on t.id=s.event_car_turn_id
        left join public.drivers drv on drv.id=t.driver_id
        where s.team_id=p_team_id
        order by s.started_at desc limit 20
      )x
    ),'[]'::jsonb),
    'stats',jsonb_build_object(
      'total',(select count(*) from public.connected_devices where team_id=p_team_id),
      'active',(select count(*) from public.connected_devices where team_id=p_team_id and status='active'),
      'online_15m',(select count(*) from public.connected_devices where team_id=p_team_id and status='active' and last_seen_at>=now()-interval '15 minutes'),
      'sessions_30d',(select count(*) from public.connected_sessions where team_id=p_team_id and started_at>=now()-interval '30 days'),
      'needs_review',(select count(*) from public.connected_sessions where team_id=p_team_id and reconciliation_status in ('needs_review','failed'))
    )
  ) into r;
  return r;
end;
$function$;
