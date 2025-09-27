create table if not exists cars (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamp default now()
);

create table if not exists components (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  identifier text not null unique,
  homologation text,
  expiry_date date,
  created_at timestamp default now()
);

create table if not exists maintenances (
  id uuid primary key default gen_random_uuid(),
  car_id uuid references cars(id) on delete cascade,
  component_id uuid references components(id) on delete set null,
  description text,
  performed_at timestamp default now()
);
