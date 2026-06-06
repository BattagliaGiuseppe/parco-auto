-- =========================================
-- PARCO AUTO · PRESENZE / TIMBRATURE PATCH
-- Modulo presenze base con timbratura da account personale
-- =========================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.team_staff_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null,
  team_user_id uuid references public.team_users(id) on delete set null,
  full_name text not null,
  email text,
  phone text,
  role_label text,
  is_active boolean not null default true,
  badge_code_hash text,
  pin_hash text,
  created_by_team_user_id uuid references public.team_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(team_id, team_user_id)
);

create index if not exists idx_team_staff_members_team on public.team_staff_members(team_id, is_active);
create index if not exists idx_team_staff_members_team_user on public.team_staff_members(team_id, team_user_id);

drop trigger if exists trg_set_updated_at_team_staff_members on public.team_staff_members;
create trigger trg_set_updated_at_team_staff_members
before update on public.team_staff_members
for each row execute function public.set_updated_at();

create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null,
  staff_member_id uuid not null references public.team_staff_members(id) on delete cascade,
  event_id uuid references public.events(id) on delete set null,
  check_in_at timestamptz not null default now(),
  check_out_at timestamptz,
  check_in_source text not null default 'self',
  check_out_source text,
  check_in_location_label text not null default 'sede',
  check_out_location_label text,
  check_in_lat numeric,
  check_in_lng numeric,
  check_out_lat numeric,
  check_out_lng numeric,
  check_in_note text,
  check_out_note text,
  created_by_team_user_id uuid references public.team_users(id) on delete set null,
  updated_by_team_user_id uuid references public.team_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attendance_source_check check (check_in_source in ('self','admin','kiosk','qr_event')),
  constraint attendance_checkout_source_check check (check_out_source is null or check_out_source in ('self','admin','kiosk','qr_event')),
  constraint attendance_location_check check (check_in_location_label in ('sede','pista','altro')),
  constraint attendance_checkout_location_check check (check_out_location_label is null or check_out_location_label in ('sede','pista','altro')),
  constraint attendance_checkout_after_checkin check (check_out_at is null or check_out_at >= check_in_at)
);

create index if not exists idx_attendance_records_team_checkin on public.attendance_records(team_id, check_in_at desc);
create index if not exists idx_attendance_records_team_open on public.attendance_records(team_id, staff_member_id) where check_out_at is null;
create index if not exists idx_attendance_records_team_event on public.attendance_records(team_id, event_id);

drop trigger if exists trg_set_updated_at_attendance_records on public.attendance_records;
create trigger trg_set_updated_at_attendance_records
before update on public.attendance_records
for each row execute function public.set_updated_at();

-- Crea automaticamente schede staff per gli utenti team esistenti.
insert into public.team_staff_members (
  team_id,
  team_user_id,
  full_name,
  email,
  role_label,
  is_active,
  created_by_team_user_id
)
select
  tu.team_id,
  tu.id,
  coalesce(nullif(tu.name, ''), tu.email, 'Membro team'),
  tu.email,
  tu.role,
  tu.is_active,
  tu.id
from public.team_users tu
where tu.is_active = true
on conflict (team_id, team_user_id) do update
set full_name = coalesce(public.team_staff_members.full_name, excluded.full_name),
    email = coalesce(public.team_staff_members.email, excluded.email),
    role_label = coalesce(public.team_staff_members.role_label, excluded.role_label),
    is_active = excluded.is_active;

create or replace function public.is_attendance_staff_owner(p_staff_member_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.team_staff_members sm
    join public.team_users tu on tu.id = sm.team_user_id
    where sm.id = p_staff_member_id
      and tu.auth_user_id = auth.uid()
      and tu.is_active = true
  );
$$;

create or replace function public.attendance_ensure_staff_member(p_team_id uuid)
returns public.team_staff_members
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_user public.team_users%rowtype;
  v_staff public.team_staff_members%rowtype;
begin
  select * into v_team_user
  from public.team_users
  where team_id = p_team_id
    and auth_user_id = auth.uid()
    and is_active = true
  order by created_at asc
  limit 1;

  if not found then
    raise exception 'Utente non associato a questo team';
  end if;

  select * into v_staff
  from public.team_staff_members
  where team_id = p_team_id
    and team_user_id = v_team_user.id
  limit 1;

  if found then
    if v_staff.is_active = false then
      update public.team_staff_members
      set is_active = true
      where id = v_staff.id
      returning * into v_staff;
    end if;

    return v_staff;
  end if;

  insert into public.team_staff_members (
    team_id,
    team_user_id,
    full_name,
    email,
    role_label,
    is_active,
    created_by_team_user_id
  ) values (
    p_team_id,
    v_team_user.id,
    coalesce(nullif(v_team_user.name, ''), v_team_user.email, 'Membro team'),
    v_team_user.email,
    v_team_user.role,
    true,
    v_team_user.id
  )
  returning * into v_staff;

  return v_staff;
end;
$$;

create or replace function public.attendance_clock_in(
  p_team_id uuid,
  p_location_label text default 'sede',
  p_event_id uuid default null,
  p_note text default null,
  p_lat numeric default null,
  p_lng numeric default null
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
  if p_location_label not in ('sede','pista','altro') then
    raise exception 'Luogo timbratura non valido';
  end if;

  v_staff := public.attendance_ensure_staff_member(p_team_id);
  v_team_user_id := v_staff.team_user_id;

  if p_event_id is not null and not exists (
    select 1 from public.events where id = p_event_id and team_id = p_team_id
  ) then
    raise exception 'Evento non valido per questo team';
  end if;

  if exists (
    select 1
    from public.attendance_records
    where team_id = p_team_id
      and staff_member_id = v_staff.id
      and check_out_at is null
  ) then
    raise exception 'Risulti già presente. Registra prima l''uscita.';
  end if;

  insert into public.attendance_records (
    team_id,
    staff_member_id,
    event_id,
    check_in_source,
    check_in_location_label,
    check_in_lat,
    check_in_lng,
    check_in_note,
    created_by_team_user_id
  ) values (
    p_team_id,
    v_staff.id,
    p_event_id,
    'self',
    p_location_label,
    p_lat,
    p_lng,
    nullif(p_note, ''),
    v_team_user_id
  )
  returning * into v_record;

  return v_record;
end;
$$;

create or replace function public.attendance_clock_out(
  p_team_id uuid,
  p_location_label text default 'sede',
  p_note text default null,
  p_lat numeric default null,
  p_lng numeric default null
)
returns public.attendance_records
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff public.team_staff_members%rowtype;
  v_record_id uuid;
  v_record public.attendance_records%rowtype;
  v_team_user_id uuid;
begin
  if p_location_label not in ('sede','pista','altro') then
    raise exception 'Luogo timbratura non valido';
  end if;

  v_staff := public.attendance_ensure_staff_member(p_team_id);
  v_team_user_id := v_staff.team_user_id;

  select id into v_record_id
  from public.attendance_records
  where team_id = p_team_id
    and staff_member_id = v_staff.id
    and check_out_at is null
  order by check_in_at desc
  limit 1;

  if v_record_id is null then
    raise exception 'Nessuna timbratura aperta da chiudere.';
  end if;

  update public.attendance_records
  set check_out_at = now(),
      check_out_source = 'self',
      check_out_location_label = p_location_label,
      check_out_lat = p_lat,
      check_out_lng = p_lng,
      check_out_note = nullif(p_note, ''),
      updated_by_team_user_id = v_team_user_id
  where id = v_record_id
  returning * into v_record;

  return v_record;
end;
$$;

grant execute on function public.attendance_ensure_staff_member(uuid) to authenticated;
grant execute on function public.attendance_clock_in(uuid, text, uuid, text, numeric, numeric) to authenticated;
grant execute on function public.attendance_clock_out(uuid, text, text, numeric, numeric) to authenticated;

alter table public.team_staff_members enable row level security;
alter table public.attendance_records enable row level security;

-- Staff members
 drop policy if exists team_staff_members_select_team on public.team_staff_members;
drop policy if exists team_staff_members_insert_manager on public.team_staff_members;
drop policy if exists team_staff_members_update_manager on public.team_staff_members;
drop policy if exists team_staff_members_delete_manager on public.team_staff_members;

create policy team_staff_members_select_team
on public.team_staff_members
for select
using (public.is_team_member(team_id));

create policy team_staff_members_insert_manager
on public.team_staff_members
for insert
with check (public.is_team_manager(team_id));

create policy team_staff_members_update_manager
on public.team_staff_members
for update
using (public.is_team_manager(team_id))
with check (public.is_team_manager(team_id));

create policy team_staff_members_delete_manager
on public.team_staff_members
for delete
using (public.is_team_manager(team_id));

-- Attendance records
 drop policy if exists attendance_records_select_team on public.attendance_records;
drop policy if exists attendance_records_insert_team_owner on public.attendance_records;
drop policy if exists attendance_records_update_team_owner on public.attendance_records;
drop policy if exists attendance_records_delete_manager on public.attendance_records;

create policy attendance_records_select_team
on public.attendance_records
for select
using (public.is_team_member(team_id));

create policy attendance_records_insert_team_owner
on public.attendance_records
for insert
with check (
  public.is_team_manager(team_id)
  or public.is_attendance_staff_owner(staff_member_id)
);

create policy attendance_records_update_team_owner
on public.attendance_records
for update
using (
  public.is_team_manager(team_id)
  or public.is_attendance_staff_owner(staff_member_id)
)
with check (
  public.is_team_manager(team_id)
  or public.is_attendance_staff_owner(staff_member_id)
);

create policy attendance_records_delete_manager
on public.attendance_records
for delete
using (public.is_team_manager(team_id));

-- Permessi applicativi
insert into public.app_permissions (code, label, description)
values
  ('attendance.view', 'Visualizza presenze', 'Accesso al modulo presenze e timbrature'),
  ('attendance.clock_self', 'Timbratura personale', 'Entrata e uscita dal proprio account'),
  ('attendance.manage', 'Gestisci presenze', 'Gestione staff e correzione presenze'),
  ('attendance.kiosk', 'Kiosk presenze', 'Uso futuro della modalità tablet/badge'),
  ('attendance.export', 'Esporta presenze', 'Esportazione riepiloghi presenze')
on conflict (code) do update
set label = excluded.label,
    description = excluded.description;

insert into public.role_permissions (role, permission_code)
values
  ('owner', 'attendance.view'),
  ('owner', 'attendance.clock_self'),
  ('owner', 'attendance.manage'),
  ('owner', 'attendance.kiosk'),
  ('owner', 'attendance.export'),
  ('admin', 'attendance.view'),
  ('admin', 'attendance.clock_self'),
  ('admin', 'attendance.manage'),
  ('admin', 'attendance.kiosk'),
  ('admin', 'attendance.export'),
  ('engineer', 'attendance.view'),
  ('engineer', 'attendance.clock_self'),
  ('mechanic', 'attendance.view'),
  ('mechanic', 'attendance.clock_self'),
  ('viewer', 'attendance.view'),
  ('viewer', 'attendance.clock_self')
on conflict do nothing;

-- Attiva il modulo presenze nelle impostazioni esistenti, senza alterare le altre preferenze.
update public.app_settings
set modules = coalesce(modules, '{}'::jsonb) || '{"attendance": true}'::jsonb
where modules is null or not (modules ? 'attendance');
