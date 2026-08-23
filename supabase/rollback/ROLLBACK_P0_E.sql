-- Eseguire solo se serve annullare P0-E.2A.
DO $p0e$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('cars'),('components'),('component_revisions'),('car_components'),('maintenances'),
      ('inventory_items'),('inventory_movements'),('drivers'),('driver_licenses'),('driver_documents'),
      ('driver_safety_items'),('driver_event_entries'),('driver_session_performance'),('events'),('circuits'),
      ('event_sessions'),('event_cars'),('event_car_data'),('event_car_turns'),('event_car_turn_metrics'),
      ('event_car_drivers'),('telemetry_files'),('telemetry_channels'),('telemetry_laps'),('telemetry_samples'),('telemetry_insights')
    ) AS x(table_name)
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.table_name || '_insert_permission', r.table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.table_name || '_update_permission', r.table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.table_name || '_delete_permission', r.table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.table_name || '_insert_team', r.table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.table_name || '_update_team', r.table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.table_name || '_delete_team', r.table_name);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO public WITH CHECK (public.is_team_member(team_id))', r.table_name || '_insert_team', r.table_name);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO public USING (public.is_team_member(team_id)) WITH CHECK (public.is_team_member(team_id))', r.table_name || '_update_team', r.table_name);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO public USING (public.is_team_member(team_id))', r.table_name || '_delete_team', r.table_name);
  END LOOP;
END
$p0e$;

DO $rpc$
DECLARE
  v_def text;
  v_new text;
BEGIN
  SELECT pg_get_functiondef('public.create_inventory_movement(uuid,uuid,text,numeric,text,text,uuid,numeric,text,uuid,text)'::regprocedure) INTO v_def;
  v_new := regexp_replace(v_def, 'public\.has_team_permission\(p_team_id, ''inventory\.edit''\)', 'public.is_team_member(p_team_id)', 'i'); EXECUTE v_new;
  SELECT pg_get_functiondef('public.create_maintenance_with_revision(uuid,uuid,uuid,date,text,text,text,text,uuid,uuid,boolean,boolean,text)'::regprocedure) INTO v_def;
  v_new := regexp_replace(v_def, 'public\.has_team_permission\(p_team_id, ''maintenances\.edit''\)', 'public.is_team_member(p_team_id)', 'i'); EXECUTE v_new;
  SELECT pg_get_functiondef('public.mount_component_on_car(uuid,uuid,uuid,date,uuid,text,boolean)'::regprocedure) INTO v_def;
  v_new := regexp_replace(v_def, 'public\.has_team_permission\(p_team_id, ''mounts\.edit''\)', 'public.is_team_member(p_team_id)', 'i'); EXECUTE v_new;
  SELECT pg_get_functiondef('public.unmount_component_from_car(uuid,uuid,uuid,date,uuid,text)'::regprocedure) INTO v_def;
  v_new := regexp_replace(v_def, 'public\.has_team_permission\(p_team_id, ''mounts\.edit''\)', 'public.is_team_member(p_team_id)', 'i'); EXECUTE v_new;
  SELECT pg_get_functiondef('public.save_event_car_turn_with_metrics(uuid,uuid,uuid,uuid,uuid,uuid,timestamp with time zone,integer,integer,numeric,numeric,text,text,numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric,integer,integer,numeric,numeric,numeric,numeric,numeric,numeric,text,uuid)'::regprocedure) INTO v_def;
  v_new := regexp_replace(v_def, 'public\.has_team_permission\(p_team_id, ''events\.edit''\)', 'public.is_team_member(p_team_id)', 'i'); EXECUTE v_new;
  SELECT pg_get_functiondef('public.delete_event_car_turn(uuid,uuid)'::regprocedure) INTO v_def;
  v_new := regexp_replace(v_def, 'public\.has_team_permission\(p_team_id, ''events\.edit''\)', 'public.is_team_member(p_team_id)', 'i'); EXECUTE v_new;
  SELECT pg_get_functiondef('public.save_telemetry_parsed_csv(uuid,uuid,jsonb,jsonb,jsonb,jsonb)'::regprocedure) INTO v_def;
  v_new := regexp_replace(v_def, 'public\.has_team_permission\(p_team_id, ''telemetry\.edit''\)', 'public.is_team_member(p_team_id)', 'i'); EXECUTE v_new;
  SELECT pg_get_functiondef('public.save_team_settings_bundle(uuid,jsonb,jsonb,jsonb,jsonb,jsonb)'::regprocedure) INTO v_def;
  v_new := regexp_replace(v_def, 'public\.has_team_permission\(p_team_id, ''settings\.manage''\)', 'public.is_team_manager(p_team_id)', 'i'); EXECUTE v_new;
  SELECT pg_get_functiondef('public.create_team_invite(uuid,text,text,text,integer)'::regprocedure) INTO v_def;
  v_new := regexp_replace(v_def, 'public\.has_team_permission\(p_team_id, ''team\.manage''\)', 'public.is_team_manager(p_team_id)', 'i'); EXECUTE v_new;
END
$rpc$;

-- Solo dopo il rollback delle policy/RPC si può rimuovere il resolver.
drop function if exists public.has_team_permission(uuid,text);
