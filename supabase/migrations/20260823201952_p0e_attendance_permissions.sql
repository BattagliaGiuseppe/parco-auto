-- P0-E.2B: Attendance permission enforcement.

create or replace function public.attendance_assert_manager(p_team_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_user_id uuid;
begin
  v_team_user_id := public.attendance_current_team_user_id(p_team_id);
  if v_team_user_id is null or not public.has_team_permission(p_team_id, 'attendance.manage') then
    raise exception 'Permesso attendance.manage richiesto per gestire le presenze';
  end if;
  return v_team_user_id;
end;
$$;

create or replace function public.attendance_ensure_staff_member(p_team_id uuid)
returns public.team_staff_members
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_user public.team_users%rowtype;
  v_staff public.team_staff_members%rowtype;
begin
  if not public.has_team_permission(p_team_id, 'attendance.clock_self') then
    raise exception 'Permesso attendance.clock_self richiesto';
  end if;

  select * into v_team_user
  from public.team_users
  where team_id = p_team_id
    and auth_user_id = auth.uid()
    and is_active = true
  order by created_at asc
  limit 1;

  if not found then raise exception 'Utente non associato a questo team'; end if;

  select * into v_staff
  from public.team_staff_members
  where team_id = p_team_id and team_user_id = v_team_user.id
  limit 1;

  if found then
    if v_staff.is_active = false then
      update public.team_staff_members set is_active = true where id = v_staff.id returning * into v_staff;
    end if;
    return v_staff;
  end if;

  insert into public.team_staff_members (
    team_id, team_user_id, full_name, email, role_label, is_active, created_by_team_user_id
  ) values (
    p_team_id, v_team_user.id,
    coalesce(nullif(v_team_user.name, ''), v_team_user.email, 'Membro team'),
    v_team_user.email, v_team_user.role, true, v_team_user.id
  ) returning * into v_staff;

  return v_staff;
end;
$$;

create or replace function public.attendance_clock_in(
  p_team_id uuid,
  p_location_label text default 'sede',
  p_event_id uuid default null,
  p_note text default null,
  p_lat numeric default null,
  p_lng numeric default null
)
returns public.attendance_records
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff public.team_staff_members%rowtype;
  v_record public.attendance_records%rowtype;
  v_team_user_id uuid;
begin
  if not public.has_team_permission(p_team_id, 'attendance.clock_self') then
    raise exception 'Permesso attendance.clock_self richiesto';
  end if;
  perform public.attendance_validate_location(p_location_label);
  v_staff := public.attendance_ensure_staff_member(p_team_id);
  v_team_user_id := v_staff.team_user_id;

  if p_event_id is not null and not exists (select 1 from public.events where id=p_event_id and team_id=p_team_id) then
    raise exception 'Evento non valido per questo team';
  end if;
  if exists (select 1 from public.attendance_records where team_id=p_team_id and staff_member_id=v_staff.id and check_out_at is null) then
    raise exception 'Risulti già presente. Registra prima l''uscita.';
  end if;

  insert into public.attendance_records (
    team_id, staff_member_id, event_id, check_in_source, check_in_location_label,
    check_in_lat, check_in_lng, check_in_note, created_by_team_user_id
  ) values (
    p_team_id, v_staff.id, p_event_id, 'self', p_location_label,
    p_lat, p_lng, nullif(p_note,''), v_team_user_id
  ) returning * into v_record;
  return v_record;
end;
$$;

create or replace function public.attendance_clock_out(
  p_team_id uuid,
  p_location_label text default 'sede',
  p_note text default null,
  p_lat numeric default null,
  p_lng numeric default null
)
returns public.attendance_records
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff public.team_staff_members%rowtype;
  v_record_id uuid;
  v_record public.attendance_records%rowtype;
  v_team_user_id uuid;
begin
  if not public.has_team_permission(p_team_id, 'attendance.clock_self') then
    raise exception 'Permesso attendance.clock_self richiesto';
  end if;
  perform public.attendance_validate_location(p_location_label);
  v_staff := public.attendance_ensure_staff_member(p_team_id);
  v_team_user_id := v_staff.team_user_id;

  select id into v_record_id from public.attendance_records
  where team_id=p_team_id and staff_member_id=v_staff.id and check_out_at is null
  order by check_in_at desc limit 1;
  if v_record_id is null then raise exception 'Nessuna timbratura aperta da chiudere.'; end if;

  update public.attendance_records
  set check_out_at=now(), check_out_source='self', check_out_location_label=p_location_label,
      check_out_lat=p_lat, check_out_lng=p_lng, check_out_note=nullif(p_note,''),
      updated_by_team_user_id=v_team_user_id
  where id=v_record_id returning * into v_record;
  return v_record;
end;
$$;

-- Keep existing kiosk behavior, but gate it with attendance.kiosk rather than generic membership.
create or replace function public.attendance_kiosk_clock(
  p_team_id uuid,
  p_badge_code text default null,
  p_pin_code text default null,
  p_location_label text default 'sede',
  p_event_id uuid default null,
  p_note text default null,
  p_mode text default 'toggle'
)
returns public.attendance_records
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_badge_norm text; v_pin_norm text; v_badge_hash text; v_pin_hash text;
  v_staff public.team_staff_members%rowtype; v_open_record_id uuid;
  v_record public.attendance_records%rowtype; v_team_user_id uuid;
  v_mode text; v_source text;
begin
  if not public.has_team_permission(p_team_id, 'attendance.kiosk') then
    raise exception 'Permesso attendance.kiosk richiesto';
  end if;
  perform public.attendance_validate_location(p_location_label);
  v_mode := coalesce(nullif(p_mode,''),'toggle');
  if v_mode not in ('toggle','in','out') then raise exception 'Modalità kiosk non valida'; end if;
  if p_event_id is not null and not exists (select 1 from public.events where id=p_event_id and team_id=p_team_id) then raise exception 'Evento non valido per questo team'; end if;
  v_badge_norm := public.attendance_normalize_badge(p_badge_code);
  v_pin_norm := public.attendance_normalize_pin(p_pin_code);
  if nullif(v_badge_norm,'') is null and nullif(v_pin_norm,'') is null then raise exception 'Inserisci badge o PIN rapido'; end if;
  if nullif(v_badge_norm,'') is not null then v_badge_hash := public.attendance_hash_secret(v_badge_norm); end if;
  if nullif(v_pin_norm,'') is not null then v_pin_hash := public.attendance_hash_secret(v_pin_norm); end if;

  select * into v_staff from public.team_staff_members sm
  where sm.team_id=p_team_id and sm.is_active=true
    and ((v_badge_hash is not null and sm.badge_code_hash=v_badge_hash) or (v_pin_hash is not null and sm.pin_hash=v_pin_hash))
  order by sm.updated_at desc limit 1;
  if not found then raise exception 'Badge o PIN non valido'; end if;

  select id into v_open_record_id from public.attendance_records
  where team_id=p_team_id and staff_member_id=v_staff.id and check_out_at is null
  order by check_in_at desc limit 1;
  v_team_user_id := public.attendance_current_team_user_id(p_team_id);
  v_source := case when p_event_id is not null or p_location_label='pista' then 'qr_event' else 'kiosk' end;
  if v_mode='toggle' then v_mode := case when v_open_record_id is null then 'in' else 'out' end; end if;

  if v_mode='in' then
    if v_open_record_id is not null then raise exception 'Questo membro risulta già presente. Registra prima l''uscita.'; end if;
    insert into public.attendance_records(team_id,staff_member_id,event_id,check_in_at,check_in_source,check_in_location_label,check_in_note,created_by_team_user_id,updated_by_team_user_id)
    values(p_team_id,v_staff.id,p_event_id,now(),v_source,p_location_label,nullif(p_note,''),v_team_user_id,v_team_user_id)
    returning * into v_record;
    return v_record;
  end if;

  if v_mode='out' then
    if v_open_record_id is null then raise exception 'Nessuna timbratura aperta da chiudere per questo membro.'; end if;
    update public.attendance_records set check_out_at=now(),check_out_source=v_source,check_out_location_label=p_location_label,
      check_out_note=nullif(p_note,''),updated_by_team_user_id=v_team_user_id
    where id=v_open_record_id returning * into v_record;
    return v_record;
  end if;
  raise exception 'Modalità kiosk non gestita';
end;
$$;

-- Summary is visible only with attendance.view.
create or replace function public.attendance_staff_summary(p_team_id uuid)
returns table(
  staff_member_id uuid, minutes_all_time numeric, minutes_since_reset numeric,
  records_count bigint, days_worked bigint, last_reset_at timestamptz,
  last_check_in_at timestamptz, latest_record_id uuid, open_record_id uuid
)
language sql
security definer
set search_path = public
as $$
  with staff as (
    select sm.id from public.team_staff_members sm
    where sm.team_id = p_team_id
      and public.has_team_permission(p_team_id, 'attendance.view')
  ),
  last_resets as (
    select distinct on (r.staff_member_id) r.staff_member_id, r.reset_at
    from public.attendance_counter_resets r where r.team_id=p_team_id
    order by r.staff_member_id,r.reset_at desc
  ),
  latest_records as (
    select distinct on (ar.staff_member_id) ar.staff_member_id,ar.id,ar.check_in_at
    from public.attendance_records ar where ar.team_id=p_team_id
    order by ar.staff_member_id,ar.check_in_at desc
  ),
  open_records as (
    select distinct on (ar.staff_member_id) ar.staff_member_id,ar.id
    from public.attendance_records ar where ar.team_id=p_team_id and ar.check_out_at is null
    order by ar.staff_member_id,ar.check_in_at desc
  ),
  aggregates as (
    select s.id as staff_member_id,
      coalesce(sum(extract(epoch from (coalesce(ar.check_out_at,now())-ar.check_in_at))/60),0)::numeric as minutes_all_time,
      coalesce(sum(case when ar.id is null then 0 when coalesce(ar.check_out_at,now())<=coalesce(lr.reset_at,'-infinity'::timestamptz) then 0 else extract(epoch from (coalesce(ar.check_out_at,now())-greatest(ar.check_in_at,coalesce(lr.reset_at,ar.check_in_at))))/60 end),0)::numeric as minutes_since_reset,
      count(ar.id)::bigint as records_count,
      count(distinct date(ar.check_in_at))::bigint as days_worked
    from staff s left join last_resets lr on lr.staff_member_id=s.id
    left join public.attendance_records ar on ar.staff_member_id=s.id and ar.team_id=p_team_id
    group by s.id
  )
  select s.id,a.minutes_all_time,a.minutes_since_reset,a.records_count,a.days_worked,
    lr.reset_at,latest.check_in_at,latest.id,open.id
  from staff s
  left join aggregates a on a.staff_member_id=s.id
  left join last_resets lr on lr.staff_member_id=s.id
  left join latest_records latest on latest.staff_member_id=s.id
  left join open_records open on open.staff_member_id=s.id
  order by s.id;
$$;

-- RLS: managers can administer; users with clock_self can see/update only their own attendance.
drop policy if exists attendance_records_select_team on public.attendance_records;
drop policy if exists attendance_records_insert_team_owner on public.attendance_records;
drop policy if exists attendance_records_update_team_owner on public.attendance_records;
drop policy if exists attendance_records_delete_manager on public.attendance_records;
create policy attendance_records_select_permission on public.attendance_records
for select to authenticated using (
  public.has_team_permission(team_id,'attendance.view')
  or (public.has_team_permission(team_id,'attendance.clock_self') and public.is_attendance_staff_owner(staff_member_id))
);
create policy attendance_records_insert_permission on public.attendance_records
for insert to authenticated with check (
  public.has_team_permission(team_id,'attendance.manage')
  or (public.has_team_permission(team_id,'attendance.clock_self') and public.is_attendance_staff_owner(staff_member_id))
);
create policy attendance_records_update_permission on public.attendance_records
for update to authenticated using (
  public.has_team_permission(team_id,'attendance.manage')
  or (public.has_team_permission(team_id,'attendance.clock_self') and public.is_attendance_staff_owner(staff_member_id))
) with check (
  public.has_team_permission(team_id,'attendance.manage')
  or (public.has_team_permission(team_id,'attendance.clock_self') and public.is_attendance_staff_owner(staff_member_id))
);
create policy attendance_records_delete_permission on public.attendance_records
for delete to authenticated using (public.has_team_permission(team_id,'attendance.manage'));

-- Staff directory.
drop policy if exists team_staff_members_select_team on public.team_staff_members;
drop policy if exists team_staff_members_insert_manager on public.team_staff_members;
drop policy if exists team_staff_members_update_manager on public.team_staff_members;
drop policy if exists team_staff_members_delete_manager on public.team_staff_members;
create policy team_staff_members_select_permission on public.team_staff_members
for select to authenticated using (
  public.has_team_permission(team_id,'attendance.view')
  or public.has_team_permission(team_id,'attendance.manage')
  or public.has_team_permission(team_id,'attendance.kiosk')
  or (public.has_team_permission(team_id,'attendance.clock_self') and public.is_attendance_staff_owner(id))
);
create policy team_staff_members_insert_permission on public.team_staff_members
for insert to authenticated with check (public.has_team_permission(team_id,'attendance.manage'));
create policy team_staff_members_update_permission on public.team_staff_members
for update to authenticated using (public.has_team_permission(team_id,'attendance.manage')) with check (public.has_team_permission(team_id,'attendance.manage'));
create policy team_staff_members_delete_permission on public.team_staff_members
for delete to authenticated using (public.has_team_permission(team_id,'attendance.manage'));

-- Counter resets.
drop policy if exists attendance_counter_resets_select_team on public.attendance_counter_resets;
drop policy if exists attendance_counter_resets_insert_manager on public.attendance_counter_resets;
drop policy if exists attendance_counter_resets_update_manager on public.attendance_counter_resets;
drop policy if exists attendance_counter_resets_delete_manager on public.attendance_counter_resets;
create policy attendance_counter_resets_select_permission on public.attendance_counter_resets
for select to authenticated using (public.has_team_permission(team_id,'attendance.view'));
create policy attendance_counter_resets_insert_permission on public.attendance_counter_resets
for insert to authenticated with check (public.has_team_permission(team_id,'attendance.manage'));
create policy attendance_counter_resets_update_permission on public.attendance_counter_resets
for update to authenticated using (public.has_team_permission(team_id,'attendance.manage')) with check (public.has_team_permission(team_id,'attendance.manage'));
create policy attendance_counter_resets_delete_permission on public.attendance_counter_resets
for delete to authenticated using (public.has_team_permission(team_id,'attendance.manage'));
