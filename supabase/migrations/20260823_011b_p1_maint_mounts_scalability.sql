CREATE OR REPLACE FUNCTION public.maintenances_archive_page(
  p_team_id uuid,
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 50,
  p_search text DEFAULT NULL,
  p_status_filter text DEFAULT 'all',
  p_car_filter text DEFAULT NULL
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
  IF NOT public.has_team_permission(p_team_id,'maintenances.view') THEN
    RAISE EXCEPTION 'Utente non autorizzato per il team %', p_team_id;
  END IF;
  v_offset := (v_page-1)*v_size;

  WITH enriched AS (
    SELECT m.*, ca.name AS car_name, co.identifier AS component_identifier, co.type AS component_type,
      tu.name AS assignee_name, tu.email AS assignee_email
    FROM public.maintenances m
    LEFT JOIN public.cars ca ON ca.id=m.car_id AND ca.team_id=p_team_id
    LEFT JOIN public.components co ON co.id=m.component_id AND co.team_id=p_team_id
    LEFT JOIN public.team_users tu ON tu.id=m.assigned_to_team_user_id AND tu.team_id=p_team_id
    WHERE m.team_id=p_team_id
  ), filtered AS (
    SELECT * FROM enriched e
    WHERE (coalesce(p_car_filter,'')='' OR e.car_id::text=p_car_filter)
      AND (v_status='all' OR (v_status='open' AND e.status<>'completed') OR (v_status='completed' AND e.status='completed'))
      AND (v_q='' OR lower(coalesce(e.type,'')||' '||coalesce(e.car_name,'')||' '||coalesce(e.component_identifier,'')||' '||coalesce(e.component_type,'')||' '||coalesce(e.notes,'')) LIKE '%'||v_q||'%')
  ), paged AS (
    SELECT * FROM filtered ORDER BY date DESC, created_at DESC, id LIMIT v_size OFFSET v_offset
  )
  SELECT jsonb_build_object(
    'items', COALESCE((SELECT jsonb_agg(
      to_jsonb(p) - 'car_name' - 'component_identifier' - 'component_type' - 'assignee_name' - 'assignee_email'
      || jsonb_build_object(
        'car_id', CASE WHEN p.car_id IS NULL THEN NULL ELSE jsonb_build_object('id',p.car_id,'name',p.car_name) END,
        'component_id', CASE WHEN p.component_id IS NULL THEN NULL ELSE jsonb_build_object('id',p.component_id,'identifier',p.component_identifier,'type',p.component_type) END,
        'assigned_to_team_user_id', CASE WHEN p.assigned_to_team_user_id IS NULL THEN NULL ELSE jsonb_build_object('id',p.assigned_to_team_user_id,'name',p.assignee_name,'email',p.assignee_email) END
      ) ORDER BY p.date DESC,p.created_at DESC) FROM paged p),'[]'::jsonb),
    'total', (SELECT count(*) FROM filtered),
    'page', v_page,
    'page_size', v_size,
    'stats', jsonb_build_object(
      'total', (SELECT count(*) FROM public.maintenances WHERE team_id=p_team_id),
      'open', (SELECT count(*) FROM public.maintenances WHERE team_id=p_team_id AND status<>'completed'),
      'cars_involved', (SELECT count(DISTINCT car_id) FROM public.maintenances WHERE team_id=p_team_id AND car_id IS NOT NULL),
      'components_involved', (SELECT count(DISTINCT component_id) FROM public.maintenances WHERE team_id=p_team_id AND component_id IS NOT NULL)
    )
  ) INTO v_result;
  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.mounts_archive_page(
  p_team_id uuid,
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 50,
  p_search text DEFAULT NULL,
  p_status_filter text DEFAULT 'all',
  p_car_filter text DEFAULT NULL
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
  IF NOT public.has_team_permission(p_team_id,'mounts.view') THEN
    RAISE EXCEPTION 'Utente non autorizzato per il team %', p_team_id;
  END IF;
  v_offset := (v_page-1)*v_size;

  WITH enriched AS (
    SELECT cc.*, ca.name AS car_name, co.type AS component_type, co.identifier AS component_identifier,
      mtu.name AS mounted_by_name, mtu.email AS mounted_by_email,
      rtu.name AS removed_by_name, rtu.email AS removed_by_email
    FROM public.car_components cc
    LEFT JOIN public.cars ca ON ca.id=cc.car_id AND ca.team_id=p_team_id
    LEFT JOIN public.components co ON co.id=cc.component_id AND co.team_id=p_team_id
    LEFT JOIN public.team_users mtu ON mtu.id=cc.mounted_by_team_user_id AND mtu.team_id=p_team_id
    LEFT JOIN public.team_users rtu ON rtu.id=cc.removed_by_team_user_id AND rtu.team_id=p_team_id
    WHERE cc.team_id=p_team_id
  ), filtered AS (
    SELECT * FROM enriched e
    WHERE (v_status='all' OR (v_status='active' AND e.removed_at IS NULL) OR (v_status='history' AND e.removed_at IS NOT NULL))
      AND (coalesce(p_car_filter,'')='' OR e.car_id::text=p_car_filter)
      AND (v_q='' OR lower(coalesce(e.component_identifier,'')||' '||coalesce(e.component_type,'')||' '||coalesce(e.car_name,'')||' '||coalesce(e.reason,'')) LIKE '%'||v_q||'%')
  ), paged AS (
    SELECT * FROM filtered ORDER BY created_at DESC,id LIMIT v_size OFFSET v_offset
  )
  SELECT jsonb_build_object(
    'items', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'id',p.id,'mounted_at',p.mounted_at,'removed_at',p.removed_at,'status',p.status,'reason',p.reason,
      'cars',jsonb_build_object('id',p.car_id,'name',p.car_name),
      'components',jsonb_build_object('id',p.component_id,'type',p.component_type,'identifier',p.component_identifier),
      'mounted_by_team_user_id',CASE WHEN p.mounted_by_team_user_id IS NULL THEN NULL ELSE jsonb_build_object('id',p.mounted_by_team_user_id,'name',p.mounted_by_name,'email',p.mounted_by_email) END,
      'removed_by_team_user_id',CASE WHEN p.removed_by_team_user_id IS NULL THEN NULL ELSE jsonb_build_object('id',p.removed_by_team_user_id,'name',p.removed_by_name,'email',p.removed_by_email) END
    ) ORDER BY p.created_at DESC) FROM paged p),'[]'::jsonb),
    'total', (SELECT count(*) FROM filtered),
    'page', v_page,
    'page_size', v_size,
    'stats', jsonb_build_object(
      'active', (SELECT count(*) FROM public.car_components WHERE team_id=p_team_id AND removed_at IS NULL),
      'history_total', (SELECT count(*) FROM public.car_components WHERE team_id=p_team_id),
      'cars_total', (SELECT count(*) FROM public.cars WHERE team_id=p_team_id),
      'free_components', (SELECT count(*) FROM public.components WHERE team_id=p_team_id AND car_id IS NULL)
    )
  ) INTO v_result;
  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.maintenances_archive_page(uuid,integer,integer,text,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mounts_archive_page(uuid,integer,integer,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.maintenances_archive_page(uuid,integer,integer,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mounts_archive_page(uuid,integer,integer,text,text,text) TO authenticated;
