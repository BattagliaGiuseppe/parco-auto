-- Ripristina il modello Presenze precedente a P0-E.2B (manager = owner/admin via is_team_manager).

CREATE OR REPLACE FUNCTION public.attendance_assert_manager(p_team_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_team_user_id uuid;
BEGIN
  v_team_user_id := public.attendance_current_team_user_id(p_team_id);
  IF v_team_user_id IS NULL OR NOT public.is_team_manager(p_team_id) THEN
    RAISE EXCEPTION 'Permesso non sufficiente per gestire le presenze';
  END IF;
  RETURN v_team_user_id;
END; $$;

CREATE OR REPLACE FUNCTION public.attendance_ensure_staff_member(p_team_id uuid)
RETURNS public.team_staff_members LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_team_user public.team_users%rowtype; v_staff public.team_staff_members%rowtype;
BEGIN
  SELECT * INTO v_team_user FROM public.team_users
  WHERE team_id=p_team_id AND auth_user_id=auth.uid() AND is_active=true
  ORDER BY created_at ASC LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Utente non associato a questo team'; END IF;

  SELECT * INTO v_staff FROM public.team_staff_members
  WHERE team_id=p_team_id AND team_user_id=v_team_user.id LIMIT 1;
  IF FOUND THEN
    IF v_staff.is_active=false THEN
      UPDATE public.team_staff_members SET is_active=true WHERE id=v_staff.id RETURNING * INTO v_staff;
    END IF;
    RETURN v_staff;
  END IF;

  INSERT INTO public.team_staff_members(team_id,team_user_id,full_name,email,role_label,is_active,created_by_team_user_id)
  VALUES(p_team_id,v_team_user.id,coalesce(nullif(v_team_user.name,''),v_team_user.email,'Membro team'),v_team_user.email,v_team_user.role,true,v_team_user.id)
  RETURNING * INTO v_staff;
  RETURN v_staff;
END; $$;

CREATE OR REPLACE FUNCTION public.attendance_clock_in(
 p_team_id uuid,p_location_label text DEFAULT 'sede',p_event_id uuid DEFAULT NULL,p_note text DEFAULT NULL,p_lat numeric DEFAULT NULL,p_lng numeric DEFAULT NULL
) RETURNS public.attendance_records LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_staff public.team_staff_members%rowtype; v_record public.attendance_records%rowtype; v_team_user_id uuid;
BEGIN
  IF p_location_label NOT IN ('sede','pista','altro') THEN RAISE EXCEPTION 'Luogo timbratura non valido'; END IF;
  v_staff:=public.attendance_ensure_staff_member(p_team_id); v_team_user_id:=v_staff.team_user_id;
  IF p_event_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.events WHERE id=p_event_id AND team_id=p_team_id) THEN RAISE EXCEPTION 'Evento non valido per questo team'; END IF;
  IF EXISTS(SELECT 1 FROM public.attendance_records WHERE team_id=p_team_id AND staff_member_id=v_staff.id AND check_out_at IS NULL) THEN RAISE EXCEPTION 'Risulti già presente. Registra prima l''uscita.'; END IF;
  INSERT INTO public.attendance_records(team_id,staff_member_id,event_id,check_in_source,check_in_location_label,check_in_lat,check_in_lng,check_in_note,created_by_team_user_id)
  VALUES(p_team_id,v_staff.id,p_event_id,'self',p_location_label,p_lat,p_lng,nullif(p_note,''),v_team_user_id) RETURNING * INTO v_record;
  RETURN v_record;
END; $$;

CREATE OR REPLACE FUNCTION public.attendance_clock_out(
 p_team_id uuid,p_location_label text DEFAULT 'sede',p_note text DEFAULT NULL,p_lat numeric DEFAULT NULL,p_lng numeric DEFAULT NULL
) RETURNS public.attendance_records LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_staff public.team_staff_members%rowtype; v_record_id uuid; v_record public.attendance_records%rowtype; v_team_user_id uuid;
BEGIN
  IF p_location_label NOT IN ('sede','pista','altro') THEN RAISE EXCEPTION 'Luogo timbratura non valido'; END IF;
  v_staff:=public.attendance_ensure_staff_member(p_team_id); v_team_user_id:=v_staff.team_user_id;
  SELECT id INTO v_record_id FROM public.attendance_records
  WHERE team_id=p_team_id AND staff_member_id=v_staff.id AND check_out_at IS NULL
  ORDER BY check_in_at DESC LIMIT 1;
  IF v_record_id IS NULL THEN RAISE EXCEPTION 'Nessuna timbratura aperta da chiudere.'; END IF;
  UPDATE public.attendance_records SET check_out_at=now(),check_out_source='self',check_out_location_label=p_location_label,
    check_out_lat=p_lat,check_out_lng=p_lng,check_out_note=nullif(p_note,''),updated_by_team_user_id=v_team_user_id
  WHERE id=v_record_id RETURNING * INTO v_record;
  RETURN v_record;
END; $$;

CREATE OR REPLACE FUNCTION public.attendance_kiosk_clock(
 p_team_id uuid,p_badge_code text DEFAULT NULL,p_pin_code text DEFAULT NULL,p_location_label text DEFAULT 'sede',p_event_id uuid DEFAULT NULL,p_note text DEFAULT NULL,p_mode text DEFAULT 'toggle'
) RETURNS public.attendance_records LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','extensions' AS $$
DECLARE v_badge_norm text; v_pin_norm text; v_badge_hash text; v_pin_hash text; v_staff public.team_staff_members%rowtype; v_open_record_id uuid; v_record public.attendance_records%rowtype; v_team_user_id uuid; v_mode text; v_source text;
BEGIN
  IF NOT public.is_team_member(p_team_id) THEN RAISE EXCEPTION 'Accesso non autorizzato al kiosk presenze'; END IF;
  PERFORM public.attendance_validate_location(p_location_label);
  v_mode:=coalesce(nullif(p_mode,''),'toggle'); IF v_mode NOT IN ('toggle','in','out') THEN RAISE EXCEPTION 'Modalità kiosk non valida'; END IF;
  IF p_event_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.events WHERE id=p_event_id AND team_id=p_team_id) THEN RAISE EXCEPTION 'Evento non valido per questo team'; END IF;
  v_badge_norm:=public.attendance_normalize_badge(p_badge_code); v_pin_norm:=public.attendance_normalize_pin(p_pin_code);
  IF nullif(v_badge_norm,'') IS NULL AND nullif(v_pin_norm,'') IS NULL THEN RAISE EXCEPTION 'Inserisci badge o PIN rapido'; END IF;
  IF nullif(v_badge_norm,'') IS NOT NULL THEN v_badge_hash:=public.attendance_hash_secret(v_badge_norm); END IF;
  IF nullif(v_pin_norm,'') IS NOT NULL THEN v_pin_hash:=public.attendance_hash_secret(v_pin_norm); END IF;
  SELECT * INTO v_staff FROM public.team_staff_members sm
  WHERE sm.team_id=p_team_id AND sm.is_active=true AND ((v_badge_hash IS NOT NULL AND sm.badge_code_hash=v_badge_hash) OR (v_pin_hash IS NOT NULL AND sm.pin_hash=v_pin_hash))
  ORDER BY sm.updated_at DESC LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Badge o PIN non valido'; END IF;
  SELECT id INTO v_open_record_id FROM public.attendance_records WHERE team_id=p_team_id AND staff_member_id=v_staff.id AND check_out_at IS NULL ORDER BY check_in_at DESC LIMIT 1;
  v_team_user_id:=public.attendance_current_team_user_id(p_team_id); v_source:=CASE WHEN p_event_id IS NOT NULL OR p_location_label='pista' THEN 'qr_event' ELSE 'kiosk' END;
  IF v_mode='toggle' THEN v_mode:=CASE WHEN v_open_record_id IS NULL THEN 'in' ELSE 'out' END; END IF;
  IF v_mode='in' THEN
    IF v_open_record_id IS NOT NULL THEN RAISE EXCEPTION 'Questo membro risulta già presente. Registra prima l''uscita.'; END IF;
    INSERT INTO public.attendance_records(team_id,staff_member_id,event_id,check_in_at,check_in_source,check_in_location_label,check_in_note,created_by_team_user_id,updated_by_team_user_id)
    VALUES(p_team_id,v_staff.id,p_event_id,now(),v_source,p_location_label,nullif(p_note,''),v_team_user_id,v_team_user_id) RETURNING * INTO v_record; RETURN v_record;
  END IF;
  IF v_mode='out' THEN
    IF v_open_record_id IS NULL THEN RAISE EXCEPTION 'Nessuna timbratura aperta da chiudere per questo membro.'; END IF;
    UPDATE public.attendance_records SET check_out_at=now(),check_out_source=v_source,check_out_location_label=p_location_label,check_out_note=nullif(p_note,''),updated_by_team_user_id=v_team_user_id
    WHERE id=v_open_record_id RETURNING * INTO v_record; RETURN v_record;
  END IF;
  RAISE EXCEPTION 'Modalità kiosk non gestita';
END; $$;

CREATE OR REPLACE FUNCTION public.attendance_staff_summary(p_team_id uuid)
RETURNS TABLE(staff_member_id uuid,minutes_all_time numeric,minutes_since_reset numeric,records_count bigint,days_worked bigint,last_reset_at timestamptz,last_check_in_at timestamptz,latest_record_id uuid,open_record_id uuid)
LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
WITH staff AS (
  SELECT sm.id FROM public.team_staff_members sm WHERE sm.team_id=p_team_id AND public.is_team_member(sm.team_id)
), last_resets AS (
  SELECT DISTINCT ON(r.staff_member_id) r.staff_member_id,r.reset_at FROM public.attendance_counter_resets r WHERE r.team_id=p_team_id ORDER BY r.staff_member_id,r.reset_at DESC
), latest_records AS (
  SELECT DISTINCT ON(ar.staff_member_id) ar.staff_member_id,ar.id,ar.check_in_at FROM public.attendance_records ar WHERE ar.team_id=p_team_id ORDER BY ar.staff_member_id,ar.check_in_at DESC
), open_records AS (
  SELECT DISTINCT ON(ar.staff_member_id) ar.staff_member_id,ar.id FROM public.attendance_records ar WHERE ar.team_id=p_team_id AND ar.check_out_at IS NULL ORDER BY ar.staff_member_id,ar.check_in_at DESC
), aggregates AS (
  SELECT s.id staff_member_id,
    coalesce(sum(extract(epoch from(coalesce(ar.check_out_at,now())-ar.check_in_at))/60),0)::numeric minutes_all_time,
    coalesce(sum(CASE WHEN ar.id IS NULL THEN 0 WHEN coalesce(ar.check_out_at,now())<=coalesce(lr.reset_at,'-infinity'::timestamptz) THEN 0 ELSE extract(epoch from(coalesce(ar.check_out_at,now())-greatest(ar.check_in_at,coalesce(lr.reset_at,ar.check_in_at))))/60 END),0)::numeric minutes_since_reset,
    count(ar.id)::bigint records_count,count(distinct date(ar.check_in_at))::bigint days_worked
  FROM staff s LEFT JOIN last_resets lr ON lr.staff_member_id=s.id LEFT JOIN public.attendance_records ar ON ar.staff_member_id=s.id AND ar.team_id=p_team_id GROUP BY s.id
)
SELECT s.id,a.minutes_all_time,a.minutes_since_reset,a.records_count,a.days_worked,lr.reset_at,latest.check_in_at,latest.id,open.id
FROM staff s LEFT JOIN aggregates a ON a.staff_member_id=s.id LEFT JOIN last_resets lr ON lr.staff_member_id=s.id LEFT JOIN latest_records latest ON latest.staff_member_id=s.id LEFT JOIN open_records open ON open.staff_member_id=s.id ORDER BY s.id;
$$;

DROP POLICY IF EXISTS attendance_records_select_permission ON public.attendance_records;
DROP POLICY IF EXISTS attendance_records_insert_permission ON public.attendance_records;
DROP POLICY IF EXISTS attendance_records_update_permission ON public.attendance_records;
DROP POLICY IF EXISTS attendance_records_delete_permission ON public.attendance_records;
CREATE POLICY attendance_records_select_team ON public.attendance_records FOR SELECT USING (public.is_team_member(team_id));
CREATE POLICY attendance_records_insert_team_owner ON public.attendance_records FOR INSERT WITH CHECK (public.is_team_manager(team_id) OR public.is_attendance_staff_owner(staff_member_id));
CREATE POLICY attendance_records_update_team_owner ON public.attendance_records FOR UPDATE USING (public.is_team_manager(team_id) OR public.is_attendance_staff_owner(staff_member_id)) WITH CHECK (public.is_team_manager(team_id) OR public.is_attendance_staff_owner(staff_member_id));
CREATE POLICY attendance_records_delete_manager ON public.attendance_records FOR DELETE USING (public.is_team_manager(team_id));

DROP POLICY IF EXISTS team_staff_members_select_permission ON public.team_staff_members;
DROP POLICY IF EXISTS team_staff_members_insert_permission ON public.team_staff_members;
DROP POLICY IF EXISTS team_staff_members_update_permission ON public.team_staff_members;
DROP POLICY IF EXISTS team_staff_members_delete_permission ON public.team_staff_members;
CREATE POLICY team_staff_members_select_team ON public.team_staff_members FOR SELECT USING (public.is_team_member(team_id));
CREATE POLICY team_staff_members_insert_manager ON public.team_staff_members FOR INSERT WITH CHECK (public.is_team_manager(team_id));
CREATE POLICY team_staff_members_update_manager ON public.team_staff_members FOR UPDATE USING (public.is_team_manager(team_id)) WITH CHECK (public.is_team_manager(team_id));
CREATE POLICY team_staff_members_delete_manager ON public.team_staff_members FOR DELETE USING (public.is_team_manager(team_id));

DROP POLICY IF EXISTS attendance_counter_resets_select_permission ON public.attendance_counter_resets;
DROP POLICY IF EXISTS attendance_counter_resets_insert_permission ON public.attendance_counter_resets;
DROP POLICY IF EXISTS attendance_counter_resets_update_permission ON public.attendance_counter_resets;
DROP POLICY IF EXISTS attendance_counter_resets_delete_permission ON public.attendance_counter_resets;
CREATE POLICY attendance_counter_resets_select_team ON public.attendance_counter_resets FOR SELECT USING (public.is_team_member(team_id));
CREATE POLICY attendance_counter_resets_insert_manager ON public.attendance_counter_resets FOR INSERT WITH CHECK (public.is_team_manager(team_id));
CREATE POLICY attendance_counter_resets_update_manager ON public.attendance_counter_resets FOR UPDATE USING (public.is_team_manager(team_id)) WITH CHECK (public.is_team_manager(team_id));
CREATE POLICY attendance_counter_resets_delete_manager ON public.attendance_counter_resets FOR DELETE USING (public.is_team_manager(team_id));
