-- =========================================
-- PARCO AUTO · WORLDCLASS RESET
-- Reset completo database su base multi-team,
-- auth-aware, configurabile e tablet-first.
-- Eseguire su database di test / vuoto.
-- =========================================

create extension if not exists pgcrypto;

-- =========================================
-- DROP ORDINE SICURO
-- =========================================
drop table if exists public.team_user_permissions cascade;
drop table if exists public.role_permissions cascade;
drop table if exists public.app_permissions cascade;
drop table if exists public.team_checklist_items cascade;
drop table if exists public.team_checklists cascade;
drop table if exists public.team_component_definitions cascade;
drop table if exists public.telemetry_files cascade;
drop table if exists public.inventory_items cascade;
drop table if exists public.driver_session_performance cascade;
drop table if exists public.driver_event_entries cascade;
drop table if exists public.driver_documents cascade;
drop table if exists public.driver_licenses cascade;
drop table if exists public.drivers cascade;
drop table if exists public.event_car_turns cascade;
drop table if exists public.event_car_data cascade;
drop table if exists public.event_sessions cascade;
drop table if exists public.event_cars cascade;
drop table if exists public.events cascade;
drop table if exists public.circuits cascade;
drop table if exists public.maintenances cascade;
drop table if exists public.component_revisions cascade;
drop table if exists public.car_components cascade;
drop table if exists public.documents cascade;
drop table if exists public.document_templates cascade;
drop table if exists public.components cascade;
drop table if exists public.cars cascade;
drop table if exists public.app_settings cascade;
drop table if exists public.team_users cascade;
drop table if exists public.teams cascade;

drop function if exists public.current_team_id() cascade;
drop function if exists public.is_team_member(uuid) cascade;
drop function if exists public.set_team_id_from_auth() cascade;
drop function if exists public.create_team_for_current_user(text, text) cascade;
drop function if exists public.set_updated_at() cascade;

-- =========================================
-- CORE ORG
-- =========================================
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  vehicle_type text not null default 'auto',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.team_users (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  auth_user_id uuid not null,
  email text,
  name text,
  role text not null default 'owner',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(team_id, auth_user_id)
);

create table public.app_permissions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text,
  description text
);

create table public.role_permissions (
  id uuid primary key default gen_random_uuid(),
  role text not null,
  permission_code text not null references public.app_permissions(code) on delete cascade,
  unique(role, permission_code)
);

create table public.team_user_permissions (
  id uuid primary key default gen_random_uuid(),
  team_user_id uuid not null references public.team_users(id) on delete cascade,
  permission_code text not null references public.app_permissions(code) on delete cascade,
  is_allowed boolean not null default true,
  unique(team_user_id, permission_code)
);

create table public.app_settings (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null unique references public.teams(id) on delete cascade,
  team_name text not null default 'Battaglia Racing',
  team_subtitle text,
  team_logo_url text,
  dashboard_cover_url text,
  primary_color text not null default '#facc15',
  secondary_color text not null default '#111111',
  accent_color text not null default '#eab308',
  language text not null default 'it',
  date_format text not null default 'it',
  theme_mode text not null default 'automatico',
  density_mode text not null default 'standard',
  time_format text not null default 'ore_minuti',
  default_warning_hours integer not null default 20,
  default_revision_hours integer not null default 30,
  default_expiry_alert_days integer not null default 30,
  enable_events boolean not null default true,
  enable_maintenances boolean not null default true,
  enable_fuel boolean not null default true,
  enable_setup boolean not null default true,
  enable_notes boolean not null default true,
  email_notifications boolean not null default true,
  calendar_sync boolean not null default false,
  critical_alerts boolean not null default true,
  weekly_summary boolean not null default false,
  vehicle_type text not null default 'auto',
  modules jsonb not null default '{"drivers": true, "performance": true, "inventory": true, "telemetry": true, "documents": true, "mounts": true}',
  dashboard_layout jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.team_component_definitions (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  code text not null,
  label text not null,
  category text not null default 'base',
  is_required boolean not null default true,
  tracks_hours boolean not null default false,
  has_expiry boolean not null default false,
  default_expiry_years integer,
  order_index integer not null default 1,
  created_at timestamptz not null default now(),
  unique(team_id, code)
);

create table public.team_checklists (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  name text not null,
  order_index integer not null default 1,
  created_at timestamptz not null default now()
);

create table public.team_checklist_items (
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid not null references public.team_checklists(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  label text not null,
  input_type text not null default 'status',
  is_required boolean not null default true,
  order_index integer not null default 1,
  created_at timestamptz not null default now()
);

-- =========================================
-- CORE MODULI
-- =========================================
create table public.cars (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  name text not null,
  chassis_number text,
  created_at timestamptz not null default now(),
  total_hours numeric not null default 0,
  hours numeric not null default 0,
  notes text
);

create table public.components (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  type text not null,
  identifier text not null,
  expiry_date date,
  car_id uuid references public.cars(id) on delete set null,
  created_at timestamptz not null default now(),
  is_active boolean not null default true,
  last_maintenance_date date,
  work_hours numeric not null default 0,
  hours numeric not null default 0,
  life_hours numeric not null default 0,
  warning_threshold_hours numeric,
  revision_threshold_hours numeric,
  notes text
);

create table public.car_components (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  car_id uuid not null references public.cars(id) on delete cascade,
  component_id uuid not null references public.components(id) on delete cascade,
  installed_at timestamptz,
  removed_at timestamptz,
  status text not null default 'mounted',
  mounted_at timestamptz,
  hours_used numeric not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

create table public.component_revisions (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  component_id uuid not null references public.components(id) on delete cascade,
  date date not null,
  description text,
  notes text,
  reset_hours boolean not null default false,
  hours_before_reset numeric,
  hours_after_reset numeric,
  life_hours_at_revision numeric,
  created_at timestamptz not null default now()
);

create table public.maintenances (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  car_id uuid references public.cars(id) on delete set null,
  component_id uuid references public.components(id) on delete set null,
  date date not null default current_date,
  type text not null,
  status text not null default 'completed',
  priority text not null default 'medium',
  notes text,
  created_at timestamptz not null default now()
);

create table public.circuits (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  name text not null,
  country text,
  city text,
  length_km numeric,
  notes text,
  created_at timestamptz not null default now()
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  date date,
  name text not null,
  notes text,
  circuit_id uuid references public.circuits(id) on delete set null,
  hours_total_event numeric not null default 0,
  created_at timestamptz not null default now()
);

create table public.event_cars (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  car_id uuid not null references public.cars(id) on delete cascade,
  status text not null default 'in_corso',
  notes text,
  created_at timestamptz not null default now(),
  unique(event_id, car_id)
);

create table public.event_sessions (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null,
  session_type text not null default 'test',
  starts_at timestamptz,
  ends_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

create table public.event_car_turns (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  event_car_id uuid not null references public.event_cars(id) on delete cascade,
  event_session_id uuid references public.event_sessions(id) on delete set null,
  minutes integer not null default 0,
  laps integer not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

create table public.event_car_data (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  event_car_id uuid not null references public.event_cars(id) on delete cascade,
  section text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.drivers (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  nickname text,
  birth_date date,
  nationality text,
  email text,
  phone text,
  emergency_contact text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.driver_licenses (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  driver_id uuid not null references public.drivers(id) on delete cascade,
  license_type text not null,
  license_number text,
  issued_by text,
  issue_date date,
  expiry_date date,
  notes text,
  file_url text,
  created_at timestamptz not null default now()
);

create table public.driver_documents (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  driver_id uuid not null references public.drivers(id) on delete cascade,
  title text,
  document_type text,
  expires_at date,
  file_url text,
  signed_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

create table public.driver_event_entries (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  event_car_id uuid references public.event_cars(id) on delete cascade,
  car_id uuid references public.cars(id) on delete set null,
  driver_id uuid not null references public.drivers(id) on delete cascade,
  role text not null default 'primary',
  notes text,
  created_at timestamptz not null default now()
);

create table public.driver_session_performance (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  driver_id uuid not null references public.drivers(id) on delete cascade,
  session_name text,
  event_name text,
  car_name text,
  best_lap_time text,
  average_lap_time text,
  consistency numeric,
  incidents integer not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  name text not null,
  category text,
  quantity integer not null default 0,
  location text,
  created_at timestamptz not null default now()
);

create table public.telemetry_files (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  file_name text,
  file_url text,
  driver_id uuid references public.drivers(id) on delete set null,
  car_id uuid references public.cars(id) on delete set null,
  event_id uuid references public.events(id) on delete set null,
  session_id uuid references public.event_sessions(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.document_templates (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  name text not null,
  template_type text not null,
  content text,
  file_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  car_id uuid references public.cars(id) on delete cascade,
  component_id uuid references public.components(id) on delete cascade,
  type text,
  file_url text,
  uploaded_at timestamptz not null default now()
);

-- =========================================
-- INDICI
-- =========================================
create index idx_team_users_auth_user_id on public.team_users(auth_user_id);
create index idx_cars_team_id on public.cars(team_id);
create index idx_components_team_id on public.components(team_id);
create index idx_components_car_id on public.components(car_id);
create index idx_components_type on public.components(type);
create index idx_car_components_team_id on public.car_components(team_id);
create index idx_maintenances_component_id on public.maintenances(component_id);
create index idx_events_team_id on public.events(team_id);
create index idx_event_cars_event_id on public.event_cars(event_id);
create index idx_event_car_turns_event_car_id on public.event_car_turns(event_car_id);
create index idx_event_car_data_event_car_id on public.event_car_data(event_car_id);
create index idx_drivers_team_id on public.drivers(team_id);
create index idx_driver_documents_driver_id on public.driver_documents(driver_id);
create index idx_driver_licenses_driver_id on public.driver_licenses(driver_id);
create index idx_driver_performance_driver_id on public.driver_session_performance(driver_id);
create index idx_documents_component_id on public.documents(component_id);

-- =========================================
-- FUNZIONI CORE
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

create trigger trg_set_updated_at_teams
before update on public.teams
for each row execute function public.set_updated_at();

create trigger trg_set_updated_at_team_users
before update on public.team_users
for each row execute function public.set_updated_at();

create trigger trg_set_updated_at_app_settings
before update on public.app_settings
for each row execute function public.set_updated_at();

create or replace function public.current_team_id()
returns uuid
language sql
stable
as $$
  select tu.team_id
  from public.team_users tu
  where tu.auth_user_id = auth.uid()
    and tu.is_active = true
  order by tu.created_at asc
  limit 1
$$;

create or replace function public.is_team_member(p_team_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.team_users tu
    where tu.team_id = p_team_id
      and tu.auth_user_id = auth.uid()
      and tu.is_active = true
  )
$$;

create or replace function public.set_team_id_from_auth()
returns trigger
language plpgsql
as $$
begin
  if new.team_id is null then
    new.team_id := public.current_team_id();
  end if;
  return new;
end;
$$;

create or replace function public.create_team_for_current_user(p_team_name text, p_vehicle_type text default 'auto')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_id uuid;
  v_auth_user uuid;
  v_email text;
begin
  v_auth_user := auth.uid();
  if v_auth_user is null then
    raise exception 'Utente non autenticato';
  end if;

  if exists (
    select 1 from public.team_users where auth_user_id = v_auth_user and is_active = true
  ) then
    raise exception 'Utente già associato a un team attivo';
  end if;

  insert into public.teams (name, slug, vehicle_type)
  values (p_team_name, regexp_replace(lower(p_team_name), '[^a-z0-9]+', '-', 'g'), coalesce(nullif(p_vehicle_type,''), 'auto'))
  returning id into v_team_id;

  insert into public.team_users (team_id, auth_user_id, role, is_active)
  values (v_team_id, v_auth_user, 'owner', true);

  insert into public.app_settings (team_id, team_name, team_subtitle, vehicle_type)
  values (v_team_id, p_team_name, 'Gestione motorsport', coalesce(nullif(p_vehicle_type,''), 'auto'));

  if coalesce(nullif(p_vehicle_type,''), 'auto') = 'moto' then
    insert into public.team_component_definitions (team_id, code, label, category, is_required, tracks_hours, has_expiry, default_expiry_years, order_index)
    values
      (v_team_id, 'motore', 'Motore', 'base', true, true, false, null, 1),
      (v_team_id, 'forcella', 'Forcella', 'base', true, true, false, null, 2),
      (v_team_id, 'mono', 'Mono ammortizzatore', 'base', true, true, false, null, 3),
      (v_team_id, 'estintore_box', 'Estintore box', 'expiry', false, false, true, 2, 4),
      (v_team_id, 'passaporto', 'Passaporto tecnico', 'expiry', true, false, true, 10, 5);
  elseif coalesce(nullif(p_vehicle_type,''), 'auto') = 'kart' then
    insert into public.team_component_definitions (team_id, code, label, category, is_required, tracks_hours, has_expiry, default_expiry_years, order_index)
    values
      (v_team_id, 'motore', 'Motore', 'base', true, true, false, null, 1),
      (v_team_id, 'freni', 'Freni', 'base', true, true, false, null, 2),
      (v_team_id, 'sterzo', 'Sterzo', 'base', true, true, false, null, 3),
      (v_team_id, 'serbatoio', 'Serbatoio', 'expiry', false, false, true, 5, 4),
      (v_team_id, 'passaporto', 'Passaporto tecnico', 'expiry', true, false, true, 10, 5);
  else
    insert into public.team_component_definitions (team_id, code, label, category, is_required, tracks_hours, has_expiry, default_expiry_years, order_index)
    values
      (v_team_id, 'motore', 'Motore', 'base', true, true, false, null, 1),
      (v_team_id, 'cambio', 'Cambio', 'base', true, true, false, null, 2),
      (v_team_id, 'differenziale', 'Differenziale', 'base', true, true, false, null, 3),
      (v_team_id, 'cinture', 'Cinture di sicurezza', 'expiry', true, false, true, 5, 4),
      (v_team_id, 'cavi', 'Cavi ritenuta ruote', 'expiry', false, false, true, 2, 5),
      (v_team_id, 'estintore', 'Estintore', 'expiry', true, false, true, 2, 6),
      (v_team_id, 'serbatoio', 'Serbatoio', 'expiry', true, false, true, 5, 7),
      (v_team_id, 'passaporto', 'Passaporto tecnico', 'expiry', true, false, true, 10, 8);
  end if;

  insert into public.team_checklists (team_id, name, order_index)
  values
    (v_team_id, 'Sicurezza', 1),
    (v_team_id, 'Meccanica', 2),
    (v_team_id, 'Dinamica', 3),
    (v_team_id, 'Elettronica', 4);

  insert into public.team_checklist_items (team_id, checklist_id, label, input_type, is_required, order_index)
  select v_team_id, tc.id, items.label, 'status', true, items.order_index
  from public.team_checklists tc
  join (
    values
      ('Sicurezza', 'Serraggi', 1),
      ('Sicurezza', 'Freni', 2),
      ('Sicurezza', 'Ruote', 3),
      ('Meccanica', 'Liquidi', 1),
      ('Meccanica', 'Cambio', 2),
      ('Dinamica', 'Sospensioni', 1),
      ('Elettronica', 'Elettronica', 1)
  ) as items(group_name, label, order_index)
    on items.group_name = tc.name
  where tc.team_id = v_team_id;

  insert into public.app_permissions (code, label, description)
  values
    ('cars.view', 'Visualizza auto', 'Accesso modulo auto'),
    ('cars.edit', 'Modifica auto', 'Modifica anagrafiche auto'),
    ('components.view', 'Visualizza componenti', 'Accesso modulo componenti'),
    ('components.edit', 'Modifica componenti', 'Gestione componenti e revisioni'),
    ('events.view', 'Visualizza eventi', 'Accesso modulo eventi'),
    ('events.edit', 'Modifica eventi', 'Gestione weekend e sessioni'),
    ('settings.manage', 'Gestisci impostazioni', 'Accesso al control center')
  on conflict (code) do nothing;

  insert into public.role_permissions (role, permission_code)
  values
    ('owner', 'cars.view'), ('owner', 'cars.edit'), ('owner', 'components.view'), ('owner', 'components.edit'), ('owner', 'events.view'), ('owner', 'events.edit'), ('owner', 'settings.manage'),
    ('admin', 'cars.view'), ('admin', 'cars.edit'), ('admin', 'components.view'), ('admin', 'components.edit'), ('admin', 'events.view'), ('admin', 'events.edit'), ('admin', 'settings.manage'),
    ('engineer', 'cars.view'), ('engineer', 'components.view'), ('engineer', 'components.edit'), ('engineer', 'events.view'), ('engineer', 'events.edit'),
    ('mechanic', 'cars.view'), ('mechanic', 'components.view'), ('mechanic', 'components.edit'), ('mechanic', 'events.view'),
    ('viewer', 'cars.view'), ('viewer', 'components.view'), ('viewer', 'events.view')
  on conflict do nothing;

  return v_team_id;
end;
$$;

-- =========================================
-- TRIGGER TEAM_ID AUTO-FILL
-- =========================================
create trigger trg_app_settings_team_id before insert on public.app_settings for each row execute function public.set_team_id_from_auth();
create trigger trg_team_component_definitions_team_id before insert on public.team_component_definitions for each row execute function public.set_team_id_from_auth();
create trigger trg_team_checklists_team_id before insert on public.team_checklists for each row execute function public.set_team_id_from_auth();
create trigger trg_team_checklist_items_team_id before insert on public.team_checklist_items for each row execute function public.set_team_id_from_auth();
create trigger trg_cars_team_id before insert on public.cars for each row execute function public.set_team_id_from_auth();
create trigger trg_components_team_id before insert on public.components for each row execute function public.set_team_id_from_auth();
create trigger trg_car_components_team_id before insert on public.car_components for each row execute function public.set_team_id_from_auth();
create trigger trg_component_revisions_team_id before insert on public.component_revisions for each row execute function public.set_team_id_from_auth();
create trigger trg_maintenances_team_id before insert on public.maintenances for each row execute function public.set_team_id_from_auth();
create trigger trg_circuits_team_id before insert on public.circuits for each row execute function public.set_team_id_from_auth();
create trigger trg_events_team_id before insert on public.events for each row execute function public.set_team_id_from_auth();
create trigger trg_event_cars_team_id before insert on public.event_cars for each row execute function public.set_team_id_from_auth();
create trigger trg_event_sessions_team_id before insert on public.event_sessions for each row execute function public.set_team_id_from_auth();
create trigger trg_event_car_turns_team_id before insert on public.event_car_turns for each row execute function public.set_team_id_from_auth();
create trigger trg_event_car_data_team_id before insert on public.event_car_data for each row execute function public.set_team_id_from_auth();
create trigger trg_drivers_team_id before insert on public.drivers for each row execute function public.set_team_id_from_auth();
create trigger trg_driver_licenses_team_id before insert on public.driver_licenses for each row execute function public.set_team_id_from_auth();
create trigger trg_driver_documents_team_id before insert on public.driver_documents for each row execute function public.set_team_id_from_auth();
create trigger trg_driver_event_entries_team_id before insert on public.driver_event_entries for each row execute function public.set_team_id_from_auth();
create trigger trg_driver_session_performance_team_id before insert on public.driver_session_performance for each row execute function public.set_team_id_from_auth();
create trigger trg_inventory_items_team_id before insert on public.inventory_items for each row execute function public.set_team_id_from_auth();
create trigger trg_telemetry_files_team_id before insert on public.telemetry_files for each row execute function public.set_team_id_from_auth();
create trigger trg_document_templates_team_id before insert on public.document_templates for each row execute function public.set_team_id_from_auth();
create trigger trg_documents_team_id before insert on public.documents for each row execute function public.set_team_id_from_auth();

-- =========================================
-- RLS
-- =========================================
alter table public.teams enable row level security;
alter table public.team_users enable row level security;
alter table public.app_settings enable row level security;
alter table public.team_component_definitions enable row level security;
alter table public.team_checklists enable row level security;
alter table public.team_checklist_items enable row level security;
alter table public.cars enable row level security;
alter table public.components enable row level security;
alter table public.car_components enable row level security;
alter table public.component_revisions enable row level security;
alter table public.maintenances enable row level security;
alter table public.circuits enable row level security;
alter table public.events enable row level security;
alter table public.event_cars enable row level security;
alter table public.event_sessions enable row level security;
alter table public.event_car_turns enable row level security;
alter table public.event_car_data enable row level security;
alter table public.drivers enable row level security;
alter table public.driver_licenses enable row level security;
alter table public.driver_documents enable row level security;
alter table public.driver_event_entries enable row level security;
alter table public.driver_session_performance enable row level security;
alter table public.inventory_items enable row level security;
alter table public.telemetry_files enable row level security;
alter table public.document_templates enable row level security;
alter table public.documents enable row level security;

create policy teams_select on public.teams for select using (exists (select 1 from public.team_users tu where tu.team_id = id and tu.auth_user_id = auth.uid() and tu.is_active));
create policy team_users_select on public.team_users for select using (public.is_team_member(team_id));
create policy team_users_update_self on public.team_users for update using (auth_user_id = auth.uid()) with check (auth_user_id = auth.uid());
create policy team_users_insert_self on public.team_users for insert with check (auth_user_id = auth.uid());

create policy app_settings_select_team on public.app_settings for select using (public.is_team_member(team_id));
create policy app_settings_insert_team on public.app_settings for insert with check (public.is_team_member(team_id));
create policy app_settings_update_team on public.app_settings for update using (public.is_team_member(team_id)) with check (public.is_team_member(team_id));

create policy team_component_definitions_select on public.team_component_definitions for select using (public.is_team_member(team_id));
create policy team_component_definitions_insert on public.team_component_definitions for insert with check (public.is_team_member(team_id));
create policy team_component_definitions_update on public.team_component_definitions for update using (public.is_team_member(team_id)) with check (public.is_team_member(team_id));
create policy team_component_definitions_delete on public.team_component_definitions for delete using (public.is_team_member(team_id));

create policy team_checklists_select on public.team_checklists for select using (public.is_team_member(team_id));
create policy team_checklists_insert on public.team_checklists for insert with check (public.is_team_member(team_id));
create policy team_checklists_update on public.team_checklists for update using (public.is_team_member(team_id)) with check (public.is_team_member(team_id));
create policy team_checklists_delete on public.team_checklists for delete using (public.is_team_member(team_id));

create policy team_checklist_items_select on public.team_checklist_items for select using (public.is_team_member(team_id));
create policy team_checklist_items_insert on public.team_checklist_items for insert with check (public.is_team_member(team_id));
create policy team_checklist_items_update on public.team_checklist_items for update using (public.is_team_member(team_id)) with check (public.is_team_member(team_id));
create policy team_checklist_items_delete on public.team_checklist_items for delete using (public.is_team_member(team_id));

create policy cars_select_team on public.cars for select using (public.is_team_member(team_id));
create policy cars_insert_team on public.cars for insert with check (public.is_team_member(team_id));
create policy cars_update_team on public.cars for update using (public.is_team_member(team_id)) with check (public.is_team_member(team_id));
create policy cars_delete_team on public.cars for delete using (public.is_team_member(team_id));

create policy components_select_team on public.components for select using (public.is_team_member(team_id));
create policy components_insert_team on public.components for insert with check (public.is_team_member(team_id));
create policy components_update_team on public.components for update using (public.is_team_member(team_id)) with check (public.is_team_member(team_id));
create policy components_delete_team on public.components for delete using (public.is_team_member(team_id));

create policy car_components_select_team on public.car_components for select using (public.is_team_member(team_id));
create policy car_components_insert_team on public.car_components for insert with check (public.is_team_member(team_id));
create policy car_components_update_team on public.car_components for update using (public.is_team_member(team_id)) with check (public.is_team_member(team_id));
create policy car_components_delete_team on public.car_components for delete using (public.is_team_member(team_id));

create policy component_revisions_select_team on public.component_revisions for select using (public.is_team_member(team_id));
create policy component_revisions_insert_team on public.component_revisions for insert with check (public.is_team_member(team_id));
create policy component_revisions_update_team on public.component_revisions for update using (public.is_team_member(team_id)) with check (public.is_team_member(team_id));
create policy component_revisions_delete_team on public.component_revisions for delete using (public.is_team_member(team_id));

create policy maintenances_select_team on public.maintenances for select using (public.is_team_member(team_id));
create policy maintenances_insert_team on public.maintenances for insert with check (public.is_team_member(team_id));
create policy maintenances_update_team on public.maintenances for update using (public.is_team_member(team_id)) with check (public.is_team_member(team_id));
create policy maintenances_delete_team on public.maintenances for delete using (public.is_team_member(team_id));

create policy circuits_select_team on public.circuits for select using (public.is_team_member(team_id));
create policy circuits_insert_team on public.circuits for insert with check (public.is_team_member(team_id));
create policy circuits_update_team on public.circuits for update using (public.is_team_member(team_id)) with check (public.is_team_member(team_id));
create policy circuits_delete_team on public.circuits for delete using (public.is_team_member(team_id));

create policy events_select_team on public.events for select using (public.is_team_member(team_id));
create policy events_insert_team on public.events for insert with check (public.is_team_member(team_id));
create policy events_update_team on public.events for update using (public.is_team_member(team_id)) with check (public.is_team_member(team_id));
create policy events_delete_team on public.events for delete using (public.is_team_member(team_id));

create policy event_cars_select_team on public.event_cars for select using (public.is_team_member(team_id));
create policy event_cars_insert_team on public.event_cars for insert with check (public.is_team_member(team_id));
create policy event_cars_update_team on public.event_cars for update using (public.is_team_member(team_id)) with check (public.is_team_member(team_id));
create policy event_cars_delete_team on public.event_cars for delete using (public.is_team_member(team_id));

create policy event_sessions_select_team on public.event_sessions for select using (public.is_team_member(team_id));
create policy event_sessions_insert_team on public.event_sessions for insert with check (public.is_team_member(team_id));
create policy event_sessions_update_team on public.event_sessions for update using (public.is_team_member(team_id)) with check (public.is_team_member(team_id));
create policy event_sessions_delete_team on public.event_sessions for delete using (public.is_team_member(team_id));

create policy event_car_turns_select_team on public.event_car_turns for select using (public.is_team_member(team_id));
create policy event_car_turns_insert_team on public.event_car_turns for insert with check (public.is_team_member(team_id));
create policy event_car_turns_update_team on public.event_car_turns for update using (public.is_team_member(team_id)) with check (public.is_team_member(team_id));
create policy event_car_turns_delete_team on public.event_car_turns for delete using (public.is_team_member(team_id));

create policy event_car_data_select_team on public.event_car_data for select using (public.is_team_member(team_id));
create policy event_car_data_insert_team on public.event_car_data for insert with check (public.is_team_member(team_id));
create policy event_car_data_update_team on public.event_car_data for update using (public.is_team_member(team_id)) with check (public.is_team_member(team_id));
create policy event_car_data_delete_team on public.event_car_data for delete using (public.is_team_member(team_id));

create policy drivers_select_team on public.drivers for select using (public.is_team_member(team_id));
create policy drivers_insert_team on public.drivers for insert with check (public.is_team_member(team_id));
create policy drivers_update_team on public.drivers for update using (public.is_team_member(team_id)) with check (public.is_team_member(team_id));
create policy drivers_delete_team on public.drivers for delete using (public.is_team_member(team_id));

create policy driver_licenses_select_team on public.driver_licenses for select using (public.is_team_member(team_id));
create policy driver_licenses_insert_team on public.driver_licenses for insert with check (public.is_team_member(team_id));
create policy driver_licenses_update_team on public.driver_licenses for update using (public.is_team_member(team_id)) with check (public.is_team_member(team_id));
create policy driver_licenses_delete_team on public.driver_licenses for delete using (public.is_team_member(team_id));

create policy driver_documents_select_team on public.driver_documents for select using (public.is_team_member(team_id));
create policy driver_documents_insert_team on public.driver_documents for insert with check (public.is_team_member(team_id));
create policy driver_documents_update_team on public.driver_documents for update using (public.is_team_member(team_id)) with check (public.is_team_member(team_id));
create policy driver_documents_delete_team on public.driver_documents for delete using (public.is_team_member(team_id));

create policy driver_event_entries_select_team on public.driver_event_entries for select using (public.is_team_member(team_id));
create policy driver_event_entries_insert_team on public.driver_event_entries for insert with check (public.is_team_member(team_id));
create policy driver_event_entries_update_team on public.driver_event_entries for update using (public.is_team_member(team_id)) with check (public.is_team_member(team_id));
create policy driver_event_entries_delete_team on public.driver_event_entries for delete using (public.is_team_member(team_id));

create policy driver_session_performance_select_team on public.driver_session_performance for select using (public.is_team_member(team_id));
create policy driver_session_performance_insert_team on public.driver_session_performance for insert with check (public.is_team_member(team_id));
create policy driver_session_performance_update_team on public.driver_session_performance for update using (public.is_team_member(team_id)) with check (public.is_team_member(team_id));
create policy driver_session_performance_delete_team on public.driver_session_performance for delete using (public.is_team_member(team_id));

create policy inventory_items_select_team on public.inventory_items for select using (public.is_team_member(team_id));
create policy inventory_items_insert_team on public.inventory_items for insert with check (public.is_team_member(team_id));
create policy inventory_items_update_team on public.inventory_items for update using (public.is_team_member(team_id)) with check (public.is_team_member(team_id));
create policy inventory_items_delete_team on public.inventory_items for delete using (public.is_team_member(team_id));

create policy telemetry_files_select_team on public.telemetry_files for select using (public.is_team_member(team_id));
create policy telemetry_files_insert_team on public.telemetry_files for insert with check (public.is_team_member(team_id));
create policy telemetry_files_update_team on public.telemetry_files for update using (public.is_team_member(team_id)) with check (public.is_team_member(team_id));
create policy telemetry_files_delete_team on public.telemetry_files for delete using (public.is_team_member(team_id));

create policy document_templates_select_team on public.document_templates for select using (public.is_team_member(team_id));
create policy document_templates_insert_team on public.document_templates for insert with check (public.is_team_member(team_id));
create policy document_templates_update_team on public.document_templates for update using (public.is_team_member(team_id)) with check (public.is_team_member(team_id));
create policy document_templates_delete_team on public.document_templates for delete using (public.is_team_member(team_id));

create policy documents_select_team on public.documents for select using (public.is_team_member(team_id));
create policy documents_insert_team on public.documents for insert with check (public.is_team_member(team_id));
create policy documents_update_team on public.documents for update using (public.is_team_member(team_id)) with check (public.is_team_member(team_id));
create policy documents_delete_team on public.documents for delete using (public.is_team_member(team_id));
