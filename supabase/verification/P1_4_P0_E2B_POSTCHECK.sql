-- READ-ONLY POSTCHECK. Le migration del pacchetto sono già applicate live.

with policy_audit as (
  select schemaname,tablename,policyname,cmd,qual,with_check
  from pg_policies
  where (schemaname='public' and tablename in (
    'tasks','task_checklist_items','task_comments',
    'attendance_records','team_staff_members','attendance_counter_resets',
    'app_settings','team_component_definitions','team_checklists','team_checklist_items','team_setup_fields','team_dashboard_widgets',
    'team_users','team_user_permissions','team_invites','teams'
  )) or (schemaname='storage' and tablename='objects')
)
select
  count(*) filter (where policyname like '%_permission') as permission_policies,
  count(*) filter (where policyname in (
    'tasks_select_team','tasks_insert_team','tasks_update_team','tasks_delete_team_manager',
    'attendance_records_select_team','attendance_records_insert_team_owner','attendance_records_update_team_owner','attendance_records_delete_manager',
    'team_staff_members_select_team','team_staff_members_insert_manager','team_staff_members_update_manager','team_staff_members_delete_manager',
    'team_files_read','team_files_insert','team_files_update','team_files_delete'
  )) as legacy_target_policies,
  count(*) filter (where coalesce(qual,'') like '%is_team_manager%' or coalesce(with_check,'') like '%is_team_manager%') as manager_based_policies_remaining
from policy_audit;

select p.proname,pg_get_function_identity_arguments(p.oid) args,
 has_function_privilege('authenticated',p.oid,'EXECUTE') auth_exec,
 has_function_privilege('anon',p.oid,'EXECUTE') anon_exec
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in (
 'driver_performance_page','team_file_has_permission',
 'enforce_task_assignment_permission','prevent_owner_permission_overrides'
)
order by p.proname;

select count(*) as owner_overrides
from public.team_user_permissions tup
join public.team_users tu on tu.id=tup.team_user_id
where tu.role='owner';

select policyname,cmd
from pg_policies
where schemaname='public' and tablename='teams' and policyname='teams_select';
