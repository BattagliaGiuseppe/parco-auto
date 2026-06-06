-- =========================================
-- PARCO AUTO · TEAM & ACCESSI PATCH
-- Da eseguire sul database live prima di usare
-- il modulo /settings/team
-- =========================================

create or replace function public.is_team_member(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.team_users tu
    where tu.team_id = p_team_id
      and tu.auth_user_id = auth.uid()
      and tu.is_active = true
  )
$$;

create or replace function public.is_team_manager(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.team_users tu
    where tu.team_id = p_team_id
      and tu.auth_user_id = auth.uid()
      and tu.is_active = true
      and tu.role in ('owner', 'admin')
  )
$$;

alter table public.app_permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.team_user_permissions enable row level security;

-- team_users
 drop policy if exists team_users_select on public.team_users;
drop policy if exists team_users_update_team_manager on public.team_users;

create policy team_users_select
on public.team_users
for select
using (
  auth.uid() = auth_user_id
  or public.is_team_member(team_id)
);

create policy team_users_update_team_manager
on public.team_users
for update
using (public.is_team_manager(team_id))
with check (public.is_team_manager(team_id));

-- catalogo permessi
 drop policy if exists app_permissions_select_authenticated on public.app_permissions;
drop policy if exists role_permissions_select_authenticated on public.role_permissions;

create policy app_permissions_select_authenticated
on public.app_permissions
for select
using (auth.uid() is not null);

create policy role_permissions_select_authenticated
on public.role_permissions
for select
using (auth.uid() is not null);

-- override per membro
 drop policy if exists team_user_permissions_select_team on public.team_user_permissions;
drop policy if exists team_user_permissions_insert_team on public.team_user_permissions;
drop policy if exists team_user_permissions_update_team on public.team_user_permissions;
drop policy if exists team_user_permissions_delete_team on public.team_user_permissions;

create policy team_user_permissions_select_team
on public.team_user_permissions
for select
using (
  exists (
    select 1
    from public.team_users tu
    where tu.id = team_user_permissions.team_user_id
      and (
        public.is_team_manager(tu.team_id)
        or tu.auth_user_id = auth.uid()
      )
  )
);

create policy team_user_permissions_insert_team
on public.team_user_permissions
for insert
with check (
  exists (
    select 1
    from public.team_users tu
    where tu.id = team_user_permissions.team_user_id
      and public.is_team_manager(tu.team_id)
  )
);

create policy team_user_permissions_update_team
on public.team_user_permissions
for update
using (
  exists (
    select 1
    from public.team_users tu
    where tu.id = team_user_permissions.team_user_id
      and public.is_team_manager(tu.team_id)
  )
)
with check (
  exists (
    select 1
    from public.team_users tu
    where tu.id = team_user_permissions.team_user_id
      and public.is_team_manager(tu.team_id)
  )
);

create policy team_user_permissions_delete_team
on public.team_user_permissions
for delete
using (
  exists (
    select 1
    from public.team_users tu
    where tu.id = team_user_permissions.team_user_id
      and public.is_team_manager(tu.team_id)
  )
);
