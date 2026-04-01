-- =========================================
-- WORLDCLASS FOUNDATION MIGRATION
-- Backup baseline: 10 marzo
-- Obiettivo: attivare moduli Piloti, Performance,
-- Magazzino e Telemetria senza rompere il core.
-- =========================================

-- 1) Arricchimento tabelle core
alter table if exists cars
  add column if not exists hours numeric,
  add column if not exists notes text;

alter table if exists components
  add column if not exists hours numeric,
  add column if not exists life_hours numeric,
  add column if not exists warning_threshold_hours numeric,
  add column if not exists revision_threshold_hours numeric,
  add column if not exists notes text;

alter table if exists maintenances
  add column if not exists car_id uuid references cars(id) on delete set null,
  add column if not exists status text default 'completed',
  add column if not exists priority text default 'medium',
  add column if not exists notes text;

alter table if exists car_components
  rename column installed_at to mounted_at;

-- 2) Piloti
create table if not exists drivers (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  nickname text,
  email text,
  phone text,
  notes text,
  is_active boolean default true,
  created_at timestamp default now()
);

create table if not exists driver_licenses (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references drivers(id) on delete cascade,
  license_type text not null,
  license_number text,
  expiry_date date,
  created_at timestamp default now()
);

create table if not exists driver_documents (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references drivers(id) on delete cascade,
  title text,
  document_type text,
  expires_at date,
  file_url text,
  created_at timestamp default now()
);

create table if not exists driver_session_performance (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references drivers(id) on delete cascade,
  session_name text,
  event_name text,
  car_name text,
  best_lap_time text,
  average_lap_time text,
  consistency numeric,
  incidents integer default 0,
  notes text,
  created_at timestamp default now()
);

-- 3) Magazzino
create table if not exists inventory_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  quantity integer default 0,
  location text,
  created_at timestamp default now()
);

-- 4) Telemetria
create table if not exists telemetry_files (
  id uuid primary key default gen_random_uuid(),
  file_name text,
  file_url text,
  created_at timestamp default now()
);

-- 5) Indici essenziali
create index if not exists idx_components_type on components(type);
create index if not exists idx_components_status on components(status);
create index if not exists idx_maintenances_component_id on maintenances(component_id);
create index if not exists idx_driver_licenses_driver_id on driver_licenses(driver_id);
create index if not exists idx_driver_documents_driver_id on driver_documents(driver_id);
create index if not exists idx_driver_performance_driver_id on driver_session_performance(driver_id);
