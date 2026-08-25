alter table public.circuits
  add column if not exists lap_gate_latitude numeric,
  add column if not exists lap_gate_longitude numeric,
  add column if not exists lap_gate_radius_m integer,
  add column if not exists min_lap_seconds integer not null default 20;

do $$ begin
  alter table public.circuits add constraint circuits_lap_gate_latitude_check check (lap_gate_latitude is null or lap_gate_latitude between -90 and 90);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.circuits add constraint circuits_lap_gate_longitude_check check (lap_gate_longitude is null or lap_gate_longitude between -180 and 180);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.circuits add constraint circuits_lap_gate_radius_check check (lap_gate_radius_m is null or lap_gate_radius_m between 5 and 250);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.circuits add constraint circuits_min_lap_seconds_check check (min_lap_seconds between 5 and 1800);
exception when duplicate_object then null; end $$;

create table if not exists public.connected_stream_lap_marks (
  id uuid primary key default gen_random_uuid(),
  stream_window_id uuid not null references public.connected_stream_windows(id) on delete cascade,
  stream_segment_id uuid not null references public.connected_stream_segments(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  device_id uuid not null references public.connected_devices(id) on delete cascade,
  detected_circuit_id uuid not null references public.circuits(id) on delete cascade,
  crossing_index integer not null check (crossing_index >= 1),
  crossing_at timestamptz not null,
  lap_number integer,
  lap_time_seconds numeric,
  created_at timestamptz not null default now(),
  unique(stream_segment_id, crossing_index),
  check (lap_number is null or lap_number >= 1),
  check (lap_time_seconds is null or lap_time_seconds > 0)
);

create index if not exists connected_stream_lap_marks_window_idx on public.connected_stream_lap_marks(stream_window_id, stream_segment_id, crossing_index);

alter table public.connected_stream_lap_marks enable row level security;
revoke all on public.connected_stream_lap_marks from anon, authenticated;
grant select on public.connected_stream_lap_marks to authenticated;
drop policy if exists connected_stream_lap_marks_select on public.connected_stream_lap_marks;
create policy connected_stream_lap_marks_select on public.connected_stream_lap_marks for select to authenticated using (public.has_team_permission(team_id,'devices.view'));

create or replace function public.set_circuit_lap_gate(
  p_team_id uuid,
  p_circuit_id uuid,
  p_latitude numeric,
  p_longitude numeric,
  p_radius_m integer,
  p_min_lap_seconds integer default 20
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare c public.circuits%rowtype;
begin
  if not public.has_team_permission(p_team_id,'events.edit') then raise exception 'Permesso events.edit richiesto'; end if;
  select * into c from public.circuits where id=p_circuit_id and team_id=p_team_id;
  if not found then raise exception 'Circuito non trovato'; end if;

  if p_latitude is null and p_longitude is null and p_radius_m is null then
    update public.circuits
      set lap_gate_latitude=null, lap_gate_longitude=null, lap_gate_radius_m=null, min_lap_seconds=greatest(5,least(coalesce(p_min_lap_seconds,20),1800))
      where id=p_circuit_id and team_id=p_team_id
      returning * into c;
  else
    if p_latitude is null or p_longitude is null or p_radius_m is null then raise exception 'Latitudine, longitudine e raggio lap gate sono obbligatori insieme'; end if;
    if p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then raise exception 'Coordinate lap gate non valide'; end if;
    if p_radius_m not between 5 and 250 then raise exception 'Raggio lap gate deve essere tra 5 e 250 m'; end if;
    if coalesce(p_min_lap_seconds,20) not between 5 and 1800 then raise exception 'Tempo minimo giro non valido'; end if;
    update public.circuits
      set lap_gate_latitude=p_latitude, lap_gate_longitude=p_longitude, lap_gate_radius_m=p_radius_m, min_lap_seconds=p_min_lap_seconds
      where id=p_circuit_id and team_id=p_team_id
      returning * into c;
  end if;

  return jsonb_build_object('id',c.id,'lap_gate_latitude',c.lap_gate_latitude,'lap_gate_longitude',c.lap_gate_longitude,'lap_gate_radius_m',c.lap_gate_radius_m,'min_lap_seconds',c.min_lap_seconds);
end;
$$;

revoke all on function public.set_circuit_lap_gate(uuid,uuid,numeric,numeric,integer,integer) from public;
grant execute on function public.set_circuit_lap_gate(uuid,uuid,numeric,numeric,integer,integer) to authenticated;
