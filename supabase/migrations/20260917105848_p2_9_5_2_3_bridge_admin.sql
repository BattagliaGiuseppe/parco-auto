-- P2.9.5.2.3 - Multi-Car Mapping UI backend
-- Bridge Key lifecycle + allow-list + atomic manual routing mapping.
-- Does NOT perform Official Ingest.

begin;

create or replace function public.create_connected_bridge(
  p_team_id uuid,
  p_name text,
  p_machine_name text default null,
  p_device_ids uuid[] default '{}'::uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_bridge public.connected_bridges%rowtype;
  v_secret text;
  v_prefix text;
  v_device_id uuid;
begin
  if not public.has_team_permission(p_team_id,'devices.edit') then raise exception 'Permesso devices.edit richiesto'; end if;
  if coalesce(btrim(p_name),'')='' then raise exception 'Nome bridge obbligatorio'; end if;
  if exists (
    select 1 from unnest(coalesce(p_device_ids,'{}'::uuid[])) x(id)
    where not exists (select 1 from public.connected_devices d where d.id=x.id and d.team_id=p_team_id and d.status='active')
  ) then raise exception 'Uno o più logger selezionati non appartengono al team o non sono attivi'; end if;

  insert into public.connected_bridges(team_id,name,provider,machine_name,status)
  values(p_team_id,btrim(p_name),'aim_race_studio',nullif(btrim(p_machine_name),''),'active')
  returning * into v_bridge;

  for v_device_id in select distinct unnest(coalesce(p_device_ids,'{}'::uuid[])) loop
    insert into public.connected_bridge_devices(team_id,bridge_id,device_id,enabled)
    values(p_team_id,v_bridge.id,v_device_id,true)
    on conflict (bridge_id,device_id) do update set enabled=true;
  end loop;

  v_secret := 'mmb_'||replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
  v_prefix := left(v_secret,12);
  insert into public.connected_bridge_keys(team_id,bridge_id,key_prefix,key_hash)
  values(p_team_id,v_bridge.id,v_prefix,encode(extensions.digest(v_secret,'sha256'),'hex'));
  update public.connected_bridges set metadata=metadata||jsonb_build_object('active_key_prefix',v_prefix) where id=v_bridge.id;

  return jsonb_build_object('bridge',to_jsonb(v_bridge),'bridge_key',v_secret,'key_prefix',v_prefix);
end;
$$;
revoke all on function public.create_connected_bridge(uuid,text,text,uuid[]) from public,anon;
grant execute on function public.create_connected_bridge(uuid,text,text,uuid[]) to authenticated,service_role;

create or replace function public.rotate_connected_bridge_key(p_team_id uuid,p_bridge_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_secret text; v_prefix text;
begin
  if not public.has_team_permission(p_team_id,'devices.edit') then raise exception 'Permesso devices.edit richiesto'; end if;
  if not exists(select 1 from public.connected_bridges where id=p_bridge_id and team_id=p_team_id) then raise exception 'Bridge non valido'; end if;
  update public.connected_bridge_keys set revoked_at=coalesce(revoked_at,now()) where team_id=p_team_id and bridge_id=p_bridge_id and revoked_at is null;
  v_secret := 'mmb_'||replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
  v_prefix := left(v_secret,12);
  insert into public.connected_bridge_keys(team_id,bridge_id,key_prefix,key_hash)
  values(p_team_id,p_bridge_id,v_prefix,encode(extensions.digest(v_secret,'sha256'),'hex'));
  update public.connected_bridges set metadata=metadata||jsonb_build_object('active_key_prefix',v_prefix) where id=p_bridge_id;
  return jsonb_build_object('bridge_key',v_secret,'key_prefix',v_prefix);
end;
$$;
revoke all on function public.rotate_connected_bridge_key(uuid,uuid) from public,anon;
grant execute on function public.rotate_connected_bridge_key(uuid,uuid) to authenticated,service_role;

create or replace function public.set_connected_bridge_devices(p_team_id uuid,p_bridge_id uuid,p_device_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_device_id uuid;
begin
  if not public.has_team_permission(p_team_id,'devices.edit') then raise exception 'Permesso devices.edit richiesto'; end if;
  if not exists(select 1 from public.connected_bridges where id=p_bridge_id and team_id=p_team_id) then raise exception 'Bridge non valido'; end if;
  if exists (
    select 1 from unnest(coalesce(p_device_ids,'{}'::uuid[])) x(id)
    where not exists (select 1 from public.connected_devices d where d.id=x.id and d.team_id=p_team_id and d.status='active')
  ) then raise exception 'Uno o più logger selezionati non appartengono al team o non sono attivi'; end if;

  update public.connected_bridge_devices set enabled=false where team_id=p_team_id and bridge_id=p_bridge_id;
  for v_device_id in select distinct unnest(coalesce(p_device_ids,'{}'::uuid[])) loop
    insert into public.connected_bridge_devices(team_id,bridge_id,device_id,enabled)
    values(p_team_id,p_bridge_id,v_device_id,true)
    on conflict (bridge_id,device_id) do update set enabled=true;
  end loop;
end;
$$;
revoke all on function public.set_connected_bridge_devices(uuid,uuid,uuid[]) from public,anon;
grant execute on function public.set_connected_bridge_devices(uuid,uuid,uuid[]) to authenticated,service_role;

commit;
