-- P0-E.2B: Settings and team governance permissions.

-- Settings tables: everyone in the team may read configuration, but only settings.manage may write.
do $$
declare r record;
begin
  for r in select * from (values
    ('app_settings'),
    ('team_component_definitions'),
    ('team_checklists'),
    ('team_checklist_items'),
    ('team_setup_fields'),
    ('team_dashboard_widgets')
  ) x(table_name)
  loop
    execute format('drop policy if exists %I on public.%I', r.table_name||'_insert_manager', r.table_name);
    execute format('drop policy if exists %I on public.%I', r.table_name||'_update_manager', r.table_name);
    execute format('drop policy if exists %I on public.%I', r.table_name||'_delete_manager', r.table_name);
    execute format('drop policy if exists %I on public.%I', r.table_name||'_insert_permission', r.table_name);
    execute format('drop policy if exists %I on public.%I', r.table_name||'_update_permission', r.table_name);
    execute format('drop policy if exists %I on public.%I', r.table_name||'_delete_permission', r.table_name);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.has_team_permission(team_id,%L))', r.table_name||'_insert_permission', r.table_name, 'settings.manage');
    execute format('create policy %I on public.%I for update to authenticated using (public.has_team_permission(team_id,%L)) with check (public.has_team_permission(team_id,%L))', r.table_name||'_update_permission', r.table_name, 'settings.manage', 'settings.manage');
    execute format('create policy %I on public.%I for delete to authenticated using (public.has_team_permission(team_id,%L))', r.table_name||'_delete_permission', r.table_name, 'settings.manage');
  end loop;
end $$;

-- Team members: team.manage controls modifications.
drop policy if exists team_users_update_team_manager on public.team_users;
drop policy if exists team_users_update_permission on public.team_users;
create policy team_users_update_permission on public.team_users
for update to authenticated
using (public.has_team_permission(team_id,'team.manage'))
with check (public.has_team_permission(team_id,'team.manage'));

-- Permission overrides: managers can manage; each user can still read their own overrides.
drop policy if exists team_user_permissions_select_team on public.team_user_permissions;
drop policy if exists team_user_permissions_insert_team on public.team_user_permissions;
drop policy if exists team_user_permissions_update_team on public.team_user_permissions;
drop policy if exists team_user_permissions_delete_team on public.team_user_permissions;
create policy team_user_permissions_select_permission on public.team_user_permissions
for select to authenticated using (exists (
  select 1 from public.team_users tu
  where tu.id=team_user_permissions.team_user_id
    and (tu.auth_user_id=auth.uid() or public.has_team_permission(tu.team_id,'team.manage'))
));
create policy team_user_permissions_insert_permission on public.team_user_permissions
for insert to authenticated with check (exists (
  select 1 from public.team_users tu
  where tu.id=team_user_permissions.team_user_id
    and public.has_team_permission(tu.team_id,'team.manage')
));
create policy team_user_permissions_update_permission on public.team_user_permissions
for update to authenticated using (exists (
  select 1 from public.team_users tu
  where tu.id=team_user_permissions.team_user_id
    and public.has_team_permission(tu.team_id,'team.manage')
)) with check (exists (
  select 1 from public.team_users tu
  where tu.id=team_user_permissions.team_user_id
    and public.has_team_permission(tu.team_id,'team.manage')
));
create policy team_user_permissions_delete_permission on public.team_user_permissions
for delete to authenticated using (exists (
  select 1 from public.team_users tu
  where tu.id=team_user_permissions.team_user_id
    and public.has_team_permission(tu.team_id,'team.manage')
));

-- Owner permissions are unconditional in has_team_permission; prevent misleading owner overrides from being stored.
create or replace function public.prevent_owner_permission_overrides()
returns trigger language plpgsql set search_path=public as $$
declare v_team_user_id uuid; v_role text;
begin
  v_team_user_id := coalesce(new.team_user_id, old.team_user_id);
  select role into v_role from public.team_users where id=v_team_user_id;
  if v_role='owner' then raise exception 'Gli override non sono applicabili al ruolo owner'; end if;
  return new;
end;
$$;
revoke all on function public.prevent_owner_permission_overrides() from public,anon,authenticated;
grant execute on function public.prevent_owner_permission_overrides() to service_role;
drop trigger if exists team_user_permissions_prevent_owner on public.team_user_permissions;
create trigger team_user_permissions_prevent_owner before insert or update on public.team_user_permissions
for each row execute function public.prevent_owner_permission_overrides();

-- Invites.
drop policy if exists team_invites_select_manager on public.team_invites;
drop policy if exists team_invites_insert_manager on public.team_invites;
drop policy if exists team_invites_update_manager on public.team_invites;
drop policy if exists team_invites_delete_manager on public.team_invites;
create policy team_invites_select_permission on public.team_invites for select to authenticated using (public.has_team_permission(team_id,'team.manage'));
create policy team_invites_insert_permission on public.team_invites for insert to authenticated with check (public.has_team_permission(team_id,'team.manage'));
create policy team_invites_update_permission on public.team_invites for update to authenticated using (public.has_team_permission(team_id,'team.manage')) with check (public.has_team_permission(team_id,'team.manage'));
create policy team_invites_delete_permission on public.team_invites for delete to authenticated using (public.has_team_permission(team_id,'team.manage'));

-- Fix the existing teams SELECT typo (tu.team_id = tu.id).
drop policy if exists teams_select on public.teams;
create policy teams_select on public.teams
for select to authenticated
using (exists (
  select 1 from public.team_users tu
  where tu.team_id = teams.id
    and tu.auth_user_id = auth.uid()
    and tu.is_active = true
));
