CREATE OR REPLACE FUNCTION public.team_reference_lookup(
  p_team_id uuid,
  p_kind text,
  p_search text DEFAULT NULL,
  p_limit integer DEFAULT 30,
  p_parent_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_kind text := lower(trim(coalesce(p_kind,'')));
  v_q text := lower(trim(coalesce(p_search,'')));
  v_limit integer := least(greatest(coalesce(p_limit,30),1),100);
  v_result jsonb;
BEGIN
  IF NOT public.is_team_member(p_team_id) THEN
    RAISE EXCEPTION 'Utente non autorizzato per il team %', p_team_id;
  END IF;

  CASE v_kind
    WHEN 'events' THEN
      IF NOT public.has_team_permission(p_team_id,'events.view') AND NOT public.has_team_permission(p_team_id,'tasks.view') AND NOT public.has_team_permission(p_team_id,'telemetry.view') AND NOT public.has_team_permission(p_team_id,'attendance.view') THEN
        RAISE EXCEPTION 'Permesso insufficiente';
      END IF;
      SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.date DESC NULLS LAST),'[]'::jsonb) INTO v_result FROM (
        SELECT id,name,date FROM public.events WHERE team_id=p_team_id AND (v_q='' OR lower(name) LIKE '%'||v_q||'%') ORDER BY date DESC NULLS LAST LIMIT v_limit
      ) x;
    WHEN 'inventory' THEN
      IF NOT public.has_team_permission(p_team_id,'inventory.view') AND NOT public.has_team_permission(p_team_id,'tasks.view') THEN RAISE EXCEPTION 'Permesso insufficiente'; END IF;
      SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.name),'[]'::jsonb) INTO v_result FROM (
        SELECT id,name FROM public.inventory_items WHERE team_id=p_team_id AND archived_at IS NULL AND (v_q='' OR search_text LIKE '%'||v_q||'%') ORDER BY name LIMIT v_limit
      ) x;
    WHEN 'components' THEN
      IF NOT public.has_team_permission(p_team_id,'components.view') AND NOT public.has_team_permission(p_team_id,'tasks.view') AND NOT public.has_team_permission(p_team_id,'maintenances.view') AND NOT public.has_team_permission(p_team_id,'mounts.view') THEN RAISE EXCEPTION 'Permesso insufficiente'; END IF;
      SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.identifier),'[]'::jsonb) INTO v_result FROM (
        SELECT id,type,identifier,car_id,hours,life_hours FROM public.components WHERE team_id=p_team_id
          AND (p_parent_id IS NULL OR car_id IS NULL OR car_id=p_parent_id)
          AND (v_q='' OR lower(coalesce(identifier,'')||' '||coalesce(type,'')) LIKE '%'||v_q||'%')
        ORDER BY identifier LIMIT v_limit
      ) x;
    WHEN 'drivers' THEN
      IF NOT public.has_team_permission(p_team_id,'drivers.view') AND NOT public.has_team_permission(p_team_id,'tasks.view') AND NOT public.has_team_permission(p_team_id,'telemetry.view') THEN RAISE EXCEPTION 'Permesso insufficiente'; END IF;
      SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.last_name,x.first_name),'[]'::jsonb) INTO v_result FROM (
        SELECT id,first_name,last_name,nickname FROM public.drivers WHERE team_id=p_team_id
          AND (v_q='' OR lower(coalesce(first_name,'')||' '||coalesce(last_name,'')||' '||coalesce(nickname,'')) LIKE '%'||v_q||'%')
        ORDER BY last_name,first_name LIMIT v_limit
      ) x;
    WHEN 'sessions' THEN
      IF NOT public.has_team_permission(p_team_id,'events.view') AND NOT public.has_team_permission(p_team_id,'telemetry.view') THEN RAISE EXCEPTION 'Permesso insufficiente'; END IF;
      SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.starts_at DESC NULLS LAST,x.created_at DESC),'[]'::jsonb) INTO v_result FROM (
        SELECT id,event_id,name,session_type,starts_at,ends_at,created_at FROM public.event_sessions WHERE team_id=p_team_id
          AND (p_parent_id IS NULL OR event_id=p_parent_id)
          AND (v_q='' OR lower(coalesce(name,'')||' '||coalesce(session_type,'')) LIKE '%'||v_q||'%')
        ORDER BY starts_at DESC NULLS LAST,created_at DESC LIMIT v_limit
      ) x;
    WHEN 'event_cars' THEN
      IF NOT public.has_team_permission(p_team_id,'events.view') AND NOT public.has_team_permission(p_team_id,'telemetry.view') THEN RAISE EXCEPTION 'Permesso insufficiente'; END IF;
      SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC),'[]'::jsonb) INTO v_result FROM (
        SELECT ec.id,ec.event_id,ec.car_id,ec.status,ec.created_at,ca.name AS car_name,e.name AS event_name
        FROM public.event_cars ec
        JOIN public.cars ca ON ca.id=ec.car_id AND ca.team_id=p_team_id
        JOIN public.events e ON e.id=ec.event_id AND e.team_id=p_team_id
        WHERE ec.team_id=p_team_id AND (p_parent_id IS NULL OR ec.event_id=p_parent_id)
          AND (v_q='' OR lower(coalesce(ca.name,'')||' '||coalesce(e.name,'')) LIKE '%'||v_q||'%')
        ORDER BY ec.created_at DESC LIMIT v_limit
      ) x;
    WHEN 'turns' THEN
      IF NOT public.has_team_permission(p_team_id,'events.view') AND NOT public.has_team_permission(p_team_id,'telemetry.view') THEN RAISE EXCEPTION 'Permesso insufficiente'; END IF;
      SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.recorded_at DESC),'[]'::jsonb) INTO v_result FROM (
        SELECT t.id,t.event_car_id,t.event_session_id,t.driver_id,t.minutes,t.laps,t.recorded_at,t.created_at,
          ec.event_id,ec.car_id,e.name AS event_name,ca.name AS car_name,s.name AS session_name,d.first_name,d.last_name
        FROM public.event_car_turns t
        JOIN public.event_cars ec ON ec.id=t.event_car_id AND ec.team_id=p_team_id
        JOIN public.events e ON e.id=ec.event_id AND e.team_id=p_team_id
        JOIN public.cars ca ON ca.id=ec.car_id AND ca.team_id=p_team_id
        LEFT JOIN public.event_sessions s ON s.id=t.event_session_id AND s.team_id=p_team_id
        LEFT JOIN public.drivers d ON d.id=t.driver_id AND d.team_id=p_team_id
        WHERE t.team_id=p_team_id AND (p_parent_id IS NULL OR ec.event_id=p_parent_id)
          AND (v_q='' OR lower(coalesce(e.name,'')||' '||coalesce(ca.name,'')||' '||coalesce(s.name,'')||' '||coalesce(d.first_name,'')||' '||coalesce(d.last_name,'')) LIKE '%'||v_q||'%')
        ORDER BY t.recorded_at DESC LIMIT v_limit
      ) x;
    ELSE
      RAISE EXCEPTION 'Tipo lookup non supportato: %', p_kind;
  END CASE;
  RETURN COALESCE(v_result,'[]'::jsonb);
END;
$function$;

REVOKE ALL ON FUNCTION public.team_reference_lookup(uuid,text,text,integer,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.team_reference_lookup(uuid,text,text,integer,uuid) TO authenticated;
