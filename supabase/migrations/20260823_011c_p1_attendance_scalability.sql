CREATE OR REPLACE FUNCTION public.attendance_console_page(
  p_team_id uuid,
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 50,
  p_search text DEFAULT NULL,
  p_status_filter text DEFAULT 'all',
  p_location_filter text DEFAULT 'all',
  p_since_days integer DEFAULT 180
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
  v_location text := lower(coalesce(p_location_filter,'all'));
  v_since timestamptz := date_trunc('day',now()) - make_interval(days => least(greatest(coalesce(p_since_days,180),1),730));
  v_result jsonb;
BEGIN
  IF NOT public.has_team_permission(p_team_id,'attendance.view') THEN
    RAISE EXCEPTION 'Utente non autorizzato per il team %', p_team_id;
  END IF;
  v_offset := (v_page-1)*v_size;

  WITH enriched AS (
    SELECT ar.*, sm.full_name,sm.email,sm.phone,sm.role_label,sm.is_active,
      e.name AS event_name,e.date AS event_date
    FROM public.attendance_records ar
    JOIN public.team_staff_members sm ON sm.id=ar.staff_member_id AND sm.team_id=p_team_id
    LEFT JOIN public.events e ON e.id=ar.event_id AND e.team_id=p_team_id
    WHERE ar.team_id=p_team_id AND ar.check_in_at>=v_since
  ), filtered AS (
    SELECT * FROM enriched r
    WHERE (v_location='all' OR lower(coalesce(r.check_in_location_label,''))=v_location)
      AND (v_status='all' OR (v_status='present' AND r.check_out_at IS NULL) OR v_status='absent')
      AND (v_status<>'absent')
      AND (v_q='' OR lower(coalesce(r.full_name,'')||' '||coalesce(r.email,'')||' '||coalesce(r.event_name,'')||' '||coalesce(r.check_in_note,'')||' '||coalesce(r.check_out_note,'')) LIKE '%'||v_q||'%')
  ), paged AS (
    SELECT * FROM filtered ORDER BY check_in_at DESC,id LIMIT v_size OFFSET v_offset
  )
  SELECT jsonb_build_object(
    'records', COALESCE((SELECT jsonb_agg(
      to_jsonb(p) - 'full_name' - 'email' - 'phone' - 'role_label' - 'is_active' - 'event_name' - 'event_date'
      || jsonb_build_object(
        'staff_member',jsonb_build_object('id',p.staff_member_id,'team_id',p.team_id,'full_name',p.full_name,'email',p.email,'phone',p.phone,'role_label',p.role_label,'is_active',p.is_active),
        'event',CASE WHEN p.event_id IS NULL THEN NULL ELSE jsonb_build_object('id',p.event_id,'name',p.event_name,'date',p.event_date) END
      ) ORDER BY p.check_in_at DESC) FROM paged p),'[]'::jsonb),
    'total', (SELECT count(*) FROM filtered),
    'page', v_page,
    'page_size', v_size,
    'active_records', COALESCE((
      SELECT jsonb_agg(to_jsonb(a) ORDER BY a.check_in_at DESC)
      FROM (
        SELECT ar.*
        FROM public.attendance_records ar
        WHERE ar.team_id=p_team_id AND ar.check_out_at IS NULL
        ORDER BY ar.check_in_at DESC
      ) a
    ), '[]'::jsonb),
    'latest_records', COALESCE((
      SELECT jsonb_agg(to_jsonb(x) ORDER BY x.check_in_at DESC)
      FROM (
        SELECT DISTINCT ON (ar.staff_member_id) ar.*
        FROM public.attendance_records ar
        WHERE ar.team_id=p_team_id
        ORDER BY ar.staff_member_id, ar.check_in_at DESC
      ) x
    ), '[]'::jsonb),
    'today', jsonb_build_object(
      'records_count',(SELECT count(*) FROM public.attendance_records WHERE team_id=p_team_id AND check_in_at>=date_trunc('day',now())),
      'minutes',COALESCE((SELECT round(sum(extract(epoch from (coalesce(check_out_at,now())-check_in_at))/60.0))::integer FROM public.attendance_records WHERE team_id=p_team_id AND check_in_at>=date_trunc('day',now())),0),
      'track_presence',(SELECT count(*) FROM public.attendance_records WHERE team_id=p_team_id AND check_in_at>=date_trunc('day',now()) AND check_out_at IS NULL AND check_in_location_label='pista')
    )
  ) INTO v_result;
  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.attendance_console_page(uuid,integer,integer,text,text,text,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.attendance_console_page(uuid,integer,integer,text,text,text,integer) TO authenticated;
