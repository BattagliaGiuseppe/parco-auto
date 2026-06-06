-- =========================================
-- PARCO AUTO · PATCH 9B
-- Control Center audit / diagnostica salvataggio
-- =========================================

create or replace function public.get_settings_control_center_health(p_team_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings_count integer := 0;
  v_settings_updated_at timestamptz;
  v_component_definitions integer := 0;
  v_checklists integer := 0;
  v_checklist_items integer := 0;
  v_setup_fields integer := 0;
  v_dashboard_widgets integer := 0;
  v_save_rpc_available boolean := false;
  v_policy_counts jsonb := '{}'::jsonb;
begin
  if not public.is_team_member(p_team_id) then
    raise exception 'Non autorizzato a leggere la diagnostica del Control Center';
  end if;

  select count(*), max(updated_at)
    into v_settings_count, v_settings_updated_at
  from public.app_settings
  where team_id = p_team_id;

  select count(*) into v_component_definitions
  from public.team_component_definitions
  where team_id = p_team_id;

  select count(*) into v_checklists
  from public.team_checklists
  where team_id = p_team_id;

  select count(*) into v_checklist_items
  from public.team_checklist_items
  where team_id = p_team_id;

  select count(*) into v_setup_fields
  from public.team_setup_fields
  where team_id = p_team_id;

  select count(*) into v_dashboard_widgets
  from public.team_dashboard_widgets
  where team_id = p_team_id;

  select to_regprocedure('public.save_team_settings_bundle(uuid,jsonb,jsonb,jsonb,jsonb,jsonb)') is not null
  into v_save_rpc_available;

  select coalesce(jsonb_object_agg(tablename, policy_count), '{}'::jsonb)
  into v_policy_counts
  from (
    select tablename, count(*)::integer as policy_count
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'app_settings',
        'team_component_definitions',
        'team_checklists',
        'team_checklist_items',
        'team_setup_fields',
        'team_dashboard_widgets'
      )
      and (
        policyname ilike '%manager%'
        or policyname ilike '%update%'
        or policyname ilike '%insert%'
        or policyname ilike '%delete%'
      )
    group by tablename
  ) p;

  return jsonb_build_object(
    'checked_at', now(),
    'can_manage', public.is_team_manager(p_team_id),
    'save_rpc_available', v_save_rpc_available,
    'settings_count', v_settings_count,
    'settings_updated_at', v_settings_updated_at,
    'counts', jsonb_build_object(
      'component_definitions', v_component_definitions,
      'checklists', v_checklists,
      'checklist_items', v_checklist_items,
      'setup_fields', v_setup_fields,
      'dashboard_widgets', v_dashboard_widgets
    ),
    'manager_write_policies', v_policy_counts
  );
end;
$$;

grant execute on function public.get_settings_control_center_health(uuid) to authenticated;
