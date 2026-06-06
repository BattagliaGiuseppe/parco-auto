-- =========================================
-- PARCO AUTO · PRESENZE KIOSK / BADGE / QR
-- Estensione per tablet officina/pista, badge personale, PIN rapido e QR evento
-- =========================================

create extension if not exists pgcrypto with schema extensions;

alter table public.team_staff_members
  add column if not exists badge_code_hint text,
  add column if not exists pin_hint text,
  add column if not exists badge_rotated_at timestamptz,
  add column if not exists pin_rotated_at timestamptz;

create or replace function public.attendance_normalize_badge(p_value text)
returns text
language sql
immutable
as $$
  select upper(regexp_replace(coalesce(p_value, ''), '[^A-Za-z0-9]', '', 'g'));
$$;

create or replace function public.attendance_normalize_pin(p_value text)
returns text
language sql
immutable
as $$
  select regexp_replace(coalesce(p_value, ''), '[^0-9]', '', 'g');
$$;

create or replace function public.attendance_hash_secret(p_value text)
returns text
language sql
immutable
set search_path = public, extensions
as $$
  select encode(digest(coalesce(p_value, ''), 'sha256'), 'hex');
$$;

create or replace function public.attendance_generate_badge_credentials(
  p_team_id uuid,
  p_staff_member_id uuid,
  p_regenerate_badge boolean default true,
  p_generate_pin boolean default true,
  p_pin_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_staff public.team_staff_members%rowtype;
  v_team_user_id uuid;
  v_raw_badge text;
  v_badge_code text;
  v_badge_norm text;
  v_pin_code text;
  v_pin_norm text;
begin
  v_team_user_id := public.attendance_assert_manager(p_team_id);
  v_staff := public.attendance_validate_staff(p_team_id, p_staff_member_id);

  if coalesce(p_regenerate_badge, true) then
    v_raw_badge := upper(encode(gen_random_bytes(6), 'hex'));
    v_badge_code := substr(v_raw_badge, 1, 4) || '-' || substr(v_raw_badge, 5, 4) || '-' || substr(v_raw_badge, 9, 4);
    v_badge_norm := public.attendance_normalize_badge(v_badge_code);

    update public.team_staff_members
    set badge_code_hash = public.attendance_hash_secret(v_badge_norm),
        badge_code_hint = right(v_badge_norm, 4),
        badge_rotated_at = now()
    where id = p_staff_member_id
      and team_id = p_team_id;
  end if;

  if coalesce(p_generate_pin, true) then
    if nullif(p_pin_code, '') is not null then
      v_pin_norm := public.attendance_normalize_pin(p_pin_code);
      if length(v_pin_norm) < 4 or length(v_pin_norm) > 8 then
        raise exception 'Il PIN deve contenere da 4 a 8 cifre';
      end if;
      v_pin_code := v_pin_norm;
    else
      v_pin_code := lpad((floor(random() * 10000)::int)::text, 4, '0');
      v_pin_norm := v_pin_code;
    end if;

    update public.team_staff_members
    set pin_hash = public.attendance_hash_secret(v_pin_norm),
        pin_hint = right(v_pin_norm, 2),
        pin_rotated_at = now()
    where id = p_staff_member_id
      and team_id = p_team_id;
  end if;

  return jsonb_build_object(
    'badge_code', v_badge_code,
    'pin_code', v_pin_code,
    'badge_hint', case when v_badge_norm is not null then right(v_badge_norm, 4) else v_staff.badge_code_hint end,
    'pin_hint', case when v_pin_norm is not null then right(v_pin_norm, 2) else v_staff.pin_hint end,
    'generated_at', now()
  );
end;
$$;

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
  v_badge_norm text;
  v_pin_norm text;
  v_badge_hash text;
  v_pin_hash text;
  v_staff public.team_staff_members%rowtype;
  v_open_record_id uuid;
  v_record public.attendance_records%rowtype;
  v_team_user_id uuid;
  v_mode text;
  v_source text;
begin
  if not public.is_team_member(p_team_id) then
    raise exception 'Accesso non autorizzato al kiosk presenze';
  end if;

  perform public.attendance_validate_location(p_location_label);

  v_mode := coalesce(nullif(p_mode, ''), 'toggle');
  if v_mode not in ('toggle', 'in', 'out') then
    raise exception 'Modalità kiosk non valida';
  end if;

  if p_event_id is not null and not exists (
    select 1 from public.events where id = p_event_id and team_id = p_team_id
  ) then
    raise exception 'Evento non valido per questo team';
  end if;

  v_badge_norm := public.attendance_normalize_badge(p_badge_code);
  v_pin_norm := public.attendance_normalize_pin(p_pin_code);

  if nullif(v_badge_norm, '') is null and nullif(v_pin_norm, '') is null then
    raise exception 'Inserisci badge o PIN rapido';
  end if;

  if nullif(v_badge_norm, '') is not null then
    v_badge_hash := public.attendance_hash_secret(v_badge_norm);
  end if;

  if nullif(v_pin_norm, '') is not null then
    v_pin_hash := public.attendance_hash_secret(v_pin_norm);
  end if;

  select * into v_staff
  from public.team_staff_members sm
  where sm.team_id = p_team_id
    and sm.is_active = true
    and (
      (v_badge_hash is not null and sm.badge_code_hash = v_badge_hash)
      or (v_pin_hash is not null and sm.pin_hash = v_pin_hash)
    )
  order by sm.updated_at desc
  limit 1;

  if not found then
    raise exception 'Badge o PIN non valido';
  end if;

  select id into v_open_record_id
  from public.attendance_records
  where team_id = p_team_id
    and staff_member_id = v_staff.id
    and check_out_at is null
  order by check_in_at desc
  limit 1;

  v_team_user_id := public.attendance_current_team_user_id(p_team_id);
  v_source := case when p_event_id is not null or p_location_label = 'pista' then 'qr_event' else 'kiosk' end;

  if v_mode = 'toggle' then
    v_mode := case when v_open_record_id is null then 'in' else 'out' end;
  end if;

  if v_mode = 'in' then
    if v_open_record_id is not null then
      raise exception 'Questo membro risulta già presente. Registra prima l''uscita.';
    end if;

    insert into public.attendance_records (
      team_id,
      staff_member_id,
      event_id,
      check_in_at,
      check_in_source,
      check_in_location_label,
      check_in_note,
      created_by_team_user_id,
      updated_by_team_user_id
    ) values (
      p_team_id,
      v_staff.id,
      p_event_id,
      now(),
      v_source,
      p_location_label,
      nullif(p_note, ''),
      v_team_user_id,
      v_team_user_id
    ) returning * into v_record;

    return v_record;
  end if;

  if v_mode = 'out' then
    if v_open_record_id is null then
      raise exception 'Nessuna timbratura aperta da chiudere per questo membro.';
    end if;

    update public.attendance_records
    set check_out_at = now(),
        check_out_source = v_source,
        check_out_location_label = p_location_label,
        check_out_note = nullif(p_note, ''),
        updated_by_team_user_id = v_team_user_id
    where id = v_open_record_id
    returning * into v_record;

    return v_record;
  end if;

  raise exception 'Modalità kiosk non gestita';
end;
$$;

grant execute on function public.attendance_generate_badge_credentials(uuid, uuid, boolean, boolean, text) to authenticated;
grant execute on function public.attendance_kiosk_clock(uuid, text, text, text, uuid, text, text) to authenticated;

insert into public.app_permissions (code, label, description)
values
  ('attendance.kiosk', 'Kiosk presenze', 'Uso della modalità tablet, badge, PIN e QR evento per le presenze')
on conflict (code) do update
set label = excluded.label,
    description = excluded.description;
