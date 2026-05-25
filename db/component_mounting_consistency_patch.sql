-- Patch: montaggi componenti coerenti e centralizzati
-- Applicare in Supabase SQL Editor prima di usare la nuova UI.

create or replace function public.mount_component_on_car(
  p_team_id uuid,
  p_car_id uuid,
  p_component_id uuid,
  p_mounted_at date default current_date,
  p_mounted_by_team_user_id uuid default null::uuid,
  p_reason text default null::text,
  p_replace_same_type boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_car_team_id uuid;
  v_component_team_id uuid;
  v_component_type text;
  v_mount_time timestamptz := coalesce(p_mounted_at, current_date)::timestamptz;
  v_existing_active_mount_id uuid;
  v_new_mount_id uuid;
  v_closed_previous_component_mounts integer := 0;
  v_closed_same_type_mounts integer := 0;
  v_direct_same_type_detached integer := 0;
begin
  if p_team_id is null then
    raise exception 'team_id obbligatorio';
  end if;

  if not public.is_team_member(p_team_id) then
    raise exception 'Utente non autorizzato per questo team';
  end if;

  if p_car_id is null then
    raise exception 'car_id obbligatorio';
  end if;

  if p_component_id is null then
    raise exception 'component_id obbligatorio';
  end if;

  select c.team_id
    into v_car_team_id
  from public.cars c
  where c.id = p_car_id;

  if v_car_team_id is null then
    raise exception 'Auto non trovata';
  end if;

  if v_car_team_id <> p_team_id then
    raise exception 'Auto non appartenente al team indicato';
  end if;

  select c.team_id, c.type
    into v_component_team_id, v_component_type
  from public.components c
  where c.id = p_component_id
  for update;

  if v_component_team_id is null then
    raise exception 'Componente non trovato';
  end if;

  if v_component_team_id <> p_team_id then
    raise exception 'Componente non appartenente al team indicato';
  end if;

  select cc.id
    into v_existing_active_mount_id
  from public.car_components cc
  where cc.team_id = p_team_id
    and cc.component_id = p_component_id
    and cc.car_id = p_car_id
    and cc.removed_at is null
  order by coalesce(cc.mounted_at, cc.installed_at, cc.created_at) desc
  limit 1
  for update;

  if p_replace_same_type then
    with closed_same_type as (
      update public.car_components cc
      set
        removed_at = coalesce(cc.removed_at, v_mount_time),
        removed_by_team_user_id = coalesce(cc.removed_by_team_user_id, p_mounted_by_team_user_id),
        status = 'unmounted'
      from public.components old_component
      where cc.component_id = old_component.id
        and cc.team_id = p_team_id
        and cc.car_id = p_car_id
        and cc.component_id <> p_component_id
        and cc.removed_at is null
        and old_component.team_id = p_team_id
        and old_component.type = v_component_type
      returning cc.component_id
    ), detached_same_type as (
      update public.components c
      set car_id = null
      where c.team_id = p_team_id
        and c.id in (select component_id from closed_same_type)
      returning c.id
    )
    select
      (select count(*) from closed_same_type),
      (select count(*) from detached_same_type)
      into v_closed_same_type_mounts, v_direct_same_type_detached;

    update public.components c
    set car_id = null
    where c.team_id = p_team_id
      and c.car_id = p_car_id
      and c.id <> p_component_id
      and c.type = v_component_type;

    get diagnostics v_direct_same_type_detached = row_count;
  end if;

  with closed_previous as (
    update public.car_components cc
    set
      removed_at = coalesce(cc.removed_at, v_mount_time),
      removed_by_team_user_id = coalesce(cc.removed_by_team_user_id, p_mounted_by_team_user_id),
      status = 'unmounted'
    where cc.team_id = p_team_id
      and cc.component_id = p_component_id
      and cc.removed_at is null
      and cc.car_id <> p_car_id
    returning cc.id
  )
  select count(*)
    into v_closed_previous_component_mounts
  from closed_previous;

  if v_existing_active_mount_id is not null then
    update public.components c
    set car_id = p_car_id
    where c.team_id = p_team_id
      and c.id = p_component_id;

    return jsonb_build_object(
      'ok', true,
      'action', 'already_mounted',
      'mount_id', v_existing_active_mount_id,
      'component_id', p_component_id,
      'car_id', p_car_id,
      'closed_previous_component_mounts', v_closed_previous_component_mounts,
      'closed_same_type_mounts', v_closed_same_type_mounts,
      'detached_same_type_components', v_direct_same_type_detached
    );
  end if;

  insert into public.car_components (
    team_id,
    car_id,
    component_id,
    mounted_at,
    installed_at,
    status,
    mounted_by_team_user_id,
    reason
  )
  values (
    p_team_id,
    p_car_id,
    p_component_id,
    v_mount_time,
    v_mount_time,
    'mounted',
    p_mounted_by_team_user_id,
    nullif(trim(coalesce(p_reason, '')), '')
  )
  returning id into v_new_mount_id;

  update public.components c
  set car_id = p_car_id
  where c.team_id = p_team_id
    and c.id = p_component_id;

  return jsonb_build_object(
    'ok', true,
    'action', 'mounted',
    'mount_id', v_new_mount_id,
    'component_id', p_component_id,
    'car_id', p_car_id,
    'closed_previous_component_mounts', v_closed_previous_component_mounts,
    'closed_same_type_mounts', v_closed_same_type_mounts,
    'detached_same_type_components', v_direct_same_type_detached
  );
end;
$function$;

create or replace function public.unmount_component_from_car(
  p_team_id uuid,
  p_component_id uuid default null::uuid,
  p_mount_id uuid default null::uuid,
  p_removed_at date default current_date,
  p_removed_by_team_user_id uuid default null::uuid,
  p_reason text default null::text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_mount record;
  v_component_team_id uuid;
  v_component_car_id uuid;
  v_removed_time timestamptz := coalesce(p_removed_at, current_date)::timestamptz;
begin
  if p_team_id is null then
    raise exception 'team_id obbligatorio';
  end if;

  if not public.is_team_member(p_team_id) then
    raise exception 'Utente non autorizzato per questo team';
  end if;

  if p_component_id is null and p_mount_id is null then
    raise exception 'component_id o mount_id obbligatorio';
  end if;

  select cc.id, cc.component_id, cc.car_id
    into v_mount
  from public.car_components cc
  where cc.team_id = p_team_id
    and cc.removed_at is null
    and (
      (p_mount_id is not null and cc.id = p_mount_id)
      or (p_mount_id is null and p_component_id is not null and cc.component_id = p_component_id)
    )
  order by coalesce(cc.mounted_at, cc.installed_at, cc.created_at) desc
  limit 1
  for update;

  if found then
    select c.team_id, c.car_id
      into v_component_team_id, v_component_car_id
    from public.components c
    where c.id = v_mount.component_id
    for update;

    if v_component_team_id <> p_team_id then
      raise exception 'Componente non appartenente al team indicato';
    end if;

    update public.car_components cc
    set
      removed_at = v_removed_time,
      removed_by_team_user_id = coalesce(p_removed_by_team_user_id, cc.removed_by_team_user_id),
      status = 'unmounted',
      notes = case
        when nullif(trim(coalesce(p_reason, '')), '') is null then cc.notes
        when cc.notes is null or trim(cc.notes) = '' then concat('Smontaggio: ', trim(p_reason))
        else concat(cc.notes, E'\nSmontaggio: ', trim(p_reason))
      end
    where cc.id = v_mount.id
      and cc.team_id = p_team_id;

    update public.components c
    set car_id = null
    where c.id = v_mount.component_id
      and c.team_id = p_team_id
      and (c.car_id is null or c.car_id = v_mount.car_id);

    return jsonb_build_object(
      'ok', true,
      'action', 'unmounted',
      'mount_id', v_mount.id,
      'component_id', v_mount.component_id,
      'car_id', v_mount.car_id
    );
  end if;

  if p_component_id is not null then
    select c.team_id, c.car_id
      into v_component_team_id, v_component_car_id
    from public.components c
    where c.id = p_component_id
    for update;

    if v_component_team_id is null then
      raise exception 'Componente non trovato';
    end if;

    if v_component_team_id <> p_team_id then
      raise exception 'Componente non appartenente al team indicato';
    end if;

    if v_component_car_id is not null then
      update public.components c
      set car_id = null
      where c.id = p_component_id
        and c.team_id = p_team_id;

      return jsonb_build_object(
        'ok', true,
        'action', 'direct_detached',
        'component_id', p_component_id,
        'car_id', v_component_car_id
      );
    end if;
  end if;

  return jsonb_build_object(
    'ok', true,
    'action', 'already_unmounted',
    'component_id', p_component_id,
    'mount_id', p_mount_id
  );
end;
$function$;
