-- Patch 2 - Turni evento atomici + contatori ore
-- Eseguire una sola volta su Supabase SQL Editor dopo aver aggiornato la repo.
-- Obiettivi:
-- 1) salvare turno base + metriche in un'unica transazione RPC;
-- 2) validare team/evento/mezzo/sessione/pilota prima di scrivere;
-- 3) garantire trigger contatori ore su insert/update/delete dei turni;
-- 4) rendere la cancellazione turno esplicita e team-scoped.

begin;

alter table public.event_car_turns
  add column if not exists recorded_at timestamptz,
  add column if not exists driver_id uuid references public.drivers(id) on delete set null,
  add column if not exists fuel_start_liters numeric,
  add column if not exists fuel_end_liters numeric,
  add column if not exists created_by_team_user_id uuid references public.team_users(id) on delete set null;

alter table public.event_car_turn_metrics
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'event_car_turns_minutes_non_negative'
      and conrelid = 'public.event_car_turns'::regclass
  ) then
    alter table public.event_car_turns
      add constraint event_car_turns_minutes_non_negative check (minutes >= 0) not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'event_car_turns_laps_non_negative'
      and conrelid = 'public.event_car_turns'::regclass
  ) then
    alter table public.event_car_turns
      add constraint event_car_turns_laps_non_negative check (laps >= 0) not valid;
  end if;
end $$;

create or replace function public.apply_turn_hours_delta(
  p_event_car_id uuid,
  p_recorded_at timestamptz,
  p_minutes_delta numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_car_id uuid;
  v_turn_time timestamptz := coalesce(p_recorded_at, now());
  v_minutes_delta numeric := coalesce(p_minutes_delta, 0);
  v_hours_delta numeric := coalesce(p_minutes_delta, 0) / 60.0;
begin
  if p_event_car_id is null or v_minutes_delta = 0 then
    return;
  end if;

  select ec.car_id
    into v_car_id
  from public.event_cars ec
  where ec.id = p_event_car_id;

  if v_car_id is null then
    raise exception 'Nessuna auto collegata a event_car_id=%', p_event_car_id;
  end if;

  update public.cars c
  set
    hours = greatest(0, coalesce(c.hours, 0) + v_hours_delta),
    total_hours = greatest(0, coalesce(c.total_hours, 0) + v_hours_delta)
  where c.id = v_car_id;

  with target_mounts as (
    select distinct
      cc.id as car_component_id,
      cc.component_id
    from public.car_components cc
    where cc.car_id = v_car_id
      and coalesce(cc.mounted_at, cc.installed_at, cc.created_at, '-infinity'::timestamptz) <= v_turn_time
      and (cc.removed_at is null or cc.removed_at > v_turn_time)
  ),
  updated_mounts as (
    update public.car_components cc
    set hours_used = greatest(0, coalesce(cc.hours_used, 0) + v_hours_delta)
    from target_mounts tm
    where cc.id = tm.car_component_id
    returning tm.component_id
  ),
  target_components as (
    select distinct component_id
    from updated_mounts

    union

    -- Fallback per vecchi dati dove il componente risulta collegato solo da components.car_id.
    select c.id as component_id
    from public.components c
    where c.car_id = v_car_id
      and coalesce(c.is_active, true) = true
  )
  update public.components c
  set
    hours = greatest(0, coalesce(c.hours, 0) + v_hours_delta),
    life_hours = greatest(0, coalesce(c.life_hours, 0) + v_hours_delta),
    work_hours = greatest(0, coalesce(c.work_hours, 0) + v_hours_delta)
  where c.id in (select component_id from target_components);
end;
$$;

create or replace function public.trg_sync_turn_hours_to_assets()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old jsonb;
  v_new jsonb;

  v_old_event_car_id uuid;
  v_new_event_car_id uuid;

  v_old_minutes numeric := 0;
  v_new_minutes numeric := 0;

  v_old_recorded_at timestamptz;
  v_new_recorded_at timestamptz;
begin
  if tg_op = 'INSERT' then
    v_new := to_jsonb(new);
    v_new_event_car_id := nullif(v_new ->> 'event_car_id', '')::uuid;
    v_new_minutes := coalesce(nullif(v_new ->> 'minutes', '')::numeric, 0);
    v_new_recorded_at := coalesce(
      nullif(v_new ->> 'recorded_at', '')::timestamptz,
      nullif(v_new ->> 'created_at', '')::timestamptz,
      now()
    );

    if v_new_minutes < 0 then
      raise exception 'event_car_turns.minutes non può essere negativo: %', v_new_minutes;
    end if;

    perform public.apply_turn_hours_delta(v_new_event_car_id, v_new_recorded_at, v_new_minutes);
    return new;
  end if;

  if tg_op = 'DELETE' then
    v_old := to_jsonb(old);
    v_old_event_car_id := nullif(v_old ->> 'event_car_id', '')::uuid;
    v_old_minutes := coalesce(nullif(v_old ->> 'minutes', '')::numeric, 0);
    v_old_recorded_at := coalesce(
      nullif(v_old ->> 'recorded_at', '')::timestamptz,
      nullif(v_old ->> 'created_at', '')::timestamptz,
      now()
    );

    perform public.apply_turn_hours_delta(v_old_event_car_id, v_old_recorded_at, -v_old_minutes);
    return old;
  end if;

  if tg_op = 'UPDATE' then
    v_old := to_jsonb(old);
    v_new := to_jsonb(new);

    v_old_event_car_id := nullif(v_old ->> 'event_car_id', '')::uuid;
    v_new_event_car_id := nullif(v_new ->> 'event_car_id', '')::uuid;

    v_old_minutes := coalesce(nullif(v_old ->> 'minutes', '')::numeric, 0);
    v_new_minutes := coalesce(nullif(v_new ->> 'minutes', '')::numeric, 0);

    v_old_recorded_at := coalesce(
      nullif(v_old ->> 'recorded_at', '')::timestamptz,
      nullif(v_old ->> 'created_at', '')::timestamptz,
      now()
    );
    v_new_recorded_at := coalesce(
      nullif(v_new ->> 'recorded_at', '')::timestamptz,
      nullif(v_new ->> 'created_at', '')::timestamptz,
      now()
    );

    if v_new_minutes < 0 then
      raise exception 'event_car_turns.minutes non può essere negativo: %', v_new_minutes;
    end if;

    if v_old_event_car_id is not distinct from v_new_event_car_id
       and v_old_recorded_at is not distinct from v_new_recorded_at then
      perform public.apply_turn_hours_delta(
        v_new_event_car_id,
        v_new_recorded_at,
        v_new_minutes - v_old_minutes
      );
    else
      perform public.apply_turn_hours_delta(v_old_event_car_id, v_old_recorded_at, -v_old_minutes);
      perform public.apply_turn_hours_delta(v_new_event_car_id, v_new_recorded_at, v_new_minutes);
    end if;

    return new;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_sync_turn_hours_to_assets on public.event_car_turns;
create trigger trg_sync_turn_hours_to_assets
after insert or update or delete on public.event_car_turns
for each row execute function public.trg_sync_turn_hours_to_assets();

create or replace function public.save_event_car_turn_with_metrics(
  p_team_id uuid,
  p_event_id uuid,
  p_event_car_id uuid,
  p_turn_id uuid default null,
  p_event_session_id uuid default null,
  p_driver_id uuid default null,
  p_recorded_at timestamptz default now(),
  p_minutes integer default 0,
  p_laps integer default 0,
  p_fuel_start_liters numeric default null,
  p_fuel_end_liters numeric default null,
  p_notes text default null,
  p_track_condition text default null,
  p_pre_air_temp_c numeric default null,
  p_pre_track_temp_c numeric default null,
  p_post_air_temp_c numeric default null,
  p_post_track_temp_c numeric default null,
  p_pre_pressure_fl numeric default null,
  p_pre_pressure_fr numeric default null,
  p_pre_pressure_rl numeric default null,
  p_pre_pressure_rr numeric default null,
  p_post_pressure_fl numeric default null,
  p_post_pressure_fr numeric default null,
  p_post_pressure_rl numeric default null,
  p_post_pressure_rr numeric default null,
  p_post_tyre_temp_fl numeric default null,
  p_post_tyre_temp_fr numeric default null,
  p_post_tyre_temp_rl numeric default null,
  p_post_tyre_temp_rr numeric default null,
  p_air_opening_cm numeric default null,
  p_oil_opening_cm numeric default null,
  p_max_water_temp_c numeric default null,
  p_max_oil_temp_c numeric default null,
  p_best_lap_ms integer default null,
  p_avg_lap_ms integer default null,
  p_target_post_pressure_fl numeric default null,
  p_target_post_pressure_fr numeric default null,
  p_target_post_pressure_rl numeric default null,
  p_target_post_pressure_rr numeric default null,
  p_target_water_temp_c numeric default null,
  p_target_oil_temp_c numeric default null,
  p_technical_notes text default null,
  p_created_by_team_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_car record;
  v_existing_turn record;
  v_turn_id uuid;
  v_metric_id uuid;
  v_action text;
begin
  if p_team_id is null then
    raise exception 'team_id obbligatorio';
  end if;

  if not public.is_team_member(p_team_id) then
    raise exception 'Utente non autorizzato per questo team';
  end if;

  if p_event_id is null then
    raise exception 'event_id obbligatorio';
  end if;

  if p_event_car_id is null then
    raise exception 'event_car_id obbligatorio';
  end if;

  if coalesce(p_minutes, 0) <= 0 then
    raise exception 'I minuti del turno devono essere maggiori di zero.';
  end if;

  if coalesce(p_laps, 0) < 0 then
    raise exception 'I giri del turno non possono essere negativi.';
  end if;

  if p_fuel_start_liters is not null and p_fuel_end_liters is not null and p_fuel_end_liters > p_fuel_start_liters then
    raise exception 'Il carburante finale non può essere superiore al carburante iniziale.';
  end if;

  if p_track_condition is not null and p_track_condition not in ('dry', 'damp', 'wet', 'mixed') then
    raise exception 'Condizione tracciato non valida: %', p_track_condition;
  end if;

  select ec.id, ec.team_id, ec.event_id, ec.car_id
    into v_event_car
  from public.event_cars ec
  where ec.id = p_event_car_id
    and ec.team_id = p_team_id
  for update;

  if not found then
    raise exception 'Mezzo evento non trovato o non appartenente al team.';
  end if;

  if v_event_car.event_id <> p_event_id then
    raise exception 'Il mezzo evento selezionato non appartiene a questo evento.';
  end if;

  if not exists (
    select 1
    from public.events e
    where e.id = p_event_id
      and e.team_id = p_team_id
  ) then
    raise exception 'Evento non trovato o non appartenente al team.';
  end if;

  if p_event_session_id is not null and not exists (
    select 1
    from public.event_sessions s
    where s.id = p_event_session_id
      and s.event_id = p_event_id
      and s.team_id = p_team_id
  ) then
    raise exception 'Sessione non valida per questo evento.';
  end if;

  if p_driver_id is not null and not exists (
    select 1
    from public.drivers d
    where d.id = p_driver_id
      and d.team_id = p_team_id
  ) then
    raise exception 'Pilota non valido per questo team.';
  end if;

  if p_created_by_team_user_id is not null and not exists (
    select 1
    from public.team_users tu
    where tu.id = p_created_by_team_user_id
      and tu.team_id = p_team_id
      and coalesce(tu.is_active, true) = true
  ) then
    raise exception 'Utente team non valido.';
  end if;

  if p_turn_id is null then
    insert into public.event_car_turns (
      team_id,
      event_car_id,
      event_session_id,
      driver_id,
      recorded_at,
      minutes,
      laps,
      fuel_start_liters,
      fuel_end_liters,
      notes,
      created_by_team_user_id
    ) values (
      p_team_id,
      p_event_car_id,
      p_event_session_id,
      p_driver_id,
      coalesce(p_recorded_at, now()),
      p_minutes,
      coalesce(p_laps, 0),
      p_fuel_start_liters,
      p_fuel_end_liters,
      nullif(trim(coalesce(p_notes, '')), ''),
      p_created_by_team_user_id
    )
    returning id into v_turn_id;

    v_action := 'created';
  else
    select *
      into v_existing_turn
    from public.event_car_turns t
    where t.id = p_turn_id
      and t.team_id = p_team_id
    for update;

    if not found then
      raise exception 'Turno non trovato o non appartenente al team.';
    end if;

    update public.event_car_turns t
    set
      event_car_id = p_event_car_id,
      event_session_id = p_event_session_id,
      driver_id = p_driver_id,
      recorded_at = coalesce(p_recorded_at, now()),
      minutes = p_minutes,
      laps = coalesce(p_laps, 0),
      fuel_start_liters = p_fuel_start_liters,
      fuel_end_liters = p_fuel_end_liters,
      notes = nullif(trim(coalesce(p_notes, '')), '')
    where t.id = p_turn_id
      and t.team_id = p_team_id
    returning t.id into v_turn_id;

    v_action := 'updated';
  end if;

  insert into public.event_car_turn_metrics (
    team_id,
    turn_id,
    event_id,
    event_car_id,
    track_condition,
    pre_air_temp_c,
    pre_track_temp_c,
    post_air_temp_c,
    post_track_temp_c,
    pre_pressure_fl,
    pre_pressure_fr,
    pre_pressure_rl,
    pre_pressure_rr,
    post_pressure_fl,
    post_pressure_fr,
    post_pressure_rl,
    post_pressure_rr,
    post_tyre_temp_fl,
    post_tyre_temp_fr,
    post_tyre_temp_rl,
    post_tyre_temp_rr,
    air_opening_cm,
    oil_opening_cm,
    max_water_temp_c,
    max_oil_temp_c,
    best_lap_ms,
    avg_lap_ms,
    target_post_pressure_fl,
    target_post_pressure_fr,
    target_post_pressure_rl,
    target_post_pressure_rr,
    target_water_temp_c,
    target_oil_temp_c,
    technical_notes
  ) values (
    p_team_id,
    v_turn_id,
    p_event_id,
    p_event_car_id,
    coalesce(p_track_condition, 'dry'),
    p_pre_air_temp_c,
    p_pre_track_temp_c,
    p_post_air_temp_c,
    p_post_track_temp_c,
    p_pre_pressure_fl,
    p_pre_pressure_fr,
    p_pre_pressure_rl,
    p_pre_pressure_rr,
    p_post_pressure_fl,
    p_post_pressure_fr,
    p_post_pressure_rl,
    p_post_pressure_rr,
    p_post_tyre_temp_fl,
    p_post_tyre_temp_fr,
    p_post_tyre_temp_rl,
    p_post_tyre_temp_rr,
    p_air_opening_cm,
    p_oil_opening_cm,
    p_max_water_temp_c,
    p_max_oil_temp_c,
    p_best_lap_ms,
    p_avg_lap_ms,
    p_target_post_pressure_fl,
    p_target_post_pressure_fr,
    p_target_post_pressure_rl,
    p_target_post_pressure_rr,
    p_target_water_temp_c,
    p_target_oil_temp_c,
    nullif(trim(coalesce(p_technical_notes, '')), '')
  )
  on conflict (turn_id) do update set
    team_id = excluded.team_id,
    event_id = excluded.event_id,
    event_car_id = excluded.event_car_id,
    track_condition = excluded.track_condition,
    pre_air_temp_c = excluded.pre_air_temp_c,
    pre_track_temp_c = excluded.pre_track_temp_c,
    post_air_temp_c = excluded.post_air_temp_c,
    post_track_temp_c = excluded.post_track_temp_c,
    pre_pressure_fl = excluded.pre_pressure_fl,
    pre_pressure_fr = excluded.pre_pressure_fr,
    pre_pressure_rl = excluded.pre_pressure_rl,
    pre_pressure_rr = excluded.pre_pressure_rr,
    post_pressure_fl = excluded.post_pressure_fl,
    post_pressure_fr = excluded.post_pressure_fr,
    post_pressure_rl = excluded.post_pressure_rl,
    post_pressure_rr = excluded.post_pressure_rr,
    post_tyre_temp_fl = excluded.post_tyre_temp_fl,
    post_tyre_temp_fr = excluded.post_tyre_temp_fr,
    post_tyre_temp_rl = excluded.post_tyre_temp_rl,
    post_tyre_temp_rr = excluded.post_tyre_temp_rr,
    air_opening_cm = excluded.air_opening_cm,
    oil_opening_cm = excluded.oil_opening_cm,
    max_water_temp_c = excluded.max_water_temp_c,
    max_oil_temp_c = excluded.max_oil_temp_c,
    best_lap_ms = excluded.best_lap_ms,
    avg_lap_ms = excluded.avg_lap_ms,
    target_post_pressure_fl = excluded.target_post_pressure_fl,
    target_post_pressure_fr = excluded.target_post_pressure_fr,
    target_post_pressure_rl = excluded.target_post_pressure_rl,
    target_post_pressure_rr = excluded.target_post_pressure_rr,
    target_water_temp_c = excluded.target_water_temp_c,
    target_oil_temp_c = excluded.target_oil_temp_c,
    technical_notes = excluded.technical_notes,
    updated_at = now()
  returning id into v_metric_id;

  return jsonb_build_object(
    'ok', true,
    'action', v_action,
    'turn_id', v_turn_id,
    'metric_id', v_metric_id,
    'event_id', p_event_id,
    'event_car_id', p_event_car_id,
    'minutes', p_minutes
  );
end;
$$;

create or replace function public.delete_event_car_turn(
  p_team_id uuid,
  p_turn_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_turn record;
begin
  if p_team_id is null then
    raise exception 'team_id obbligatorio';
  end if;

  if p_turn_id is null then
    raise exception 'turn_id obbligatorio';
  end if;

  if not public.is_team_member(p_team_id) then
    raise exception 'Utente non autorizzato per questo team';
  end if;

  select t.id, t.event_car_id, t.minutes
    into v_turn
  from public.event_car_turns t
  where t.id = p_turn_id
    and t.team_id = p_team_id
  for update;

  if not found then
    raise exception 'Turno non trovato o non appartenente al team.';
  end if;

  delete from public.event_car_turns t
  where t.id = p_turn_id
    and t.team_id = p_team_id;

  return jsonb_build_object(
    'ok', true,
    'action', 'deleted',
    'turn_id', p_turn_id,
    'event_car_id', v_turn.event_car_id,
    'minutes_removed', coalesce(v_turn.minutes, 0)
  );
end;
$$;

commit;
