create table if not exists public.connected_reference_laps (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  circuit_id uuid not null references public.circuits(id) on delete cascade,
  device_id uuid references public.connected_devices(id) on delete set null,
  car_id uuid references public.cars(id) on delete set null,
  driver_id uuid references public.drivers(id) on delete set null,
  source_session_id uuid references public.connected_sessions(id) on delete set null,
  source_lap_id uuid references public.connected_session_laps(id) on delete set null,
  lap_time_seconds numeric not null check (lap_time_seconds > 0 and lap_time_seconds <= 1800),
  points jsonb not null default '[]'::jsonb,
  points_count integer not null default 0 check (points_count between 2 and 400),
  profile_version integer not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_connected_reference_laps_team_circuit
  on public.connected_reference_laps(team_id,circuit_id,is_active);
create unique index if not exists uq_connected_reference_laps_driver_active
  on public.connected_reference_laps(team_id,circuit_id,driver_id)
  where is_active and driver_id is not null;
create unique index if not exists uq_connected_reference_laps_car_active
  on public.connected_reference_laps(team_id,circuit_id,car_id)
  where is_active and driver_id is null and car_id is not null;

alter table public.connected_reference_laps enable row level security;

drop policy if exists connected_reference_laps_select on public.connected_reference_laps;
create policy connected_reference_laps_select on public.connected_reference_laps
for select to authenticated
using (public.has_team_permission(team_id,'devices.view'));

drop policy if exists connected_reference_laps_write on public.connected_reference_laps;
create policy connected_reference_laps_write on public.connected_reference_laps
for all to authenticated
using (public.has_team_permission(team_id,'devices.edit'))
with check (public.has_team_permission(team_id,'devices.edit'));

create or replace function public.publish_connected_reference_lap(
  p_device_key text,
  p_circuit_id uuid,
  p_lap_time_seconds numeric,
  p_points jsonb,
  p_source_session_id uuid default null,
  p_source_lap_id uuid default null,
  p_force boolean default false
) returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  k public.connected_device_keys%rowtype;
  d public.connected_devices%rowtype;
  existing public.connected_reference_laps%rowtype;
  saved public.connected_reference_laps%rowtype;
  v_hash text;
  v_count integer;
  rec record;
  prev_elapsed numeric := -1;
  v_elapsed numeric;
  v_lat numeric;
  v_lon numeric;
begin
  if coalesce(char_length(p_device_key),0) < 20 then raise exception 'Chiave dispositivo non valida'; end if;
  if p_circuit_id is null or not exists(select 1 from public.circuits c where c.id=p_circuit_id) then raise exception 'Circuito non valido'; end if;
  if p_lap_time_seconds is null or p_lap_time_seconds < 5 or p_lap_time_seconds > 1800 then raise exception 'Tempo giro non valido'; end if;
  if p_points is null or jsonb_typeof(p_points) <> 'array' then raise exception 'points deve essere un array'; end if;
  v_count := jsonb_array_length(p_points);
  if v_count < 2 or v_count > 400 then raise exception 'Profilo riferimento deve contenere tra 2 e 400 punti'; end if;

  v_hash := encode(digest(p_device_key,'sha256'),'hex');
  select * into k from public.connected_device_keys
  where key_hash=v_hash and revoked_at is null and (expires_at is null or expires_at>now())
  order by created_at desc limit 1;
  if not found then raise exception 'Credenziale dispositivo non valida o revocata'; end if;

  select * into d from public.connected_devices
  where id=k.device_id and team_id=k.team_id and status='active';
  if not found then raise exception 'Dispositivo non attivo'; end if;
  if not exists(select 1 from public.circuits c where c.id=p_circuit_id and c.team_id=d.team_id) then
    raise exception 'Circuito non valido per il team';
  end if;

  if p_source_session_id is not null and not exists(
    select 1 from public.connected_sessions s
    where s.id=p_source_session_id and s.team_id=d.team_id and s.car_id=d.car_id and s.detected_circuit_id=p_circuit_id
  ) then raise exception 'Sessione sorgente non valida'; end if;

  if p_source_lap_id is not null and not exists(
    select 1 from public.connected_session_laps l
    join public.connected_sessions s on s.id=l.connected_session_id
    where l.id=p_source_lap_id and l.team_id=d.team_id and s.car_id=d.car_id and s.detected_circuit_id=p_circuit_id
  ) then raise exception 'Giro sorgente non valido'; end if;

  for rec in select value,ord from jsonb_array_elements(p_points) with ordinality a(value,ord) order by ord loop
    begin
      v_lat := (rec.value->>'lat')::numeric;
      v_lon := (rec.value->>'lon')::numeric;
      v_elapsed := (rec.value->>'elapsed_s')::numeric;
    exception when others then
      raise exception 'Punto riferimento non valido in posizione %',rec.ord;
    end;
    if v_lat not between -90 and 90 or v_lon not between -180 and 180 then
      raise exception 'Coordinate riferimento non valide in posizione %',rec.ord;
    end if;
    if v_elapsed < 0 or v_elapsed < prev_elapsed or v_elapsed > p_lap_time_seconds + 2 then
      raise exception 'Tempo riferimento non valido in posizione %',rec.ord;
    end if;
    prev_elapsed := v_elapsed;
  end loop;

  if d.default_driver_id is not null then
    select * into existing from public.connected_reference_laps r
    where r.team_id=d.team_id and r.circuit_id=p_circuit_id and r.driver_id=d.default_driver_id and r.is_active
    order by r.updated_at desc limit 1 for update;
  else
    select * into existing from public.connected_reference_laps r
    where r.team_id=d.team_id and r.circuit_id=p_circuit_id and r.driver_id is null and r.car_id=d.car_id and r.is_active
    order by r.updated_at desc limit 1 for update;
  end if;

  if existing.id is not null and not p_force and existing.lap_time_seconds <= p_lap_time_seconds then
    return jsonb_build_object(
      'updated',false,'reason','existing_reference_is_faster','reference_id',existing.id,
      'lap_time_seconds',existing.lap_time_seconds,'points_count',existing.points_count
    );
  end if;

  if existing.id is not null then
    update public.connected_reference_laps set
      device_id=d.id, car_id=d.car_id, driver_id=d.default_driver_id,
      source_session_id=p_source_session_id, source_lap_id=p_source_lap_id,
      lap_time_seconds=p_lap_time_seconds, points=p_points, points_count=v_count,
      profile_version=1, is_active=true, updated_at=now()
    where id=existing.id returning * into saved;
  else
    insert into public.connected_reference_laps(
      team_id,circuit_id,device_id,car_id,driver_id,source_session_id,source_lap_id,
      lap_time_seconds,points,points_count
    ) values(
      d.team_id,p_circuit_id,d.id,d.car_id,d.default_driver_id,p_source_session_id,p_source_lap_id,
      p_lap_time_seconds,p_points,v_count
    ) returning * into saved;
  end if;

  update public.connected_device_keys set last_used_at=now() where id=k.id;
  update public.connected_devices set last_seen_at=now() where id=d.id;

  return jsonb_build_object(
    'updated',true,'reference_id',saved.id,'lap_time_seconds',saved.lap_time_seconds,
    'points_count',saved.points_count,'driver_id',saved.driver_id,'car_id',saved.car_id
  );
end;
$$;

create or replace function public.get_connected_reference_lap(p_device_key text, p_circuit_id uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path = public, extensions
as $$
declare
  k public.connected_device_keys%rowtype;
  d public.connected_devices%rowtype;
  r public.connected_reference_laps%rowtype;
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
  if not exists(select 1 from public.circuits c where c.id=p_circuit_id and c.team_id=d.team_id) then
    raise exception 'Circuito non valido per il team';
  end if;

  if d.default_driver_id is not null then
    select * into r from public.connected_reference_laps x
    where x.team_id=d.team_id and x.circuit_id=p_circuit_id and x.driver_id=d.default_driver_id and x.is_active
    order by x.lap_time_seconds asc,x.updated_at desc limit 1;
  end if;

  if r.id is null then
    select * into r from public.connected_reference_laps x
    where x.team_id=d.team_id and x.circuit_id=p_circuit_id and x.driver_id is null and x.car_id=d.car_id and x.is_active
    order by x.lap_time_seconds asc,x.updated_at desc limit 1;
  end if;

  if r.id is null then
    return jsonb_build_object('found',false,'circuit_id',p_circuit_id);
  end if;

  return jsonb_build_object(
    'found',true,'reference_id',r.id,'circuit_id',r.circuit_id,
    'lap_time_seconds',r.lap_time_seconds,'points_count',r.points_count,
    'profile_version',r.profile_version,'driver_id',r.driver_id,'car_id',r.car_id,
    'points',r.points,'updated_at',r.updated_at
  );
end;
$$;

revoke all on function public.publish_connected_reference_lap(text,uuid,numeric,jsonb,uuid,uuid,boolean) from public;
revoke all on function public.get_connected_reference_lap(text,uuid) from public;
grant execute on function public.publish_connected_reference_lap(text,uuid,numeric,jsonb,uuid,uuid,boolean) to anon,authenticated,service_role;
grant execute on function public.get_connected_reference_lap(text,uuid) to anon,authenticated,service_role;
