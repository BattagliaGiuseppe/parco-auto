-- Sprint Piloti + Fuel
-- 1) Foto profilo pilota
-- 2) Checklist sicurezza pilota
-- Patch idempotente

alter table public.drivers
  add column if not exists photo_url text;

create table if not exists public.driver_safety_items (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  driver_id uuid not null references public.drivers(id) on delete cascade,
  item_name text not null,
  homologation text,
  expiry_date date,
  note text,
  is_present boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_driver_safety_items_driver_id
  on public.driver_safety_items(driver_id);

create index if not exists idx_driver_safety_items_team_driver
  on public.driver_safety_items(team_id, driver_id);

alter table public.driver_safety_items enable row level security;

drop policy if exists driver_safety_items_select_team on public.driver_safety_items;
create policy driver_safety_items_select_team
on public.driver_safety_items
for select
using (public.is_team_member(team_id));

drop policy if exists driver_safety_items_insert_team on public.driver_safety_items;
create policy driver_safety_items_insert_team
on public.driver_safety_items
for insert
with check (public.is_team_member(team_id));

drop policy if exists driver_safety_items_update_team on public.driver_safety_items;
create policy driver_safety_items_update_team
on public.driver_safety_items
for update
using (public.is_team_member(team_id))
with check (public.is_team_member(team_id));

drop policy if exists driver_safety_items_delete_team on public.driver_safety_items;
create policy driver_safety_items_delete_team
on public.driver_safety_items
for delete
using (public.is_team_member(team_id));
