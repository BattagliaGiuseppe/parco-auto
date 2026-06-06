-- =========================================
-- PARCO AUTO · PRESENZE ADMIN / RIEPILOGHI / AZZERAMENTI
-- Estensione per timbratura admin, modifica timbrature e contatori periodici
-- =========================================

create table if not exists public.attendance_counter_resets (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null,
  staff_member_id uuid not null references public.team_staff_members(id) on delete cascade,
  reset_at timestamptz not null default now(),
  note text,
  notify_user boolean not null default false,
  notification_status text not null default 'not_requested',
  created_by_team_user_id uuid references public.team_users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint attendance_reset_notification_status_check check (notification_status in ('not_requested','requested','sent','failed'))
);

create index if not exists idx_attendance_counter_resets_team_staff
on public.attendance_counter_resets(team_id, staff_member_id, reset_at desc);

alter table public.attendance_counter_resets enable row level security;

drop policy if exists attendance_counter_resets_select_team on public.attendance_counter_resets;
drop policy if exists attendance_counter_resets_insert_manager on public.attendance_counter_resets;
drop policy if exists attendance_counter_resets_update_manager on public.attendance_counter_resets;
drop policy if exists attendance_counter_resets_delete_manager on public.attendance_counter_resets;

create policy attendance_counter_resets_select_team
on public.attendance_counter_resets
for select
using (public.is_team_member(team_id));

create policy attendance_counter_resets_insert_manager
on public.attendance_counter_resets
for insert
with check (public.is_team_manager(team_id));

create policy attendance_counter_resets_update_manager
on public.attendance_counter_resets
for update
using (public.is_team_manager(team_id))
with check (public.is_team_manager(team_id));

create policy attendance_counter_resets_delete_manager
on public.attendance_counter_resets
for delete
using (public.is_team_manager(team_id));

create or replace function public.attendance_current_team_user_id(p_team_id uuid)
returns uuid
language sql
security definer
set search_path = public
as $$
  select tu.id
  from public.team_users tu
  where tu.team_id = p_team_id
    and tu.auth_user_id = auth.uid()
    and tu.is_active = true
  order by tu.created_at asc
  limit 1;
$$;

create or replace function public.attendance_assert_manager(p_team_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_user_id uuid;
begin
  v_team_user_id := public.attendance_current_team_user_id(p_team_id);

  if v_team_user_id is null or not public.is_team_manager(p_team_id) then
    raise exception 'Permesso non sufficiente per gestire le presenze';
  end if;

  return v_team_user_id;
end;
$$;

create or replace function public.attendance_validate_staff(p_team_id uuid, p_staff_member_id uuid)
returns public.team_staff_members
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff public.team_staff_members%rowtype;
begin
  select * into v_staff
  from public.team_staff_members
  where id = p_staff_member_id
    and team_id = p_team_id
  limit 1;

  if not found then
    raise exception 'Membro staff non valido per questo team';
  end if;

  return v_staff;
end;
$$;

create or replace function public.attendance_validate_location(p_location_label text)
returns text
language plpgsql
immutable
as $$
begin
  if p_location_label not in ('sede','pista','altro') then
    raise exception 'Luogo timbratura non valido';
  end if;

  return p_location_label;
end;
$$;

create or replace function public.attendance_admin_clock_in(
  p_team_id uuid,
  p_staff_member_id uuid,
  p_location_label text default 'sede',
  p_event_id uuid default null,
  p_note text default null,
  p_check_in_at timestamptz default now()
)
returns public.attendance_records
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff public.team_staff_members%rowtype;
  v_record public.attendance_records%rowtype;
  v_team_user_id uuid;
begin
  v_team_user_id := public.attendance_assert_manager(p_team_id);
  v_staff := public.attendance_validate_staff(p_team_id, p_staff_member_id);
  perform public.attendance_validate_location(p_location_label);

  if p_event_id is not null and not exists (
    select 1 from public.events where id = p_event_id and team_id = p_team_id
  ) then
    raise exception 'Evento non valido per questo team';
  end if;

  if exists (
    select 1
    from public.attendance_records
    where team_id = p_team_id
      and staff_member_id = p_staff_member_id
      and check_out_at is null
  ) then
    raise exception 'Questo membro risulta già presente. Registra prima l''uscita.';
  end if;

  insert into public.attendance_records (
    team_id,
    staff_member_id,
    event_id,
    check_in_at,
    check_in_source,
    check_in_location_label,
    check_in_note,
    created_by_team_user_id,
    updated_by_team_user_id
  ) values (
    p_team_id,
    p_staff_member_id,
    p_event_id,
    coalesce(p_check_in_at, now()),
    'admin',
    p_location_label,
    nullif(p_note, ''),
    v_team_user_id,
    v_team_user_id
  ) returning * into v_record;

  return v_record;
end;
$$;

create or replace function public.attendance_admin_clock_out(
  p_team_id uuid,
  p_staff_member_id uuid,
  p_location_label text default 'sede',
  p_note text default null,
  p_check_out_at timestamptz default now()
)
returns public.attendance_records
language plpgsql
security definer
set search_path = public
as $$
declare
  v_record_id uuid;
  v_record public.attendance_records%rowtype;
  v_team_user_id uuid;
begin
  v_team_user_id := public.attendance_assert_manager(p_team_id);
  perform public.attendance_validate_staff(p_team_id, p_staff_member_id);
  perform public.attendance_validate_location(p_location_label);

  select id into v_record_id
  from public.attendance_records
  where team_id = p_team_id
    and staff_member_id = p_staff_member_id
    and check_out_at is null
  order by check_in_at desc
  limit 1;

  if v_record_id is null then
    raise exception 'Nessuna timbratura aperta da chiudere per questo membro.';
  end if;

  update public.attendance_records
  set check_out_at = coalesce(p_check_out_at, now()),
      check_out_source = 'admin',
      check_out_location_label = p_location_label,
      check_out_note = nullif(p_note, ''),
      updated_by_team_user_id = v_team_user_id
  where id = v_record_id
  returning * into v_record;

  return v_record;
end;
$$;

create or replace function public.attendance_admin_update_record(
  p_team_id uuid,
  p_record_id uuid,
  p_staff_member_id uuid,
  p_event_id uuid default null,
  p_check_in_at timestamptz default now(),
  p_check_out_at timestamptz default null,
  p_check_in_location_label text default 'sede',
  p_check_out_location_label text default null,
  p_check_in_note text default null,
  p_check_out_note text default null
)
returns public.attendance_records
language plpgsql
security definer
set search_path = public
as $$
declare
  v_record public.attendance_records%rowtype;
  v_team_user_id uuid;
begin
  v_team_user_id := public.attendance_assert_manager(p_team_id);
  perform public.attendance_validate_staff(p_team_id, p_staff_member_id);
  perform public.attendance_validate_location(p_check_in_location_label);

  if p_check_out_location_label is not null then
    perform public.attendance_validate_location(p_check_out_location_label);
  end if;

  if p_event_id is not null and not exists (
    select 1 from public.events where id = p_event_id and team_id = p_team_id
  ) then
    raise exception 'Evento non valido per questo team';
  end if;

  if p_check_out_at is not null and p_check_out_at < p_check_in_at then
    raise exception 'L''uscita non può essere precedente all''entrata';
  end if;

  update public.attendance_records
  set staff_member_id = p_staff_member_id,
      event_id = p_event_id,
      check_in_at = coalesce(p_check_in_at, check_in_at),
      check_out_at = p_check_out_at,
      check_in_location_label = p_check_in_location_label,
      check_out_location_label = p_check_out_location_label,
      check_in_note = nullif(p_check_in_note, ''),
      check_out_note = nullif(p_check_out_note, ''),
      updated_by_team_user_id = v_team_user_id
  where id = p_record_id
    and team_id = p_team_id
  returning * into v_record;

  if not found then
    raise exception 'Timbratura non trovata';
  end if;

  return v_record;
end;
$$;

create or replace function public.attendance_reset_counter(
  p_team_id uuid,
  p_staff_member_id uuid,
  p_reset_at timestamptz default now(),
  p_note text default null,
  p_notify_user boolean default false
)
returns public.attendance_counter_resets
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reset public.attendance_counter_resets%rowtype;
  v_team_user_id uuid;
begin
  v_team_user_id := public.attendance_assert_manager(p_team_id);
  perform public.attendance_validate_staff(p_team_id, p_staff_member_id);

  insert into public.attendance_counter_resets (
    team_id,
    staff_member_id,
    reset_at,
    note,
    notify_user,
    notification_status,
    created_by_team_user_id
  ) values (
    p_team_id,
    p_staff_member_id,
    coalesce(p_reset_at, now()),
    nullif(p_note, ''),
    coalesce(p_notify_user, false),
    case when coalesce(p_notify_user, false) then 'requested' else 'not_requested' end,
    v_team_user_id
  ) returning * into v_reset;

  return v_reset;
end;
$$;

create or replace function public.attendance_staff_summary(p_team_id uuid)
returns table (
  staff_member_id uuid,
  minutes_all_time numeric,
  minutes_since_reset numeric,
  records_count bigint,
  days_worked bigint,
  last_reset_at timestamptz,
  last_check_in_at timestamptz,
  latest_record_id uuid,
  open_record_id uuid
)
language sql
security definer
set search_path = public
as $$
  with staff as (
    select sm.id
    from public.team_staff_members sm
    where sm.team_id = p_team_id
      and public.is_team_member(sm.team_id)
  ),
  last_resets as (
    select distinct on (r.staff_member_id)
      r.staff_member_id,
      r.reset_at
    from public.attendance_counter_resets r
    where r.team_id = p_team_id
    order by r.staff_member_id, r.reset_at desc
  ),
  latest_records as (
    select distinct on (ar.staff_member_id)
      ar.staff_member_id,
      ar.id,
      ar.check_in_at
    from public.attendance_records ar
    where ar.team_id = p_team_id
    order by ar.staff_member_id, ar.check_in_at desc
  ),
  open_records as (
    select distinct on (ar.staff_member_id)
      ar.staff_member_id,
      ar.id
    from public.attendance_records ar
    where ar.team_id = p_team_id
      and ar.check_out_at is null
    order by ar.staff_member_id, ar.check_in_at desc
  ),
  aggregates as (
    select
      s.id as staff_member_id,
      coalesce(sum(extract(epoch from (coalesce(ar.check_out_at, now()) - ar.check_in_at)) / 60), 0)::numeric as minutes_all_time,
      coalesce(sum(
        case
          when ar.id is null then 0
          when coalesce(ar.check_out_at, now()) <= coalesce(lr.reset_at, '-infinity'::timestamptz) then 0
          else extract(epoch from (coalesce(ar.check_out_at, now()) - greatest(ar.check_in_at, coalesce(lr.reset_at, ar.check_in_at)))) / 60
        end
      ), 0)::numeric as minutes_since_reset,
      count(ar.id)::bigint as records_count,
      count(distinct date(ar.check_in_at))::bigint as days_worked
    from staff s
    left join last_resets lr on lr.staff_member_id = s.id
    left join public.attendance_records ar on ar.staff_member_id = s.id and ar.team_id = p_team_id
    group by s.id
  )
  select
    s.id as staff_member_id,
    a.minutes_all_time,
    a.minutes_since_reset,
    a.records_count,
    a.days_worked,
    lr.reset_at as last_reset_at,
    latest.check_in_at as last_check_in_at,
    latest.id as latest_record_id,
    open.id as open_record_id
  from staff s
  left join aggregates a on a.staff_member_id = s.id
  left join last_resets lr on lr.staff_member_id = s.id
  left join latest_records latest on latest.staff_member_id = s.id
  left join open_records open on open.staff_member_id = s.id
  order by s.id;
$$;

grant execute on function public.attendance_admin_clock_in(uuid, uuid, text, uuid, text, timestamptz) to authenticated;
grant execute on function public.attendance_admin_clock_out(uuid, uuid, text, text, timestamptz) to authenticated;
grant execute on function public.attendance_admin_update_record(uuid, uuid, uuid, uuid, timestamptz, timestamptz, text, text, text, text) to authenticated;
grant execute on function public.attendance_reset_counter(uuid, uuid, timestamptz, text, boolean) to authenticated;
grant execute on function public.attendance_staff_summary(uuid) to authenticated;
