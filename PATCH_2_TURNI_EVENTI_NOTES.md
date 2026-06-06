-- =========================================
-- PARCO AUTO · TASK & PROMEMORIA PATCH
-- Modulo attività collegate ad auto, componenti, eventi, magazzino e piloti
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

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null,
  title text not null,
  description text,
  area text not null default 'team',
  status text not null default 'todo',
  priority text not null default 'medium',
  due_date date,
  assigned_to_team_user_id uuid references public.team_users(id) on delete set null,
  car_id uuid references public.cars(id) on delete set null,
  component_id uuid references public.components(id) on delete set null,
  event_id uuid references public.events(id) on delete set null,
  maintenance_id uuid references public.maintenances(id) on delete set null,
  inventory_item_id uuid references public.inventory_items(id) on delete set null,
  driver_id uuid references public.drivers(id) on delete set null,
  created_by_team_user_id uuid references public.team_users(id) on delete set null,
  created_by_auth_user_id uuid default auth.uid(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tasks_area_check check (area in ('auto','componenti','manutenzioni','magazzino','eventi','piloti','team','amministrazione','altro')),
  constraint tasks_status_check check (status in ('todo','in_progress','waiting','done','cancelled')),
  constraint tasks_priority_check check (priority in ('low','medium','high','urgent'))
);

create index if not exists idx_tasks_team_status on public.tasks(team_id, status);
create index if not exists idx_tasks_team_due_date on public.tasks(team_id, due_date);
create index if not exists idx_tasks_team_car on public.tasks(team_id, car_id);
create index if not exists idx_tasks_team_assignee on public.tasks(team_id, assigned_to_team_user_id);
create index if not exists idx_tasks_team_area on public.tasks(team_id, area);

drop trigger if exists trg_set_updated_at_tasks on public.tasks;
create trigger trg_set_updated_at_tasks
before update on public.tasks
for each row execute function public.set_updated_at();

create table if not exists public.task_comments (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null,
  task_id uuid not null references public.tasks(id) on delete cascade,
  author_team_user_id uuid references public.team_users(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_task_comments_task on public.task_comments(task_id, created_at desc);

create table if not exists public.task_checklist_items (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null,
  task_id uuid not null references public.tasks(id) on delete cascade,
  label text not null,
  is_done boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_task_checklist_items_task on public.task_checklist_items(task_id, sort_order);

drop trigger if exists trg_set_updated_at_task_checklist_items on public.task_checklist_items;
create trigger trg_set_updated_at_task_checklist_items
before update on public.task_checklist_items
for each row execute function public.set_updated_at();

alter table public.tasks enable row level security;
alter table public.task_comments enable row level security;
alter table public.task_checklist_items enable row level security;

-- Tasks
 drop policy if exists tasks_select_team on public.tasks;
drop policy if exists tasks_insert_team on public.tasks;
drop policy if exists tasks_update_team on public.tasks;
drop policy if exists tasks_delete_team_manager on public.tasks;

create policy tasks_select_team
on public.tasks
for select
using (public.is_team_member(team_id));

create policy tasks_insert_team
on public.tasks
for insert
with check (public.is_team_member(team_id));

create policy tasks_update_team
on public.tasks
for update
using (public.is_team_member(team_id))
with check (public.is_team_member(team_id));

create policy tasks_delete_team_manager
on public.tasks
for delete
using (public.is_team_manager(team_id));

-- Comments
 drop policy if exists task_comments_select_team on public.task_comments;
drop policy if exists task_comments_insert_team on public.task_comments;
drop policy if exists task_comments_update_manager on public.task_comments;
drop policy if exists task_comments_delete_manager on public.task_comments;

create policy task_comments_select_team
on public.task_comments
for select
using (public.is_team_member(team_id));

create policy task_comments_insert_team
on public.task_comments
for insert
with check (public.is_team_member(team_id));

create policy task_comments_update_manager
on public.task_comments
for update
using (public.is_team_manager(team_id))
with check (public.is_team_manager(team_id));

create policy task_comments_delete_manager
on public.task_comments
for delete
using (public.is_team_manager(team_id));

-- Checklist
 drop policy if exists task_checklist_items_select_team on public.task_checklist_items;
drop policy if exists task_checklist_items_insert_team on public.task_checklist_items;
drop policy if exists task_checklist_items_update_team on public.task_checklist_items;
drop policy if exists task_checklist_items_delete_team on public.task_checklist_items;

create policy task_checklist_items_select_team
on public.task_checklist_items
for select
using (public.is_team_member(team_id));

create policy task_checklist_items_insert_team
on public.task_checklist_items
for insert
with check (public.is_team_member(team_id));

create policy task_checklist_items_update_team
on public.task_checklist_items
for update
using (public.is_team_member(team_id))
with check (public.is_team_member(team_id));

create policy task_checklist_items_delete_team
on public.task_checklist_items
for delete
using (public.is_team_member(team_id));

-- Permessi applicativi
insert into public.app_permissions (code, label, description)
values
  ('tasks.view', 'Visualizza attività', 'Accesso al modulo attività e promemoria'),
  ('tasks.edit', 'Gestisci attività', 'Creazione e modifica attività e promemoria'),
  ('tasks.assign', 'Assegna attività', 'Assegnazione attività ai membri del team'),
  ('tasks.delete', 'Elimina attività', 'Eliminazione attività e promemoria')
on conflict (code) do update
set label = excluded.label,
    description = excluded.description;

insert into public.role_permissions (role, permission_code)
values
  ('owner', 'tasks.view'),
  ('owner', 'tasks.edit'),
  ('owner', 'tasks.assign'),
  ('owner', 'tasks.delete'),
  ('admin', 'tasks.view'),
  ('admin', 'tasks.edit'),
  ('admin', 'tasks.assign'),
  ('admin', 'tasks.delete'),
  ('engineer', 'tasks.view'),
  ('engineer', 'tasks.edit'),
  ('engineer', 'tasks.assign'),
  ('mechanic', 'tasks.view'),
  ('mechanic', 'tasks.edit'),
  ('viewer', 'tasks.view')
on conflict do nothing;

-- Attiva il modulo attività nelle impostazioni esistenti, senza alterare le altre preferenze.
update public.app_settings
set modules = coalesce(modules, '{}'::jsonb) || '{"tasks": true}'::jsonb
where modules is null or not (modules ? 'tasks');
