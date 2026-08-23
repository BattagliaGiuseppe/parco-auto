-- P1.3 SaaS scalability batch: Cars, Components, Maintenances, Mounts, Attendance

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS cars_team_name_trgm_idx
  ON public.cars USING gin (lower(coalesce(name,'') || ' ' || coalesce(chassis_number,'')) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS components_team_identifier_trgm_idx
  ON public.components USING gin (lower(coalesce(identifier,'') || ' ' || coalesce(type,'') || ' ' || coalesce(notes,'')) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS maintenances_team_date_desc_idx
  ON public.maintenances (team_id, date DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS car_components_team_created_desc_idx
  ON public.car_components (team_id, created_at DESC);
CREATE INDEX IF NOT EXISTS attendance_records_team_checkin_desc_idx
  ON public.attendance_records (team_id, check_in_at DESC);


CREATE OR REPLACE FUNCTION public.cars_archive_page(
  p_team_id uuid,
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 30,
  p_search text DEFAULT NULL
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
  v_q text := lower(trim(coalesce(p_search,'')));
  v_result jsonb;
BEGIN
  IF NOT public.has_team_permission(p_team_id,'cars.view') THEN
    RAISE EXCEPTION 'Utente non autorizzato per il team %', p_team_id;
  END IF;
  v_offset := (v_page-1)*v_size;

  WITH filtered AS (
    SELECT c.id
    FROM public.cars c
    WHERE c.team_id=p_team_id
      AND (v_q='' OR lower(coalesce(c.name,'')||' '||coalesce(c.chassis_number,'')) LIKE '%'||v_q||'%')
  ), paged AS (
    SELECT c.* FROM public.cars c JOIN filtered f ON f.id=c.id
    ORDER BY c.created_at DESC, c.id
    LIMIT v_size OFFSET v_offset
  ), items AS (
    SELECT p.id,p.created_at,
      to_jsonb(p) || jsonb_build_object(
        'components', COALESCE((
          SELECT jsonb_agg(to_jsonb(co) ORDER BY co.identifier)
          FROM public.components co
          WHERE co.team_id=p_team_id AND co.car_id=p.id
        ),'[]'::jsonb)
      ) AS payload
    FROM paged p
  )
  SELECT jsonb_build_object(
    'items', COALESCE((SELECT jsonb_agg(i.payload ORDER BY i.created_at DESC, i.id) FROM items i),'[]'::jsonb),
    'total', (SELECT count(*) FROM filtered),
    'page', v_page,
    'page_size', v_size,
    'stats', jsonb_build_object(
      'cars_total', (SELECT count(*) FROM public.cars WHERE team_id=p_team_id),
      'definitions_total', (SELECT count(*) FROM public.team_component_definitions WHERE team_id=p_team_id),
      'available_components', (SELECT count(*) FROM public.components WHERE team_id=p_team_id AND car_id IS NULL),
      'critical_components', (SELECT count(*) FROM public.components co WHERE co.team_id=p_team_id AND (
        (co.expiry_date IS NOT NULL AND co.expiry_date < current_date)
        OR (co.revision_threshold_hours IS NOT NULL AND co.hours >= co.revision_threshold_hours)
        OR (co.warning_threshold_hours IS NOT NULL AND co.hours >= co.warning_threshold_hours)
        OR (co.expiry_date IS NOT NULL AND co.expiry_date BETWEEN current_date AND current_date + 30)
      ))
    )
  ) INTO v_result;
  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.components_archive_page(
  p_team_id uuid,
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 50,
  p_search text DEFAULT NULL,
  p_status_filter text DEFAULT 'all',
  p_car_filter text DEFAULT NULL,
  p_type_filter text DEFAULT NULL
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
  v_status text := lower(coalesce(p_status_filter,'all'));
  v_result jsonb;
BEGIN
  IF NOT public.has_team_permission(p_team_id,'components.view') THEN
    RAISE EXCEPTION 'Utente non autorizzato per il team %', p_team_id;
  END IF;
  v_offset := (v_page-1)*v_size;

  WITH enriched AS (
    SELECT co.*,
      ca.name AS car_name,
      CASE
        WHEN co.expiry_date IS NOT NULL AND co.expiry_date < current_date THEN 'revision'
        WHEN co.revision_threshold_hours IS NOT NULL AND co.hours >= co.revision_threshold_hours THEN 'revision'
        WHEN (co.warning_threshold_hours IS NOT NULL AND co.hours >= co.warning_threshold_hours)
          OR (co.expiry_date IS NOT NULL AND co.expiry_date BETWEEN current_date AND current_date + 30) THEN 'attention'
        WHEN co.car_id IS NOT NULL THEN 'mounted'
        ELSE 'unmounted'
      END AS status_code
    FROM public.components co
    LEFT JOIN public.cars ca ON ca.id=co.car_id AND ca.team_id=p_team_id
    WHERE co.team_id=p_team_id
  ), filtered AS (
    SELECT * FROM enriched e
    WHERE (v_status='all' OR e.status_code=v_status)
      AND (coalesce(p_car_filter,'')='' OR e.car_id::text=p_car_filter)
      AND (coalesce(p_type_filter,'')='' OR e.type=p_type_filter)
      AND (v_q='' OR lower(coalesce(e.identifier,'')||' '||coalesce(e.type,'')||' '||coalesce(e.car_name,'')||' '||coalesce(e.notes,'')) LIKE '%'||v_q||'%')
  ), paged AS (
    SELECT * FROM filtered ORDER BY identifier, id LIMIT v_size OFFSET v_offset
  )
  SELECT jsonb_build_object(
    'items', COALESCE((SELECT jsonb_agg(
      to_jsonb(p) - 'car_name' - 'status_code' || jsonb_build_object('car', CASE WHEN p.car_id IS NULL THEN NULL ELSE jsonb_build_object('name',p.car_name) END)
      ORDER BY p.identifier,p.id) FROM paged p),'[]'::jsonb),
    'total', (SELECT count(*) FROM filtered),
    'page', v_page,
    'page_size', v_size,
    'type_options', COALESCE((SELECT jsonb_agg(x.type ORDER BY x.type) FROM (SELECT DISTINCT type FROM public.components WHERE team_id=p_team_id) x),'[]'::jsonb),
    'stats', jsonb_build_object(
      'total', (SELECT count(*) FROM enriched),
      'mounted', (SELECT count(*) FROM enriched WHERE status_code='mounted'),
      'unmounted', (SELECT count(*) FROM enriched WHERE status_code='unmounted'),
      'attention', (SELECT count(*) FROM enriched WHERE status_code='attention'),
      'revision', (SELECT count(*) FROM enriched WHERE status_code='revision')
    )
  ) INTO v_result;
  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.cars_archive_page(uuid,integer,integer,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.components_archive_page(uuid,integer,integer,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cars_archive_page(uuid,integer,integer,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.components_archive_page(uuid,integer,integer,text,text,text,text) TO authenticated;
