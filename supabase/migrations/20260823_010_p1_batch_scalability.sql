-- P1.2 SaaS scalability batch: Drivers, Dashboard, Tasks, Calendar

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS drivers_search_trgm_idx
ON public.drivers USING gin (
  lower(
    coalesce(first_name,'') || ' ' || coalesce(last_name,'') || ' ' ||
    coalesce(nickname,'') || ' ' || coalesce(email,'') || ' ' ||
    coalesce(phone,'') || ' ' || coalesce(racing_number,'') || ' ' ||
    coalesce(license_number,'')
  ) gin_trgm_ops
);

CREATE INDEX IF NOT EXISTS tasks_team_created_idx
  ON public.tasks (team_id, created_at DESC);
CREATE INDEX IF NOT EXISTS events_team_date_desc_idx
  ON public.events (team_id, date DESC NULLS LAST);

CREATE OR REPLACE FUNCTION public.drivers_archive_page(
  p_team_id uuid,
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 50,
  p_search text DEFAULT NULL,
  p_filter text DEFAULT 'all'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_page integer := greatest(coalesce(p_page, 1), 1);
  v_page_size integer := least(greatest(coalesce(p_page_size, 50), 1), 100);
  v_offset integer;
  v_search text := lower(trim(coalesce(p_search, '')));
  v_filter text := lower(coalesce(p_filter, 'all'));
  v_result jsonb;
BEGIN
  IF NOT public.has_team_permission(p_team_id, 'drivers.view') THEN
    RAISE EXCEPTION 'Utente non autorizzato per il team %', p_team_id;
  END IF;
  v_offset := (v_page - 1) * v_page_size;

  WITH driver_flags AS (
    SELECT d.id,
      (
        (d.license_expires_at IS NOT NULL AND d.license_expires_at <= current_date + 30)
        OR (d.medical_expires_at IS NOT NULL AND d.medical_expires_at <= current_date + 30)
        OR (d.insurance_expires_at IS NOT NULL AND d.insurance_expires_at <= current_date + 30)
        OR EXISTS (
          SELECT 1 FROM public.driver_documents dd
          WHERE dd.team_id = p_team_id AND dd.driver_id = d.id
            AND dd.expires_at IS NOT NULL AND dd.expires_at <= current_date + 30
        )
      ) AS has_alert
    FROM public.drivers d
    WHERE d.team_id = p_team_id
  ),
  filtered AS (
    SELECT d.id
    FROM public.drivers d
    JOIN driver_flags df ON df.id = d.id
    WHERE d.team_id = p_team_id
      AND (
        v_search = '' OR
        lower(
          coalesce(d.first_name,'') || ' ' || coalesce(d.last_name,'') || ' ' ||
          coalesce(d.nickname,'') || ' ' || coalesce(d.email,'') || ' ' ||
          coalesce(d.phone,'') || ' ' || coalesce(d.racing_number,'') || ' ' ||
          coalesce(d.license_number,'')
        ) LIKE '%' || v_search || '%'
      )
      AND (
        v_filter = 'all'
        OR (v_filter = 'active' AND d.is_active IS DISTINCT FROM false)
        OR (v_filter = 'inactive' AND d.is_active = false)
        OR (v_filter = 'alerts' AND df.has_alert)
      )
  ),
  paged AS (
    SELECT d.id
    FROM public.drivers d
    JOIN filtered f ON f.id = d.id
    ORDER BY lower(coalesce(d.last_name,'')), lower(coalesce(d.first_name,'')), d.id
    LIMIT v_page_size OFFSET v_offset
  ),
  items AS (
    SELECT dr.id,
      lower(coalesce(dr.last_name,'')) AS sort_last_name,
      lower(coalesce(dr.first_name,'')) AS sort_first_name,
      to_jsonb(dr)
      || jsonb_build_object(
        'documents', COALESCE(docs.documents, '[]'::jsonb),
        'performance', jsonb_build_object(
          'driver_id', dr.id,
          'events_count', COALESCE(perf.events_count, 0),
          'turns_count', COALESCE(perf.turns_count, 0),
          'total_minutes', COALESCE(perf.total_minutes, 0),
          'total_hours', round(COALESCE(perf.total_minutes, 0)::numeric / 60.0, 1),
          'total_laps', COALESCE(perf.total_laps, 0),
          'best_lap_ms', perf.best_lap_ms,
          'avg_lap_ms', perf.avg_lap_ms,
          'last_turn_at', latest.last_turn_at,
          'last_event_name', latest.last_event_name,
          'last_car_name', latest.last_car_name
        ),
        'recent_performance', COALESCE(recent.rows, '[]'::jsonb)
      ) AS payload
    FROM paged p
    JOIN public.drivers dr ON dr.id = p.id AND dr.team_id = p_team_id
    LEFT JOIN LATERAL (
      SELECT jsonb_agg(to_jsonb(dd) ORDER BY dd.expires_at ASC NULLS LAST, dd.created_at DESC) AS documents
      FROM public.driver_documents dd
      WHERE dd.team_id = p_team_id AND dd.driver_id = dr.id
    ) docs ON true
    LEFT JOIN LATERAL (
      SELECT count(*)::integer AS turns_count,
        count(DISTINCT ec.event_id)::integer AS events_count,
        COALESCE(sum(COALESCE(t.minutes, 0)), 0)::integer AS total_minutes,
        COALESCE(sum(COALESCE(t.laps, 0)), 0)::integer AS total_laps,
        min(m.best_lap_ms)::integer AS best_lap_ms,
        round(avg(m.avg_lap_ms))::integer AS avg_lap_ms
      FROM public.event_car_turns t
      LEFT JOIN public.event_car_turn_metrics m ON m.team_id = p_team_id AND m.turn_id = t.id
      LEFT JOIN public.event_cars ec ON ec.team_id = p_team_id AND ec.id = t.event_car_id
      WHERE t.team_id = p_team_id AND t.driver_id = dr.id
    ) perf ON true
    LEFT JOIN LATERAL (
      SELECT COALESCE(t.recorded_at, t.created_at) AS last_turn_at,
        e.name AS last_event_name, c.name AS last_car_name
      FROM public.event_car_turns t
      LEFT JOIN public.event_cars ec ON ec.team_id = p_team_id AND ec.id = t.event_car_id
      LEFT JOIN public.events e ON e.team_id = p_team_id AND e.id = ec.event_id
      LEFT JOIN public.cars c ON c.team_id = p_team_id AND c.id = ec.car_id
      WHERE t.team_id = p_team_id AND t.driver_id = dr.id
      ORDER BY COALESCE(t.recorded_at, t.created_at) DESC NULLS LAST LIMIT 1
    ) latest ON true
    LEFT JOIN LATERAL (
      SELECT jsonb_agg(to_jsonb(x) ORDER BY x.recorded_at DESC NULLS LAST) AS rows
      FROM (
        SELECT t.id::text AS id, dr.id::text AS driver_id,
          COALESCE(e.name, 'Evento senza nome') AS event_name,
          COALESCE(c.name, 'Auto non indicata') AS car_name,
          COALESCE(t.recorded_at, t.created_at) AS recorded_at,
          COALESCE(t.minutes, 0)::integer AS minutes,
          COALESCE(t.laps, 0)::integer AS laps,
          m.best_lap_ms, m.avg_lap_ms
        FROM public.event_car_turns t
        LEFT JOIN public.event_car_turn_metrics m ON m.team_id = p_team_id AND m.turn_id = t.id
        LEFT JOIN public.event_cars ec ON ec.team_id = p_team_id AND ec.id = t.event_car_id
        LEFT JOIN public.events e ON e.team_id = p_team_id AND e.id = ec.event_id
        LEFT JOIN public.cars c ON c.team_id = p_team_id AND c.id = ec.car_id
        WHERE t.team_id = p_team_id AND t.driver_id = dr.id
        ORDER BY COALESCE(t.recorded_at, t.created_at) DESC NULLS LAST LIMIT 8
      ) x
    ) recent ON true
  )
  SELECT jsonb_build_object(
    'items', COALESCE((SELECT jsonb_agg(i.payload ORDER BY i.sort_last_name, i.sort_first_name, i.id) FROM items i), '[]'::jsonb),
    'total', (SELECT count(*) FROM filtered),
    'page', v_page,
    'page_size', v_page_size,
    'stats', jsonb_build_object(
      'total_drivers', (SELECT count(*) FROM public.drivers d WHERE d.team_id = p_team_id),
      'active_drivers', (SELECT count(*) FROM public.drivers d WHERE d.team_id = p_team_id AND d.is_active IS DISTINCT FROM false),
      'expired_documents', (SELECT count(*) FROM public.driver_documents dd WHERE dd.team_id = p_team_id AND dd.expires_at IS NOT NULL AND dd.expires_at < current_date),
      'expiring_documents', (SELECT count(*) FROM public.driver_documents dd WHERE dd.team_id = p_team_id AND dd.expires_at BETWEEN current_date AND current_date + 30),
      'drivers_with_alerts', (SELECT count(*) FROM driver_flags WHERE has_alert)
    )
  ) INTO v_result;
  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_dashboard_operational_bundle(p_team_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_result jsonb;
BEGIN
  IF NOT public.has_team_permission(p_team_id, 'dashboard.view') THEN
    RAISE EXCEPTION 'Utente non autorizzato per il team %', p_team_id;
  END IF;

  WITH component_flags AS (
    SELECT c.*,
      CASE
        WHEN c.expiry_date IS NOT NULL AND c.expiry_date < current_date THEN 3
        WHEN c.revision_threshold_hours IS NOT NULL AND COALESCE(c.hours,0) >= c.revision_threshold_hours THEN 3
        WHEN c.warning_threshold_hours IS NOT NULL AND COALESCE(c.hours,0) >= c.warning_threshold_hours THEN 2
        WHEN c.expiry_date IS NOT NULL AND c.expiry_date BETWEEN current_date AND current_date + 30 THEN 2
        ELSE 1 END AS severity
    FROM public.components c WHERE c.team_id = p_team_id
  ),
  car_flags AS (
    SELECT c.id, c.name, c.hours,
      EXISTS (SELECT 1 FROM component_flags cf WHERE cf.car_id = c.id AND cf.severity >= 2) AS has_problems
    FROM public.cars c WHERE c.team_id = p_team_id
  )
  SELECT jsonb_build_object(
    'cars', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.name) FROM (SELECT * FROM car_flags ORDER BY name LIMIT 50) x), '[]'::jsonb),
    'components', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.severity DESC, x.identifier) FROM (SELECT id,type,identifier,expiry_date,hours,warning_threshold_hours,revision_threshold_hours,car_id,severity FROM component_flags WHERE severity >= 2 ORDER BY severity DESC, identifier LIMIT 8) x), '[]'::jsonb),
    'events', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.date) FROM (
      SELECT e.id,e.name,e.date,jsonb_build_object('name',ci.name) AS circuit_id
      FROM public.events e LEFT JOIN public.circuits ci ON ci.id=e.circuit_id AND ci.team_id=p_team_id
      WHERE e.team_id=p_team_id AND e.date >= current_date ORDER BY e.date LIMIT 5
    ) x), '[]'::jsonb),
    'maintenances', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC) FROM (
      SELECT m.id,m.type,m.status,m.priority,m.date,m.created_at,
        CASE WHEN ca.id IS NULL THEN NULL ELSE jsonb_build_object('name',ca.name) END AS car_id,
        CASE WHEN co.id IS NULL THEN NULL ELSE jsonb_build_object('identifier',co.identifier) END AS component_id
      FROM public.maintenances m
      LEFT JOIN public.cars ca ON ca.id=m.car_id AND ca.team_id=p_team_id
      LEFT JOIN public.components co ON co.id=m.component_id AND co.team_id=p_team_id
      WHERE m.team_id=p_team_id AND COALESCE(m.status,'') <> 'completed'
      ORDER BY m.created_at DESC LIMIT 6
    ) x), '[]'::jsonb),
    'driver_docs', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.expires_at) FROM (
      SELECT dd.id,dd.expires_at,jsonb_build_object('first_name',d.first_name,'last_name',d.last_name) AS driver_id
      FROM public.driver_documents dd JOIN public.drivers d ON d.id=dd.driver_id AND d.team_id=p_team_id
      WHERE dd.team_id=p_team_id AND dd.expires_at IS NOT NULL AND dd.expires_at >= current_date
      ORDER BY dd.expires_at LIMIT 6
    ) x), '[]'::jsonb),
    'inventory', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.name) FROM (
      SELECT id,name,quantity,minimum_quantity,reserved_quantity
      FROM public.inventory_items
      WHERE team_id=p_team_id AND archived_at IS NULL AND COALESCE(quantity,0) <= COALESCE(minimum_quantity,0)
      ORDER BY name LIMIT 8
    ) x), '[]'::jsonb),
    'tasks', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC) FROM (
      SELECT t.id,t.title,t.status,t.priority,t.due_date,t.created_at,
        CASE WHEN c.id IS NULL THEN NULL ELSE jsonb_build_object('name',c.name) END AS car_id,
        CASE WHEN tu.id IS NULL THEN NULL ELSE jsonb_build_object('name',tu.name,'email',tu.email) END AS assigned_to_team_user_id
      FROM public.tasks t
      LEFT JOIN public.cars c ON c.id=t.car_id AND c.team_id=p_team_id
      LEFT JOIN public.team_users tu ON tu.id=t.assigned_to_team_user_id AND tu.team_id=p_team_id
      WHERE t.team_id=p_team_id AND t.status NOT IN ('done','cancelled')
      ORDER BY t.created_at DESC LIMIT 8
    ) x), '[]'::jsonb),
    'attendance', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.check_in_at DESC) FROM (
      SELECT id,check_in_at,check_out_at,check_in_location_label FROM public.attendance_records
      WHERE team_id=p_team_id AND check_in_at >= date_trunc('day', now())
      ORDER BY check_in_at DESC LIMIT 50
    ) x), '[]'::jsonb),
    'stats', jsonb_build_object(
      'cars_total', (SELECT count(*) FROM car_flags),
      'cars_ready', (SELECT count(*) FROM car_flags WHERE NOT has_problems),
      'urgent_components', (SELECT count(*) FROM component_flags WHERE severity >= 3),
      'warning_components', (SELECT count(*) FROM component_flags WHERE severity = 2),
      'open_maintenances', (SELECT count(*) FROM public.maintenances WHERE team_id=p_team_id AND COALESCE(status,'') <> 'completed'),
      'upcoming_events', (SELECT count(*) FROM public.events WHERE team_id=p_team_id AND date >= current_date),
      'low_stock', (SELECT count(*) FROM public.inventory_items WHERE team_id=p_team_id AND archived_at IS NULL AND COALESCE(quantity,0) <= COALESCE(minimum_quantity,0)),
      'open_tasks', (SELECT count(*) FROM public.tasks WHERE team_id=p_team_id AND status NOT IN ('done','cancelled')),
      'attendance_open', (SELECT count(*) FROM public.attendance_records WHERE team_id=p_team_id AND check_in_at >= date_trunc('day',now()) AND check_out_at IS NULL),
      'attendance_in_track', (SELECT count(*) FROM public.attendance_records WHERE team_id=p_team_id AND check_in_at >= date_trunc('day',now()) AND lower(coalesce(check_in_location_label,'')) LIKE '%pista%')
    )
  ) INTO v_result;
  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.tasks_archive_page(
  p_team_id uuid,
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 50,
  p_search text DEFAULT NULL,
  p_status_filter text DEFAULT 'open',
  p_area_filter text DEFAULT 'all',
  p_priority_filter text DEFAULT 'all',
  p_assignee_filter text DEFAULT 'all',
  p_car_filter text DEFAULT 'all'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_page integer := greatest(coalesce(p_page,1),1);
  v_size integer := least(greatest(coalesce(p_page_size,50),1),100);
  v_offset integer;
  v_q text := lower(trim(coalesce(p_search,'')));
  v_result jsonb;
BEGIN
  IF NOT public.has_team_permission(p_team_id,'tasks.view') THEN
    RAISE EXCEPTION 'Utente non autorizzato per il team %', p_team_id;
  END IF;
  v_offset := (v_page-1)*v_size;

  WITH enriched AS (
    SELECT t.*,
      c.name AS car_name,
      co.type AS component_type, co.identifier AS component_identifier, co.car_id AS component_car_id,
      e.name AS event_name, e.date AS event_date,
      ii.name AS inventory_name,
      d.first_name AS driver_first_name, d.last_name AS driver_last_name,
      tu.name AS assignee_name, tu.email AS assignee_email, tu.role AS assignee_role
    FROM public.tasks t
    LEFT JOIN public.cars c ON c.id=t.car_id AND c.team_id=p_team_id
    LEFT JOIN public.components co ON co.id=t.component_id AND co.team_id=p_team_id
    LEFT JOIN public.events e ON e.id=t.event_id AND e.team_id=p_team_id
    LEFT JOIN public.inventory_items ii ON ii.id=t.inventory_item_id AND ii.team_id=p_team_id
    LEFT JOIN public.drivers d ON d.id=t.driver_id AND d.team_id=p_team_id
    LEFT JOIN public.team_users tu ON tu.id=t.assigned_to_team_user_id AND tu.team_id=p_team_id
    WHERE t.team_id=p_team_id
  ), filtered AS (
    SELECT * FROM enriched x
    WHERE
      (p_status_filter='all' OR (p_status_filter='open' AND x.status NOT IN ('done','cancelled')) OR (p_status_filter NOT IN ('all','open') AND x.status=p_status_filter))
      AND (p_area_filter='all' OR x.area=p_area_filter)
      AND (p_priority_filter='all' OR x.priority=p_priority_filter)
      AND (p_assignee_filter='all' OR (p_assignee_filter='unassigned' AND x.assigned_to_team_user_id IS NULL) OR (p_assignee_filter NOT IN ('all','unassigned') AND x.assigned_to_team_user_id::text=p_assignee_filter))
      AND (p_car_filter='all' OR (p_car_filter='__no_car' AND x.car_id IS NULL) OR (p_car_filter NOT IN ('all','__no_car') AND x.car_id::text=p_car_filter))
      AND (v_q='' OR lower(coalesce(x.title,'')||' '||coalesce(x.description,'')||' '||coalesce(x.car_name,'')||' '||coalesce(x.component_type,'')||' '||coalesce(x.component_identifier,'')||' '||coalesce(x.event_name,'')||' '||coalesce(x.inventory_name,'')||' '||coalesce(x.driver_first_name,'')||' '||coalesce(x.driver_last_name,'')||' '||coalesce(x.assignee_name,'')||' '||coalesce(x.assignee_email,'')) LIKE '%'||v_q||'%')
  ), paged AS (
    SELECT * FROM filtered ORDER BY created_at DESC LIMIT v_size OFFSET v_offset
  ), rows_json AS (
    SELECT jsonb_agg(
      to_jsonb(p) - 'car_name' - 'component_type' - 'component_identifier' - 'component_car_id' - 'event_name' - 'event_date' - 'inventory_name' - 'driver_first_name' - 'driver_last_name' - 'assignee_name' - 'assignee_email' - 'assignee_role'
      || jsonb_build_object(
        'car', CASE WHEN p.car_id IS NULL THEN NULL ELSE jsonb_build_object('id',p.car_id,'name',p.car_name) END,
        'component', CASE WHEN p.component_id IS NULL THEN NULL ELSE jsonb_build_object('id',p.component_id,'type',p.component_type,'identifier',p.component_identifier,'car_id',p.component_car_id) END,
        'event', CASE WHEN p.event_id IS NULL THEN NULL ELSE jsonb_build_object('id',p.event_id,'name',p.event_name,'date',p.event_date) END,
        'inventory_item', CASE WHEN p.inventory_item_id IS NULL THEN NULL ELSE jsonb_build_object('id',p.inventory_item_id,'name',p.inventory_name) END,
        'driver', CASE WHEN p.driver_id IS NULL THEN NULL ELSE jsonb_build_object('id',p.driver_id,'first_name',p.driver_first_name,'last_name',p.driver_last_name) END,
        'assigned_to', CASE WHEN p.assigned_to_team_user_id IS NULL THEN NULL ELSE jsonb_build_object('id',p.assigned_to_team_user_id,'name',p.assignee_name,'email',p.assignee_email,'role',p.assignee_role) END
      ) ORDER BY p.created_at DESC
    ) AS items FROM paged p
  )
  SELECT jsonb_build_object(
    'items', COALESCE((SELECT items FROM rows_json),'[]'::jsonb),
    'total',(SELECT count(*) FROM filtered),
    'page',v_page,'page_size',v_size,
    'stats',jsonb_build_object(
      'open_count',(SELECT count(*) FROM public.tasks WHERE team_id=p_team_id AND status NOT IN ('done','cancelled')),
      'urgent_open_count',(SELECT count(*) FROM public.tasks WHERE team_id=p_team_id AND status NOT IN ('done','cancelled') AND priority='urgent'),
      'due_soon_open_count',(SELECT count(*) FROM public.tasks WHERE team_id=p_team_id AND status NOT IN ('done','cancelled') AND due_date IS NOT NULL AND due_date <= current_date+7)
    )
  ) INTO v_result;
  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.events_archive_page(
  p_team_id uuid,
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_page integer := greatest(coalesce(p_page,1),1);
  v_size integer := least(greatest(coalesce(p_page_size,30),1),100);
  v_offset integer;
  v_result jsonb;
BEGIN
  IF NOT public.has_team_permission(p_team_id,'events.view') THEN
    RAISE EXCEPTION 'Utente non autorizzato per il team %', p_team_id;
  END IF;
  v_offset := (v_page-1)*v_size;

  WITH paged AS (
    SELECT e.id,e.date,e.name,e.notes,e.circuit_id,e.created_at,
      ci.name AS circuit_name,
      COALESCE(ec.event_cars,'[]'::jsonb) AS event_cars
    FROM public.events e
    LEFT JOIN public.circuits ci ON ci.id=e.circuit_id AND ci.team_id=p_team_id
    LEFT JOIN LATERAL (
      SELECT jsonb_agg(jsonb_build_object('id',x.id)) AS event_cars
      FROM (SELECT id FROM public.event_cars WHERE team_id=p_team_id AND event_id=e.id ORDER BY created_at LIMIT 200) x
    ) ec ON true
    WHERE e.team_id=p_team_id
    ORDER BY e.date DESC NULLS LAST,e.created_at DESC
    LIMIT v_size OFFSET v_offset
  )
  SELECT jsonb_build_object(
    'items',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',p.id,'date',p.date,'name',p.name,'notes',p.notes,'circuit_id',CASE WHEN p.circuit_id IS NULL THEN NULL ELSE jsonb_build_object('id',p.circuit_id,'name',p.circuit_name) END,'event_cars',p.event_cars) ORDER BY p.date DESC NULLS LAST,p.created_at DESC) FROM paged p),'[]'::jsonb),
    'total',(SELECT count(*) FROM public.events WHERE team_id=p_team_id),
    'linked_cars_total',(SELECT count(*) FROM public.event_cars WHERE team_id=p_team_id),
    'next_event_date',(SELECT min(date) FROM public.events WHERE team_id=p_team_id AND date>=current_date),
    'page',v_page,'page_size',v_size
  ) INTO v_result;
  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.drivers_archive_page(uuid,integer,integer,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.get_dashboard_operational_bundle(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.tasks_archive_page(uuid,integer,integer,text,text,text,text,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.events_archive_page(uuid,integer,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.drivers_archive_page(uuid,integer,integer,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_dashboard_operational_bundle(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tasks_archive_page(uuid,integer,integer,text,text,text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.events_archive_page(uuid,integer,integer) TO authenticated;
