-- Read-only P0-D post-check.
WITH trigger_count AS (
  SELECT count(*)::int AS n
  FROM pg_trigger t
  JOIN pg_proc p ON p.oid = t.tgfoid
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'set_team_id_from_auth'
    AND NOT t.tgisinternal
), team_columns AS (
  SELECT count(*)::int AS n,
         count(*) FILTER (WHERE is_nullable = 'NO')::int AS not_null_n
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND column_name = 'team_id'
    AND table_name = ANY(ARRAY[
      'app_settings','car_components','cars','circuits','component_revisions','components',
      'document_templates','documents','driver_documents','driver_event_entries','driver_licenses',
      'driver_session_performance','drivers','event_car_data','event_car_drivers','event_car_turn_metrics',
      'event_car_turns','event_cars','event_sessions','events','inventory_items','maintenances',
      'team_checklist_items','team_checklists','team_component_definitions','team_dashboard_widgets',
      'team_setup_fields','telemetry_files'
    ])
)
SELECT
  CASE WHEN trigger_count.n = 0 THEN 'OK: implicit team triggers removed' ELSE 'ERROR: triggers remain=' || trigger_count.n END AS trigger_status,
  CASE WHEN team_columns.n = 28 AND team_columns.not_null_n = 28 THEN 'OK: 28/28 team_id NOT NULL' ELSE 'ERROR: team_id nullability mismatch' END AS nullability_status,
  has_function_privilege('authenticated', 'public.current_team_id()', 'EXECUTE') AS current_team_id_authenticated_execute
FROM trigger_count, team_columns;
