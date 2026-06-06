-- =========================================
-- PARCO AUTO · TIMBRATURA RAPIDA STAFF
-- Protezione modulo Presenze completo + pagina personale /attendance/quick
-- =========================================

-- Permessi: il modulo completo Presenze resta ad owner/admin.
-- Lo staff mantiene solo la timbratura personale.
insert into public.app_permissions (code, label, description)
values
  ('attendance.view', 'Visualizza presenze', 'Accesso al modulo completo presenze, riepiloghi e statistiche'),
  ('attendance.clock_self', 'Timbratura personale', 'Entrata e uscita dal proprio account o pagina rapida'),
  ('attendance.manage', 'Gestisci presenze', 'Gestione staff, correzioni e timbrature per conto di altri'),
  ('attendance.kiosk', 'Kiosk presenze', 'Uso della modalità tablet, badge, PIN e QR evento per le presenze'),
  ('attendance.export', 'Esporta presenze', 'Esportazione riepiloghi presenze')
on conflict (code) do update
set label = excluded.label,
    description = excluded.description;

-- Rimuove la vista completa dai ruoli staff standard.
delete from public.role_permissions
where permission_code = 'attendance.view'
  and role not in ('owner', 'admin');

delete from public.role_permissions
where permission_code in ('attendance.manage', 'attendance.kiosk', 'attendance.export')
  and role not in ('owner', 'admin');

-- Garantisce i permessi corretti.
insert into public.role_permissions (role, permission_code)
values
  ('owner', 'attendance.view'),
  ('owner', 'attendance.clock_self'),
  ('owner', 'attendance.manage'),
  ('owner', 'attendance.kiosk'),
  ('owner', 'attendance.export'),
  ('admin', 'attendance.view'),
  ('admin', 'attendance.clock_self'),
  ('admin', 'attendance.manage'),
  ('admin', 'attendance.kiosk'),
  ('admin', 'attendance.export'),
  ('engineer', 'attendance.clock_self'),
  ('mechanic', 'attendance.clock_self'),
  ('viewer', 'attendance.clock_self')
on conflict do nothing;

-- RLS più restrittive: owner/admin vedono tutto, lo staff vede solo il proprio profilo e le proprie timbrature.
drop policy if exists team_staff_members_select_team on public.team_staff_members;
create policy team_staff_members_select_team
on public.team_staff_members
for select
using (
  public.is_team_manager(team_id)
  or public.is_attendance_staff_owner(id)
);

drop policy if exists attendance_records_select_team on public.attendance_records;
create policy attendance_records_select_team
on public.attendance_records
for select
using (
  public.is_team_manager(team_id)
  or public.is_attendance_staff_owner(staff_member_id)
);

-- I reset contatori sono dati amministrativi: solo owner/admin.
drop policy if exists attendance_counter_resets_select_team on public.attendance_counter_resets;
create policy attendance_counter_resets_select_team
on public.attendance_counter_resets
for select
using (public.is_team_manager(team_id));

-- Riepiloghi staff: solo owner/admin. Lo staff usa la pagina rapida e vede solo lo stato personale.
create or replace function public.attendance_staff_summary(p_team_id uuid)
returns table (
  staff_member_id uuid,
  minutes_all_time numeric,
  minutes_since_reset numeric,
  records_count bigint,
  days_worked bigint,
  last_reset_at timestamptz,
  last_check_in_at timestamptz,
  latest_record_id uuid,
  open_record_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_team_manager(p_team_id) then
    raise exception 'Permesso non sufficiente per visualizzare i riepiloghi presenze';
  end if;

  return query
  with staff as (
    select sm.id
    from public.team_staff_members sm
    where sm.team_id = p_team_id
  ),
  last_resets as (
    select distinct on (r.staff_member_id)
      r.staff_member_id,
      r.reset_at
    from public.attendance_counter_resets r
    where r.team_id = p_team_id
    order by r.staff_member_id, r.reset_at desc
  ),
  latest_records as (
    select distinct on (ar.staff_member_id)
      ar.staff_member_id,
      ar.id,
      ar.check_in_at
    from public.attendance_records ar
    where ar.team_id = p_team_id
    order by ar.staff_member_id, ar.check_in_at desc
  ),
  open_records as (
    select distinct on (ar.staff_member_id)
      ar.staff_member_id,
      ar.id
    from public.attendance_records ar
    where ar.team_id = p_team_id
      and ar.check_out_at is null
    order by ar.staff_member_id, ar.check_in_at desc
  ),
  aggregates as (
    select
      s.id as staff_member_id,
      coalesce(sum(extract(epoch from (coalesce(ar.check_out_at, now()) - ar.check_in_at)) / 60), 0)::numeric as minutes_all_time,
      coalesce(sum(
        case
          when ar.id is null then 0
          when coalesce(ar.check_out_at, now()) <= coalesce(lr.reset_at, '-infinity'::timestamptz) then 0
          else extract(epoch from (coalesce(ar.check_out_at, now()) - greatest(ar.check_in_at, coalesce(lr.reset_at, ar.check_in_at)))) / 60
        end
      ), 0)::numeric as minutes_since_reset,
      count(ar.id)::bigint as records_count,
      count(distinct date(ar.check_in_at))::bigint as days_worked
    from staff s
    left join last_resets lr on lr.staff_member_id = s.id
    left join public.attendance_records ar on ar.staff_member_id = s.id and ar.team_id = p_team_id
    group by s.id
  )
  select
    s.id as staff_member_id,
    a.minutes_all_time,
    a.minutes_since_reset,
    a.records_count,
    a.days_worked,
    lr.reset_at as last_reset_at,
    latest.check_in_at as last_check_in_at,
    latest.id as latest_record_id,
    open.id as open_record_id
  from staff s
  left join aggregates a on a.staff_member_id = s.id
  left join last_resets lr on lr.staff_member_id = s.id
  left join latest_records latest on latest.staff_member_id = s.id
  left join open_records open on open.staff_member_id = s.id
  order by s.id;
end;
$$;

grant execute on function public.attendance_staff_summary(uuid) to authenticated;
