DO $p0e$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('cars','cars.edit'),
      ('components','components.edit'),
      ('component_revisions','components.edit'),
      ('car_components','mounts.edit'),
      ('maintenances','maintenances.edit'),
      ('inventory_items','inventory.edit'),
      ('inventory_movements','inventory.edit'),
      ('drivers','drivers.edit'),
      ('driver_licenses','drivers.edit'),
      ('driver_documents','drivers.edit'),
      ('driver_safety_items','drivers.edit'),
      ('driver_event_entries','drivers.edit'),
      ('driver_session_performance','drivers.edit'),
      ('events','events.edit'),
      ('circuits','events.edit'),
      ('event_sessions','events.edit'),
      ('event_cars','events.edit'),
      ('event_car_data','events.edit'),
      ('event_car_turns','events.edit'),
      ('event_car_turn_metrics','events.edit'),
      ('event_car_drivers','events.edit'),
      ('telemetry_files','telemetry.edit'),
      ('telemetry_channels','telemetry.edit'),
      ('telemetry_laps','telemetry.edit'),
      ('telemetry_samples','telemetry.edit'),
      ('telemetry_insights','telemetry.edit')
    ) AS x(table_name, edit_permission)
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.table_name || '_insert_team', r.table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.table_name || '_update_team', r.table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.table_name || '_delete_team', r.table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.table_name || '_insert_permission', r.table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.table_name || '_update_permission', r.table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.table_name || '_delete_permission', r.table_name);

    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.has_team_permission(team_id, %L))', r.table_name || '_insert_permission', r.table_name, r.edit_permission);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.has_team_permission(team_id, %L)) WITH CHECK (public.has_team_permission(team_id, %L))', r.table_name || '_update_permission', r.table_name, r.edit_permission, r.edit_permission);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (public.has_team_permission(team_id, %L))', r.table_name || '_delete_permission', r.table_name, r.edit_permission);
  END LOOP;
END
$p0e$;

DO $rpc$
DECLARE
  v_def text;
  v_new text;
BEGIN
  SELECT pg_get_functiondef('public.create_inventory_movement(uuid,uuid,text,numeric,text,text,uuid,numeric,text,uuid,text)'::regprocedure) INTO v_def;
  v_new := regexp_replace(v_def, 'public\.is_team_member\(p_team_id\)', 'public.has_team_permission(p_team_id, ''inventory.edit'')', 'i');
  IF v_new = v_def THEN RAISE EXCEPTION 'Patch create_inventory_movement non applicata'; END IF;
  EXECUTE v_new;

  SELECT pg_get_functiondef('public.create_maintenance_with_revision(uuid,uuid,uuid,date,text,text,text,text,uuid,uuid,boolean,boolean,text)'::regprocedure) INTO v_def;
  v_new := regexp_replace(v_def, 'public\.is_team_member\(p_team_id\)', 'public.has_team_permission(p_team_id, ''maintenances.edit'')', 'i');
  IF v_new = v_def THEN RAISE EXCEPTION 'Patch create_maintenance_with_revision non applicata'; END IF;
  EXECUTE v_new;

  SELECT pg_get_functiondef('public.mount_component_on_car(uuid,uuid,uuid,date,uuid,text,boolean)'::regprocedure) INTO v_def;
  v_new := regexp_replace(v_def, 'public\.is_team_member\(p_team_id\)', 'public.has_team_permission(p_team_id, ''mounts.edit'')', 'i');
  IF v_new = v_def THEN RAISE EXCEPTION 'Patch mount_component_on_car non applicata'; END IF;
  EXECUTE v_new;

  SELECT pg_get_functiondef('public.unmount_component_from_car(uuid,uuid,uuid,date,uuid,text)'::regprocedure) INTO v_def;
  v_new := regexp_replace(v_def, 'public\.is_team_member\(p_team_id\)', 'public.has_team_permission(p_team_id, ''mounts.edit'')', 'i');
  IF v_new = v_def THEN RAISE EXCEPTION 'Patch unmount_component_from_car non applicata'; END IF;
  EXECUTE v_new;

  SELECT pg_get_functiondef('public.save_event_car_turn_with_metrics(uuid,uuid,uuid,uuid,uuid,uuid,timestamp with time zone,integer,integer,numeric,numeric,text,text,numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric,integer,integer,numeric,numeric,numeric,numeric,numeric,numeric,text,uuid)'::regprocedure) INTO v_def;
  v_new := regexp_replace(v_def, 'public\.is_team_member\(p_team_id\)', 'public.has_team_permission(p_team_id, ''events.edit'')', 'i');
  IF v_new = v_def THEN RAISE EXCEPTION 'Patch save_event_car_turn_with_metrics non applicata'; END IF;
  EXECUTE v_new;

  SELECT pg_get_functiondef('public.delete_event_car_turn(uuid,uuid)'::regprocedure) INTO v_def;
  v_new := regexp_replace(v_def, 'public\.is_team_member\(p_team_id\)', 'public.has_team_permission(p_team_id, ''events.edit'')', 'i');
  IF v_new = v_def THEN RAISE EXCEPTION 'Patch delete_event_car_turn non applicata'; END IF;
  EXECUTE v_new;

  SELECT pg_get_functiondef('public.save_telemetry_parsed_csv(uuid,uuid,jsonb,jsonb,jsonb,jsonb)'::regprocedure) INTO v_def;
  v_new := regexp_replace(v_def, '(^|[^\.])is_team_member\(p_team_id\)', '\1public.has_team_permission(p_team_id, ''telemetry.edit'')', 'i');
  IF v_new = v_def THEN RAISE EXCEPTION 'Patch save_telemetry_parsed_csv non applicata'; END IF;
  EXECUTE v_new;

  SELECT pg_get_functiondef('public.save_team_settings_bundle(uuid,jsonb,jsonb,jsonb,jsonb,jsonb)'::regprocedure) INTO v_def;
  v_new := regexp_replace(v_def, 'public\.is_team_manager\(p_team_id\)', 'public.has_team_permission(p_team_id, ''settings.manage'')', 'i');
  IF v_new = v_def THEN RAISE EXCEPTION 'Patch save_team_settings_bundle non applicata'; END IF;
  EXECUTE v_new;

  SELECT pg_get_functiondef('public.create_team_invite(uuid,text,text,text,integer)'::regprocedure) INTO v_def;
  v_new := regexp_replace(v_def, 'public\.is_team_manager\(p_team_id\)', 'public.has_team_permission(p_team_id, ''team.manage'')', 'i');
  IF v_new = v_def THEN RAISE EXCEPTION 'Patch create_team_invite non applicata'; END IF;
  EXECUTE v_new;
END
$rpc$;
