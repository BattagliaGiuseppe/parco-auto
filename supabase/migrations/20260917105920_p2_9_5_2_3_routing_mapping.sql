-- P2.9.5.2.3 - Atomic manual routing mapping
-- Does NOT perform Official Ingest.

begin;

create or replace function public.apply_connected_routing_mapping(
  p_team_id uuid,
  p_observation_id uuid,
  p_car_id uuid,
  p_device_id uuid default null,
  p_replace_conflicts boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.connected_routing_observations%rowtype;
  d public.connected_devices%rowtype;
  a public.connected_vehicle_aliases%rowtype;
  m public.connected_device_car_assignments%rowtype;
  v_device_id uuid;
  v_provider text;
  v_vehicle text;
  v_vehicle_norm text;
  v_serial text;
  v_external text;
  v_next timestamptz;
  v_old_end timestamptz;
  v_basis text[];
begin
  if not public.has_team_permission(p_team_id,'devices.edit') then raise exception 'Permesso devices.edit richiesto'; end if;
  select * into o from public.connected_routing_observations where id=p_observation_id and team_id=p_team_id for update;
  if not found then raise exception 'Osservazione routing non valida'; end if;
  if not exists(select 1 from public.cars where id=p_car_id and team_id=p_team_id) then raise exception 'Vettura non valida per il team'; end if;

  v_device_id := coalesce(p_device_id,o.resolved_device_id);
  if v_device_id is null then raise exception 'Seleziona il logger da associare prima di salvare il mapping'; end if;
  select * into d from public.connected_devices where id=v_device_id and team_id=p_team_id and status='active' for update;
  if not found then raise exception 'Logger non valido o non attivo'; end if;

  insert into public.connected_bridge_devices(team_id,bridge_id,device_id,enabled)
  values(p_team_id,o.bridge_id,d.id,true)
  on conflict (bridge_id,device_id) do update set enabled=true;

  v_provider := coalesce(public.normalize_connected_routing_text(o.provider),'aim_race_studio');
  v_vehicle := nullif(btrim(coalesce(o.identity->>'vehicle_profile',o.identity->>'vehicle','')),'');
  v_vehicle_norm := public.normalize_connected_routing_text(v_vehicle);
  v_serial := nullif(btrim(o.identity->>'serial_number'),'');
  v_external := nullif(btrim(o.identity->>'external_device_id'),'');

  -- Hardware identity -> selected logical logger.
  if v_serial is not null then
    if exists(select 1 from public.connected_devices x where x.team_id=p_team_id and x.id<>d.id and x.status='active' and public.normalize_connected_routing_text(x.serial_number)=public.normalize_connected_routing_text(v_serial)) then
      if not p_replace_conflicts then raise exception 'Questo seriale è già associato a un altro logger del team'; end if;
      update public.connected_devices set serial_number=null where team_id=p_team_id and id<>d.id and public.normalize_connected_routing_text(serial_number)=public.normalize_connected_routing_text(v_serial);
    end if;
    if d.serial_number is not null and public.normalize_connected_routing_text(d.serial_number) is distinct from public.normalize_connected_routing_text(v_serial) and not p_replace_conflicts then
      raise exception 'Il logger selezionato ha già un seriale differente';
    end if;
    update public.connected_devices set serial_number=v_serial where id=d.id;
  end if;

  if v_external is not null then
    if exists(select 1 from public.connected_devices x where x.team_id=p_team_id and x.id<>d.id and x.status='active' and public.normalize_connected_routing_text(x.external_device_id)=public.normalize_connected_routing_text(v_external)) then
      if not p_replace_conflicts then raise exception 'Questo external_device_id è già associato a un altro logger del team'; end if;
      update public.connected_devices set external_device_id=null where team_id=p_team_id and id<>d.id and public.normalize_connected_routing_text(external_device_id)=public.normalize_connected_routing_text(v_external);
    end if;
    if d.external_device_id is not null and public.normalize_connected_routing_text(d.external_device_id) is distinct from public.normalize_connected_routing_text(v_external) and not p_replace_conflicts then
      raise exception 'Il logger selezionato ha già un external_device_id differente';
    end if;
    update public.connected_devices set external_device_id=v_external where id=d.id;
  end if;

  -- Race Studio Vehicle -> car, date-aware.
  if v_vehicle_norm is not null then
    select * into a from public.connected_vehicle_aliases x
    where x.team_id=p_team_id and public.normalize_connected_routing_text(x.provider)=v_provider
      and x.alias_type='vehicle_profile' and x.alias_normalized=v_vehicle_norm
      and x.valid_from<=o.session_started_at and (x.valid_to is null or o.session_started_at<x.valid_to)
    order by x.valid_from desc limit 1 for update;

    if found and a.car_id is distinct from p_car_id then
      if not p_replace_conflicts then raise exception 'Il Vehicle % è già associato a un''altra vettura in questa data',v_vehicle; end if;
      v_old_end:=a.valid_to;
      if a.valid_from=o.session_started_at then
        update public.connected_vehicle_aliases set car_id=p_car_id,source='resolver',metadata=metadata||jsonb_build_object('manual_observation_id',o.id) where id=a.id;
      else
        update public.connected_vehicle_aliases set valid_to=o.session_started_at where id=a.id;
        insert into public.connected_vehicle_aliases(team_id,provider,alias_type,alias_value,alias_normalized,car_id,valid_from,valid_to,source,metadata)
        values(p_team_id,v_provider,'vehicle_profile',v_vehicle,v_vehicle_norm,p_car_id,o.session_started_at,v_old_end,'resolver',jsonb_build_object('manual_observation_id',o.id));
      end if;
    elsif not found then
      select min(x.valid_from) into v_next from public.connected_vehicle_aliases x
      where x.team_id=p_team_id and public.normalize_connected_routing_text(x.provider)=v_provider
        and x.alias_type='vehicle_profile' and x.alias_normalized=v_vehicle_norm and x.valid_from>o.session_started_at;
      insert into public.connected_vehicle_aliases(team_id,provider,alias_type,alias_value,alias_normalized,car_id,valid_from,valid_to,source,metadata)
      values(p_team_id,v_provider,'vehicle_profile',v_vehicle,v_vehicle_norm,p_car_id,o.session_started_at,v_next,'resolver',jsonb_build_object('manual_observation_id',o.id));
    end if;
  end if;

  -- Logger -> car. A move converts fixed routing into historical routing.
  if d.routing_mode='fixed_car' and d.car_id is distinct from p_car_id then
    if not p_replace_conflicts then raise exception 'Il logger è fissato a un''altra vettura. Conferma lo spostamento per attivare lo storico assegnazioni.'; end if;
    update public.connected_devices set routing_mode='assignment_history' where id=d.id;
    if d.created_at<o.session_started_at then
      insert into public.connected_device_car_assignments(team_id,device_id,car_id,valid_from,valid_to,source,metadata)
      values(p_team_id,d.id,d.car_id,d.created_at,o.session_started_at,'migration',jsonb_build_object('converted_from_fixed_car',true,'manual_observation_id',o.id));
    end if;
    insert into public.connected_device_car_assignments(team_id,device_id,car_id,valid_from,valid_to,source,metadata)
    values(p_team_id,d.id,p_car_id,o.session_started_at,null,'resolver',jsonb_build_object('manual_observation_id',o.id));
    update public.connected_devices set car_id=p_car_id where id=d.id;

  elsif d.routing_mode='assignment_history' then
    select * into m from public.connected_device_car_assignments x
    where x.team_id=p_team_id and x.device_id=d.id and x.valid_from<=o.session_started_at
      and (x.valid_to is null or o.session_started_at<x.valid_to)
    order by x.valid_from desc limit 1 for update;

    if found and m.car_id is distinct from p_car_id then
      if not p_replace_conflicts then raise exception 'Il logger risulta assegnato a un''altra vettura in questa data'; end if;
      v_old_end:=m.valid_to;
      if m.valid_from=o.session_started_at then
        update public.connected_device_car_assignments set car_id=p_car_id,source='resolver',metadata=metadata||jsonb_build_object('manual_observation_id',o.id) where id=m.id;
      else
        update public.connected_device_car_assignments set valid_to=o.session_started_at where id=m.id;
        insert into public.connected_device_car_assignments(team_id,device_id,car_id,valid_from,valid_to,source,metadata)
        values(p_team_id,d.id,p_car_id,o.session_started_at,v_old_end,'resolver',jsonb_build_object('manual_observation_id',o.id));
      end if;
    elsif not found then
      select min(x.valid_from) into v_next from public.connected_device_car_assignments x where x.team_id=p_team_id and x.device_id=d.id and x.valid_from>o.session_started_at;
      insert into public.connected_device_car_assignments(team_id,device_id,car_id,valid_from,valid_to,source,metadata)
      values(p_team_id,d.id,p_car_id,o.session_started_at,v_next,'resolver',jsonb_build_object('manual_observation_id',o.id));
    end if;
    if exists(select 1 from public.connected_device_car_assignments x where x.device_id=d.id and x.car_id=p_car_id and x.valid_from<=now() and (x.valid_to is null or now()<x.valid_to)) then
      update public.connected_devices set car_id=p_car_id where id=d.id;
    end if;
  end if;

  v_basis:=coalesce(o.resolution_basis,'{}'::text[]);
  if not ('manual_mapping'=any(v_basis)) then v_basis:=array_append(v_basis,'manual_mapping'); end if;
  update public.connected_routing_observations set
    status='needs_mapping',resolved_device_id=d.id,resolved_car_id=p_car_id,
    reason_code='mapping_configured_retry_required',
    message='Mapping salvato. In attesa della nuova verifica automatica del bridge.',
    resolution_basis=v_basis,resolved_at=null
  where id=o.id;

  return jsonb_build_object(
    'ok',true,'observation_id',o.id,'bridge_id',o.bridge_id,'device_id',d.id,'car_id',p_car_id,
    'vehicle_profile',v_vehicle,'status','mapping_configured_retry_required','safe_to_ingest',false,
    'message','Mapping configurato. Il bridge deve rieseguire il resolver prima dell''Official Ingest.'
  );
end;
$$;
revoke all on function public.apply_connected_routing_mapping(uuid,uuid,uuid,uuid,boolean) from public,anon;
grant execute on function public.apply_connected_routing_mapping(uuid,uuid,uuid,uuid,boolean) to authenticated,service_role;

commit;
