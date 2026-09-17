-- P2.9.5.2.1 - Multi-Car Routing Foundation
-- Foundation only: no automatic routing/import is enabled by this migration.

begin;

-- Existing connected devices remain backward compatible.
alter table public.connected_devices
  add column if not exists routing_mode text not null default 'fixed_car';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'connected_devices_routing_mode_check'
      and conrelid = 'public.connected_devices'::regclass
  ) then
    alter table public.connected_devices
      add constraint connected_devices_routing_mode_check
      check (routing_mode in ('fixed_car','assignment_history'));
  end if;
end $$;

-- One Windows bridge installation can serve multiple logger devices for one team.
create table if not exists public.connected_bridges (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  name text not null,
  provider text not null default 'aim_race_studio',
  installation_id text not null default gen_random_uuid()::text,
  machine_name text,
  status text not null default 'active',
  last_seen_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint connected_bridges_status_check check (status in ('active','disabled','revoked')),
  constraint connected_bridges_team_installation_unique unique (team_id, installation_id)
);

-- Bridge credentials mirror the existing connected_device_keys model.
-- No client RLS policies are intentionally created for this table.
create table if not exists public.connected_bridge_keys (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  bridge_id uuid not null references public.connected_bridges(id) on delete cascade,
  key_prefix text not null,
  key_hash text not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz
);

create index if not exists connected_bridge_keys_prefix_idx
  on public.connected_bridge_keys(key_prefix);
create index if not exists connected_bridge_keys_bridge_idx
  on public.connected_bridge_keys(bridge_id)
  where revoked_at is null;

-- Explicit allow-list: which physical/logical logger devices a bridge may route to.
create table if not exists public.connected_bridge_devices (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  bridge_id uuid not null references public.connected_bridges(id) on delete cascade,
  device_id uuid not null references public.connected_devices(id) on delete cascade,
  enabled boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint connected_bridge_devices_unique unique (bridge_id, device_id)
);

create index if not exists connected_bridge_devices_team_idx
  on public.connected_bridge_devices(team_id, bridge_id, enabled);
create index if not exists connected_bridge_devices_device_idx
  on public.connected_bridge_devices(device_id, enabled);

-- Historical mapping of a logger device to a car.
-- valid_to is exclusive. NULL means the assignment is still open/current.
create table if not exists public.connected_device_car_assignments (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  device_id uuid not null references public.connected_devices(id) on delete cascade,
  car_id uuid not null references public.cars(id) on delete cascade,
  valid_from timestamptz not null default now(),
  valid_to timestamptz,
  source text not null default 'manual',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint connected_device_car_assignments_range_check
    check (valid_to is null or valid_to > valid_from),
  constraint connected_device_car_assignments_source_check
    check (source in ('manual','bridge_setup','resolver','migration','api'))
);

create index if not exists connected_device_car_assignments_lookup_idx
  on public.connected_device_car_assignments(team_id, device_id, valid_from, valid_to);
create index if not exists connected_device_car_assignments_car_idx
  on public.connected_device_car_assignments(team_id, car_id, valid_from, valid_to);
create unique index if not exists connected_device_car_assignments_one_open_idx
  on public.connected_device_car_assignments(device_id)
  where valid_to is null;

-- Race Studio / provider aliases identify the vehicle profile, not the logger hardware.
-- They are date-aware so names/profiles may be reassigned safely in the future.
create table if not exists public.connected_vehicle_aliases (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  provider text not null default 'aim_race_studio',
  alias_type text not null default 'vehicle_profile',
  alias_value text not null,
  alias_normalized text not null,
  car_id uuid not null references public.cars(id) on delete cascade,
  valid_from timestamptz not null default now(),
  valid_to timestamptz,
  source text not null default 'manual',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint connected_vehicle_aliases_range_check
    check (valid_to is null or valid_to > valid_from),
  constraint connected_vehicle_aliases_type_check
    check (alias_type in ('vehicle_profile','vehicle_name','chassis','custom')),
  constraint connected_vehicle_aliases_source_check
    check (source in ('manual','bridge_setup','resolver','migration','api'))
);

create index if not exists connected_vehicle_aliases_lookup_idx
  on public.connected_vehicle_aliases(team_id, provider, alias_type, alias_normalized, valid_from, valid_to);
create index if not exists connected_vehicle_aliases_car_idx
  on public.connected_vehicle_aliases(team_id, car_id);
create unique index if not exists connected_vehicle_aliases_one_open_idx
  on public.connected_vehicle_aliases(team_id, provider, alias_type, alias_normalized)
  where valid_to is null;

-- Normalization is intentionally simple and deterministic.
create or replace function public.normalize_connected_routing_text(p_value text)
returns text
language sql
immutable
set search_path = public
as $$
  select nullif(lower(btrim(coalesce(p_value,''))), '');
$$;

create or replace function public.trg_connected_vehicle_alias_normalize()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.alias_normalized := public.normalize_connected_routing_text(new.alias_value);
  if new.alias_normalized is null then
    raise exception 'alias_value non può essere vuoto';
  end if;
  return new;
end;
$$;

-- Team-consistency checks keep cross-team references impossible even for service-side writes.
create or replace function public.trg_connected_routing_validate_team_refs()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_team uuid;
begin
  if tg_table_name = 'connected_bridge_devices' then
    select team_id into v_team from public.connected_bridges where id = new.bridge_id;
    if v_team is distinct from new.team_id then
      raise exception 'Bridge non appartenente al team';
    end if;
    select team_id into v_team from public.connected_devices where id = new.device_id;
    if v_team is distinct from new.team_id then
      raise exception 'Device non appartenente al team';
    end if;

  elsif tg_table_name = 'connected_device_car_assignments' then
    select team_id into v_team from public.connected_devices where id = new.device_id;
    if v_team is distinct from new.team_id then
      raise exception 'Device non appartenente al team';
    end if;
    select team_id into v_team from public.cars where id = new.car_id;
    if v_team is distinct from new.team_id then
      raise exception 'Vettura non appartenente al team';
    end if;

  elsif tg_table_name = 'connected_vehicle_aliases' then
    select team_id into v_team from public.cars where id = new.car_id;
    if v_team is distinct from new.team_id then
      raise exception 'Vettura non appartenente al team';
    end if;

  elsif tg_table_name = 'connected_bridge_keys' then
    select team_id into v_team from public.connected_bridges where id = new.bridge_id;
    if v_team is distinct from new.team_id then
      raise exception 'Bridge key non appartenente al team';
    end if;
  end if;

  return new;
end;
$$;

-- No logger may be assigned to two cars at the same instant.
create or replace function public.trg_connected_assignment_no_overlap()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.connected_device_car_assignments a
    where a.device_id = new.device_id
      and a.id <> coalesce(new.id, gen_random_uuid())
      and a.valid_from < coalesce(new.valid_to, 'infinity'::timestamptz)
      and new.valid_from < coalesce(a.valid_to, 'infinity'::timestamptz)
  ) then
    raise exception 'Il logger ha già un''assegnazione vettura sovrapposta nell''intervallo richiesto';
  end if;
  return new;
end;
$$;

-- The same provider alias may not point to two cars at the same instant.
create or replace function public.trg_connected_vehicle_alias_no_overlap()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.connected_vehicle_aliases a
    where a.team_id = new.team_id
      and a.provider = new.provider
      and a.alias_type = new.alias_type
      and a.alias_normalized = new.alias_normalized
      and a.id <> coalesce(new.id, gen_random_uuid())
      and a.valid_from < coalesce(new.valid_to, 'infinity'::timestamptz)
      and new.valid_from < coalesce(a.valid_to, 'infinity'::timestamptz)
  ) then
    raise exception 'Alias Vehicle già assegnato a una vettura nello stesso intervallo';
  end if;
  return new;
end;
$$;

-- Updated-at triggers.
drop trigger if exists trg_connected_bridges_updated_at on public.connected_bridges;
create trigger trg_connected_bridges_updated_at
before update on public.connected_bridges
for each row execute function public.set_connected_updated_at();

drop trigger if exists trg_connected_bridge_devices_updated_at on public.connected_bridge_devices;
create trigger trg_connected_bridge_devices_updated_at
before update on public.connected_bridge_devices
for each row execute function public.set_connected_updated_at();

drop trigger if exists trg_connected_device_car_assignments_updated_at on public.connected_device_car_assignments;
create trigger trg_connected_device_car_assignments_updated_at
before update on public.connected_device_car_assignments
for each row execute function public.set_connected_updated_at();

drop trigger if exists trg_connected_vehicle_aliases_updated_at on public.connected_vehicle_aliases;
create trigger trg_connected_vehicle_aliases_updated_at
before update on public.connected_vehicle_aliases
for each row execute function public.set_connected_updated_at();

-- Normalization + integrity triggers.
drop trigger if exists trg_connected_vehicle_alias_normalize on public.connected_vehicle_aliases;
create trigger trg_connected_vehicle_alias_normalize
before insert or update of alias_value on public.connected_vehicle_aliases
for each row execute function public.trg_connected_vehicle_alias_normalize();

drop trigger if exists trg_connected_bridge_devices_team_refs on public.connected_bridge_devices;
create trigger trg_connected_bridge_devices_team_refs
before insert or update on public.connected_bridge_devices
for each row execute function public.trg_connected_routing_validate_team_refs();

drop trigger if exists trg_connected_bridge_keys_team_refs on public.connected_bridge_keys;
create trigger trg_connected_bridge_keys_team_refs
before insert or update on public.connected_bridge_keys
for each row execute function public.trg_connected_routing_validate_team_refs();

drop trigger if exists trg_connected_assignment_team_refs on public.connected_device_car_assignments;
create trigger trg_connected_assignment_team_refs
before insert or update on public.connected_device_car_assignments
for each row execute function public.trg_connected_routing_validate_team_refs();

drop trigger if exists trg_connected_alias_team_refs on public.connected_vehicle_aliases;
create trigger trg_connected_alias_team_refs
before insert or update on public.connected_vehicle_aliases
for each row execute function public.trg_connected_routing_validate_team_refs();

drop trigger if exists trg_connected_assignment_no_overlap on public.connected_device_car_assignments;
create trigger trg_connected_assignment_no_overlap
before insert or update on public.connected_device_car_assignments
for each row execute function public.trg_connected_assignment_no_overlap();

drop trigger if exists trg_connected_vehicle_alias_no_overlap on public.connected_vehicle_aliases;
create trigger trg_connected_vehicle_alias_no_overlap
before insert or update on public.connected_vehicle_aliases
for each row execute function public.trg_connected_vehicle_alias_no_overlap();

-- RLS.
alter table public.connected_bridges enable row level security;
alter table public.connected_bridge_keys enable row level security;
alter table public.connected_bridge_devices enable row level security;
alter table public.connected_device_car_assignments enable row level security;
alter table public.connected_vehicle_aliases enable row level security;

-- Bridge keys intentionally have no authenticated client policies, mirroring connected_device_keys.

create policy connected_bridges_select_permission
on public.connected_bridges for select
using (public.has_team_permission(team_id,'devices.view'));
create policy connected_bridges_insert_permission
on public.connected_bridges for insert
with check (public.has_team_permission(team_id,'devices.edit'));
create policy connected_bridges_update_permission
on public.connected_bridges for update
using (public.has_team_permission(team_id,'devices.edit'))
with check (public.has_team_permission(team_id,'devices.edit'));
create policy connected_bridges_delete_permission
on public.connected_bridges for delete
using (public.has_team_permission(team_id,'devices.edit'));

create policy connected_bridge_devices_select_permission
on public.connected_bridge_devices for select
using (public.has_team_permission(team_id,'devices.view'));
create policy connected_bridge_devices_insert_permission
on public.connected_bridge_devices for insert
with check (public.has_team_permission(team_id,'devices.edit'));
create policy connected_bridge_devices_update_permission
on public.connected_bridge_devices for update
using (public.has_team_permission(team_id,'devices.edit'))
with check (public.has_team_permission(team_id,'devices.edit'));
create policy connected_bridge_devices_delete_permission
on public.connected_bridge_devices for delete
using (public.has_team_permission(team_id,'devices.edit'));

create policy connected_device_car_assignments_select_permission
on public.connected_device_car_assignments for select
using (public.has_team_permission(team_id,'devices.view'));
create policy connected_device_car_assignments_insert_permission
on public.connected_device_car_assignments for insert
with check (public.has_team_permission(team_id,'devices.edit'));
create policy connected_device_car_assignments_update_permission
on public.connected_device_car_assignments for update
using (public.has_team_permission(team_id,'devices.edit'))
with check (public.has_team_permission(team_id,'devices.edit'));
create policy connected_device_car_assignments_delete_permission
on public.connected_device_car_assignments for delete
using (public.has_team_permission(team_id,'devices.edit'));

create policy connected_vehicle_aliases_select_permission
on public.connected_vehicle_aliases for select
using (public.has_team_permission(team_id,'devices.view'));
create policy connected_vehicle_aliases_insert_permission
on public.connected_vehicle_aliases for insert
with check (public.has_team_permission(team_id,'devices.edit'));
create policy connected_vehicle_aliases_update_permission
on public.connected_vehicle_aliases for update
using (public.has_team_permission(team_id,'devices.edit'))
with check (public.has_team_permission(team_id,'devices.edit'));
create policy connected_vehicle_aliases_delete_permission
on public.connected_vehicle_aliases for delete
using (public.has_team_permission(team_id,'devices.edit'));

commit;
