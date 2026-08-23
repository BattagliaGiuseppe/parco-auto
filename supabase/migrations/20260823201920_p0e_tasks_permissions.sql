-- P0-E.2B: Tasks granular permissions.

drop policy if exists tasks_select_team on public.tasks;
drop policy if exists tasks_insert_team on public.tasks;
drop policy if exists tasks_update_team on public.tasks;
drop policy if exists tasks_delete_team_manager on public.tasks;
drop policy if exists tasks_select_permission on public.tasks;
drop policy if exists tasks_insert_permission on public.tasks;
drop policy if exists tasks_update_permission on public.tasks;
drop policy if exists tasks_delete_permission on public.tasks;

create policy tasks_select_permission on public.tasks
for select to authenticated
using (public.has_team_permission(team_id, 'tasks.view'));

create policy tasks_insert_permission on public.tasks
for insert to authenticated
with check (public.has_team_permission(team_id, 'tasks.edit'));

create policy tasks_update_permission on public.tasks
for update to authenticated
using (public.has_team_permission(team_id, 'tasks.edit'))
with check (public.has_team_permission(team_id, 'tasks.edit'));

create policy tasks_delete_permission on public.tasks
for delete to authenticated
using (public.has_team_permission(team_id, 'tasks.delete'));

-- Checklist children follow task edit/view permissions.
drop policy if exists task_checklist_items_select_team on public.task_checklist_items;
drop policy if exists task_checklist_items_insert_team on public.task_checklist_items;
drop policy if exists task_checklist_items_update_team on public.task_checklist_items;
drop policy if exists task_checklist_items_delete_team on public.task_checklist_items;
create policy task_checklist_items_select_permission on public.task_checklist_items
for select to authenticated using (public.has_team_permission(team_id, 'tasks.view'));
create policy task_checklist_items_insert_permission on public.task_checklist_items
for insert to authenticated with check (public.has_team_permission(team_id, 'tasks.edit'));
create policy task_checklist_items_update_permission on public.task_checklist_items
for update to authenticated using (public.has_team_permission(team_id, 'tasks.edit')) with check (public.has_team_permission(team_id, 'tasks.edit'));
create policy task_checklist_items_delete_permission on public.task_checklist_items
for delete to authenticated using (public.has_team_permission(team_id, 'tasks.edit'));

-- Comments are readable with tasks.view; authoring/editing requires tasks.edit; deletion requires tasks.delete.
drop policy if exists task_comments_select_team on public.task_comments;
drop policy if exists task_comments_insert_team on public.task_comments;
drop policy if exists task_comments_update_manager on public.task_comments;
drop policy if exists task_comments_delete_manager on public.task_comments;
create policy task_comments_select_permission on public.task_comments
for select to authenticated using (public.has_team_permission(team_id, 'tasks.view'));
create policy task_comments_insert_permission on public.task_comments
for insert to authenticated with check (public.has_team_permission(team_id, 'tasks.edit'));
create policy task_comments_update_permission on public.task_comments
for update to authenticated using (public.has_team_permission(team_id, 'tasks.edit')) with check (public.has_team_permission(team_id, 'tasks.edit'));
create policy task_comments_delete_permission on public.task_comments
for delete to authenticated using (public.has_team_permission(team_id, 'tasks.delete'));

create or replace function public.enforce_task_assignment_permission()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.team_id is distinct from old.team_id then
    raise exception 'Non è consentito spostare una attività tra team';
  end if;

  if new.assigned_to_team_user_id is not null and not exists (
    select 1 from public.team_users tu
    where tu.id = new.assigned_to_team_user_id
      and tu.team_id = new.team_id
      and tu.is_active = true
  ) then
    raise exception 'Assegnatario non valido per questo team';
  end if;

  -- Service-side operations without an end-user JWT are left to trusted backend roles.
  if auth.uid() is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.assigned_to_team_user_id is not null
       and not public.has_team_permission(new.team_id, 'tasks.assign') then
      raise exception 'Permesso tasks.assign richiesto per assegnare attività';
    end if;
  elsif new.assigned_to_team_user_id is distinct from old.assigned_to_team_user_id then
    if not public.has_team_permission(new.team_id, 'tasks.assign') then
      raise exception 'Permesso tasks.assign richiesto per riassegnare attività';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_task_assignment_permission() from public, anon, authenticated;
grant execute on function public.enforce_task_assignment_permission() to service_role;

drop trigger if exists tasks_enforce_assignment_permission on public.tasks;
create trigger tasks_enforce_assignment_permission
before insert or update of assigned_to_team_user_id, team_id on public.tasks
for each row execute function public.enforce_task_assignment_permission();
