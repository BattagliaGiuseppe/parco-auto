create or replace function public.get_connected_device_circuits(p_device_key text)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public','extensions'
as $function$
declare
  k public.connected_device_keys%rowtype;
  d public.connected_devices%rowtype;
  v_hash text;
begin
  if coalesce(char_length(p_device_key),0) < 20 then raise exception 'Chiave dispositivo non valida'; end if;
  v_hash := encode(digest(p_device_key,'sha256'),'hex');
  select * into k from public.connected_device_keys
    where key_hash=v_hash and revoked_at is null and (expires_at is null or expires_at>now())
    order by created_at desc limit 1;
  if not found then raise exception 'Credenziale dispositivo non valida o revocata'; end if;
  select * into d from public.connected_devices
    where id=k.device_id and team_id=k.team_id and status='active';
  if not found then raise exception 'Dispositivo non attivo'; end if;

  return jsonb_build_object(
    'device_id', d.id,
    'car_id', d.car_id,
    'circuits', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id,
        'name', c.name,
        'city', c.city,
        'country', c.country,
        'latitude', c.latitude,
        'longitude', c.longitude,
        'detection_radius_m', c.detection_radius_m,
        'lap_gate_latitude', c.lap_gate_latitude,
        'lap_gate_longitude', c.lap_gate_longitude,
        'lap_gate_radius_m', c.lap_gate_radius_m,
        'min_lap_seconds', c.min_lap_seconds,
        'lap_gate_configured', (c.lap_gate_latitude is not null and c.lap_gate_longitude is not null and c.lap_gate_radius_m is not null),
        'has_reference', exists(
          select 1 from public.connected_reference_laps r
          where r.team_id=d.team_id and r.circuit_id=c.id and r.is_active
            and ((d.default_driver_id is not null and r.driver_id=d.default_driver_id)
              or (d.default_driver_id is null and r.driver_id is null and r.car_id=d.car_id))
        )
      ) order by c.name)
      from public.circuits c where c.team_id=d.team_id
    ), '[]'::jsonb)
  );
end;
$function$;

revoke all on function public.get_connected_device_circuits(text) from public;
grant execute on function public.get_connected_device_circuits(text) to anon, authenticated, service_role;

create or replace function public.apply_connected_session_hours(p_session_id uuid)
returns numeric
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  s public.connected_sessions%rowtype;
  d public.connected_devices%rowtype;
  h numeric;
  v_estimated boolean := false;
  v_hours_basis text := 'engine_signal';
begin
  select * into s from public.connected_sessions where id=p_session_id for update;
  if not found then raise exception 'Sessione connessa non trovata'; end if;

  select * into d from public.connected_devices where id=s.device_id and team_id=s.team_id;
  if found and d.acquisition_mode='smartphone' then
    v_estimated := true;
    v_hours_basis := 'gps_activity_estimate';
  end if;

  h:=greatest(0,coalesce(s.engine_seconds,0))/3600.0;
  if h=0 then return 0; end if;

  if exists(select 1 from public.connected_hour_ledger where connected_session_id=p_session_id and reversed_at is null) then return 0; end if;

  if v_estimated then
    update public.connected_sessions
       set metadata=coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
         'engine_time_estimated',true,
         'hours_basis',v_hours_basis,
         'acquisition_mode','smartphone'
       )
     where id=s.id;
  end if;

  update public.cars c
     set hours=greatest(0,coalesce(c.hours,0)+h),
         total_hours=greatest(0,coalesce(c.total_hours,0)+h)
   where c.id=s.car_id and c.team_id=s.team_id;

  with tm as(
    select distinct cc.id,cc.component_id
      from public.car_components cc
     where cc.team_id=s.team_id
       and cc.car_id=s.car_id
       and coalesce(cc.mounted_at,cc.installed_at,cc.created_at,'-infinity'::timestamptz)<=s.started_at
       and (cc.removed_at is null or cc.removed_at>s.started_at)
  ),
  um as(
    update public.car_components cc
       set hours_used=greatest(0,coalesce(cc.hours_used,0)+h)
      from tm
     where cc.id=tm.id
    returning tm.component_id
  ),
  tc as(
    select distinct component_id from um
    union
    select c.id from public.components c
     where c.team_id=s.team_id and c.car_id=s.car_id and coalesce(c.is_active,true)=true
  )
  update public.components c
     set hours=greatest(0,coalesce(c.hours,0)+h),
         life_hours=greatest(0,coalesce(c.life_hours,0)+h),
         work_hours=greatest(0,coalesce(c.work_hours,0)+h)
   where c.id in(select component_id from tc);

  insert into public.connected_hour_ledger(team_id,connected_session_id,car_id,hours_delta,metadata)
  values(
    s.team_id,
    s.id,
    s.car_id,
    h,
    jsonb_build_object(
      'source','device_ingest',
      'engine_seconds',s.engine_seconds,
      'hours_basis',v_hours_basis,
      'engine_time_estimated',v_estimated,
      'acquisition_mode',coalesce(d.acquisition_mode,'unknown')
    )
  );
  return h;
end;
$function$;
