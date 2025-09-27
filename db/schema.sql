-- Tabella Auto
create table if not exists cars (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  chassis_number text unique,
  created_at timestamp default now()
);

-- Tabella Componenti
create table if not exists components (
  id uuid primary key default gen_random_uuid(),
  type text not null,                -- motore, cambio, differenziale, serbatoio, ecc.
  identifier text not null unique,   -- numero identificativo
  homologation text,                 -- tipo di omologazione (solo per alcuni componenti)
  expiry_date date,                  -- scadenza (solo per alcuni componenti)
  status text default 'magazzino',   -- magazzino | installato
  created_at timestamp default now()
);

-- Storico installazioni
create table if not exists car_components (
  car_id uuid references cars(id) on delete cascade,
  component_id uuid references components(id) on delete cascade,
  installed_at timestamp default now(),
  removed_at timestamp,
  primary key (car_id, component_id, installed_at)
);

-- Storico manutenzioni
create table if not exists maintenances (
  id uuid primary key default gen_random_uuid(),
  component_id uuid references components(id) on delete cascade,
  description text,
  performed_at timestamp default now()
);
