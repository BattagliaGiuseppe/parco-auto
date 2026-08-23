select
  (select count(*) from pg_policies where schemaname='public' and policyname like '%_permission' and cmd in ('INSERT','UPDATE','DELETE')) as permission_write_policies,
  (select count(*) from pg_policies where schemaname='public' and cmd in ('INSERT','UPDATE','DELETE')
     and (coalesce(qual,'') ilike '%is_team_member%' or coalesce(with_check,'') ilike '%is_team_member%')
     and tablename in ('cars','components','component_revisions','car_components','maintenances','inventory_items','inventory_movements','drivers','driver_licenses','driver_documents','driver_safety_items','driver_event_entries','driver_session_performance','events','circuits','event_sessions','event_cars','event_car_data','event_car_turns','event_car_turn_metrics','event_car_drivers','telemetry_files','telemetry_channels','telemetry_laps','telemetry_samples','telemetry_insights')) as old_membership_write_policies,
  (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
     where n.nspname='public'
       and p.proname in ('create_inventory_movement','create_maintenance_with_revision','mount_component_on_car','unmount_component_from_car','save_event_car_turn_with_metrics','delete_event_car_turn','save_telemetry_parsed_csv','save_team_settings_bundle','create_team_invite')
       and pg_get_functiondef(p.oid) ilike '%has_team_permission%') as hardened_rpcs,
  has_function_privilege('authenticated','public.has_team_permission(uuid,text)','EXECUTE') as auth_can_resolve,
  has_function_privilege('anon','public.has_team_permission(uuid,text)','EXECUTE') as anon_can_resolve;
