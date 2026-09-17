-- P2.9.5.2.2 - Multi-Car Server Resolver
-- Safe routing only: this migration does NOT perform Official Ingest.

begin;

create table if not exists public.connected_routing_observations (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  bridge_id uuid not null references public.connected_bridges(id) on delete cascade,
  provider text not null default 'aim_race_studio',
  file_sha256 text not null,
  session_started_at timestamptz not null,
  identity jsonb not null default '{}'::jsonb,
  status text not null,
  resolved_device_id uuid references public.connected_devices(id) on delete set null,
  resolved_car_id uuid references public.cars(id) on delete set null,
  reason_code text not null,
  message text,
  resolution_basis text[] not null default '{}'::text[],
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  occurrences integer not null default 1,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint connected_routing_observations_status_check
    check (status in ('resolved','needs_mapping','conflict','blocked')),
  constraint connected_routing_observations_sha256_check
    check (file_sha256 ~ '^[0-9a-f]{64}$'),
  constraint connected_routing_observations_occurrences_check
    check (occurrences >= 1),
  constraint connected_routing_observations_bridge_file_unique
    unique (bridge_id, file_sha256)
);

create index if not exists connected_routing_observations_queue_idx
  on public.connected_routing_observations(team_id, status, last_seen_at desc);
create index if not exists connected_routing_observations_device_idx
  on public.connected_routing_observations(resolved_device_id, last_seen_at desc)
  where resolved_device_id is not null;
create index if not exists connected_routing_observations_car_idx
  on public.connected_routing_observations(resolved_car_id, last_seen_at desc)
  where resolved_car_id is not null;

alter table public.connected_routing_observations enable row level security;

-- Read-only from the authenticated web app. Writes are performed only by the
-- SECURITY DEFINER resolver after Bridge Key authentication.
create policy connected_routing_observations_select_permission
on public.connected_routing_observations for select
using (public.has_team_permission(team_id,'devices.view'));

create policy connected_routing_observations_delete_permission
on public.connected_routing_observations for delete
using (public.has_team_permission(team_id,'devices.edit'));

create or replace function public.trg_connected_routing_observation_validate()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_team uuid;
begin
  select team_id into v_team from public.connected_bridges where id=new.bridge_id;
  if v_team is distinct from new.team_id then
    raise exception 'Bridge non appartenente al team';
  end if;

  if new.resolved_device_id is not null then
    select team_id into v_team from public.connected_devices where id=new.resolved_device_id;
    if v_team is distinct from new.team_id then
      raise exception 'Device risolto non appartenente al team';
    end if;
  end if;

  if new.resolved_car_id is not null then
    select team_id into v_team from public.cars where id=new.resolved_car_id;
    if v_team is distinct from new.team_id then
      raise exception 'Vettura risolta non appartenente al team';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_connected_routing_observations_updated_at on public.connected_routing_observations;
create trigger trg_connected_routing_observations_updated_at
before update on public.connected_routing_observations
for each row execute function public.set_connected_updated_at();

drop trigger if exists trg_connected_routing_observations_team_refs on public.connected_routing_observations;
create trigger trg_connected_routing_observations_team_refs
before insert or update on public.connected_routing_observations
for each row execute function public.trg_connected_routing_observation_validate();

-- Central fail-closed resolver used by the Windows bridge.
-- It authenticates the Bridge Key, checks the bridge allow-list, resolves
-- hardware identity + historical logger assignment + Race Studio Vehicle alias,
-- persists the routing result, and returns a routing decision only.
create or replace function public.resolve_connected_bridge_route(
  p_bridge_key text,
  p_identity jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
  v_key public.connected_bridge_keys%rowtype;
  v_bridge public.connected_bridges%rowtype;

  v_provider text;
  v_file_sha256 text;
  v_started_at timestamptz;
  v_serial text;
  v_external text;
  v_vehicle text;

  v_enabled_count integer := 0;

  v_serial_count integer := 0;
  v_serial_device uuid;
  v_external_count integer := 0;
  v_external_device uuid;
  v_device_id uuid;
  v_device public.connected_devices%rowtype;
  v_device_car uuid;

  v_alias_count integer := 0;
  v_alias_car uuid;

  v_car_candidate_device_count integer := 0;
  v_car_candidate_device uuid;

  v_status text;
  v_reason text;
  v_message text;
  v_basis text[] := '{}'::text[];
  v_resolved_device uuid;
  v_resolved_car uuid;
  v_observation_id uuid;
  v_device_name text;
  v_car_name text;
begin
  if coalesce(char_length(p_bridge_key),0) < 20 then
    raise exception 'Bridge Key non valida';
  end if;
  if p_identity is null or jsonb_typeof(p_identity) <> 'object' then
    raise exception 'Identità routing non valida';
  end if;

  v_hash := encode(extensions.digest(p_bridge_key,'sha256'),'hex');
  select * into v_key
    from public.connected_bridge_keys
   where key_hash=v_hash
     and revoked_at is null
     and (expires_at is null or expires_at>now())
   order by created_at desc
   limit 1;
  if not found then
    raise exception 'Credenziale bridge non valida o revocata';
  end if;

  select * into v_bridge
    from public.connected_bridges
   where id=v_key.bridge_id and team_id=v_key.team_id;
  if not found then
    raise exception 'Bridge non trovato';
  end if;

  v_provider := coalesce(
    public.normalize_connected_routing_text(p_identity->>'provider'),
    public.normalize_connected_routing_text(v_bridge.provider),
    'aim_race_studio'
  );
  v_file_sha256 := lower(btrim(coalesce(p_identity->>'file_sha256','')));
  if v_file_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'file_sha256 non valido';
  end if;

  begin
    v_started_at := (p_identity->>'session_started_at')::timestamptz;
  exception when others then
    raise exception 'session_started_at non valido o senza timezone';
  end;
  if v_started_at is null then
    raise exception 'session_started_at obbligatorio';
  end if;

  v_serial := public.normalize_connected_routing_text(p_identity->>'serial_number');
  v_external := public.normalize_connected_routing_text(p_identity->>'external_device_id');
  v_vehicle := public.normalize_connected_routing_text(
    coalesce(p_identity->>'vehicle_profile',p_identity->>'vehicle')
  );

  update public.connected_bridge_keys set last_used_at=now() where id=v_key.id;
  update public.connected_bridges
     set last_seen_at=now(),
         machine_name=coalesce(nullif(btrim(p_identity->>'machine_name'),''),machine_name)
   where id=v_bridge.id;

  if v_bridge.status <> 'active' then
    v_status := 'blocked';
    v_reason := 'bridge_not_active';
    v_message := 'Bridge disabilitato o revocato.';
  end if;

  if v_status is null then
    select count(*) into v_enabled_count
      from public.connected_bridge_devices bd
      join public.connected_devices d on d.id=bd.device_id and d.team_id=bd.team_id
     where bd.team_id=v_bridge.team_id
       and bd.bridge_id=v_bridge.id
       and bd.enabled=true
       and d.status='active';
    if v_enabled_count=0 then
      v_status := 'blocked';
      v_reason := 'bridge_has_no_enabled_devices';
      v_message := 'Nessun logger attivo è autorizzato su questo bridge.';
    end if;
  end if;

  -- Strong hardware identity: serial number and external device id.
  if v_status is null and v_serial is not null then
    select count(*), (array_agg(d.id order by d.id))[1]
      into v_serial_count, v_serial_device
      from public.connected_bridge_devices bd
      join public.connected_devices d on d.id=bd.device_id and d.team_id=bd.team_id
     where bd.team_id=v_bridge.team_id
       and bd.bridge_id=v_bridge.id
       and bd.enabled=true
       and d.status='active'
       and public.normalize_connected_routing_text(d.serial_number)=v_serial;
    if v_serial_count > 1 then
      v_status := 'conflict';
      v_reason := 'duplicate_serial_mapping';
      v_message := 'Il seriale logger corrisponde a più device autorizzati.';
    end if;
  end if;

  if v_status is null and v_external is not null then
    select count(*), (array_agg(d.id order by d.id))[1]
      into v_external_count, v_external_device
      from public.connected_bridge_devices bd
      join public.connected_devices d on d.id=bd.device_id and d.team_id=bd.team_id
     where bd.team_id=v_bridge.team_id
       and bd.bridge_id=v_bridge.id
       and bd.enabled=true
       and d.status='active'
       and public.normalize_connected_routing_text(d.external_device_id)=v_external;
    if v_external_count > 1 then
      v_status := 'conflict';
      v_reason := 'duplicate_external_device_mapping';
      v_message := 'L''identificativo esterno corrisponde a più device autorizzati.';
    end if;
  end if;

  if v_status is null and v_serial_count=1 and v_external_count=1 and v_serial_device<>v_external_device then
    v_status := 'conflict';
    v_reason := 'hardware_identity_conflict';
    v_message := 'Seriale logger ed external_device_id identificano device differenti.';
  end if;

  if v_status is null then
    if v_serial_count=1 then
      v_device_id := v_serial_device;
      v_basis := array_append(v_basis,'serial_number');
    elsif v_external_count=1 then
      v_device_id := v_external_device;
      v_basis := array_append(v_basis,'external_device_id');
    end if;
  end if;

  -- Resolve Race Studio Vehicle alias at the exact session timestamp.
  if v_status is null and v_vehicle is not null then
    select count(distinct a.car_id), (array_agg(distinct a.car_id order by a.car_id))[1]
      into v_alias_count, v_alias_car
      from public.connected_vehicle_aliases a
     where a.team_id=v_bridge.team_id
       and public.normalize_connected_routing_text(a.provider)=v_provider
       and a.alias_normalized=v_vehicle
       and a.valid_from<=v_started_at
       and (a.valid_to is null or v_started_at<a.valid_to);

    if v_alias_count>1 then
      v_status := 'conflict';
      v_reason := 'vehicle_alias_conflict';
      v_message := 'Il profilo Vehicle è associato a più vetture nello stesso momento.';
    elsif v_alias_count=1 then
      v_basis := array_append(v_basis,'vehicle_alias');
    end if;
  end if;

  -- If hardware is known, resolve the car using routing_mode.
  if v_status is null and v_device_id is not null then
    select * into v_device
      from public.connected_devices
     where id=v_device_id and team_id=v_bridge.team_id and status='active';

    if not found then
      v_status := 'blocked';
      v_reason := 'resolved_device_not_active';
      v_message := 'Il logger risolto non è attivo.';
    elsif v_device.routing_mode='fixed_car' then
      v_device_car := v_device.car_id;
      v_basis := array_append(v_basis,'fixed_car');
    else
      select a.car_id into v_device_car
        from public.connected_device_car_assignments a
       where a.team_id=v_bridge.team_id
         and a.device_id=v_device.id
         and a.valid_from<=v_started_at
         and (a.valid_to is null or v_started_at<a.valid_to)
       order by a.valid_from desc
       limit 1;
      if v_device_car is not null then
        v_basis := array_append(v_basis,'assignment_history');
      end if;
    end if;
  end if;

  if v_status is null and v_device_id is not null and v_device_car is null then
    v_status := 'needs_mapping';
    v_reason := 'device_car_assignment_missing';
    v_message := 'Logger riconosciuto, ma non esiste un''assegnazione vettura valida per la data della sessione.';
    v_resolved_device := v_device_id;
  end if;

  -- A declared Vehicle must be confirmed once. Do not silently trust hardware-only
  -- routing while the Vehicle profile is still unknown.
  if v_status is null and v_vehicle is not null and v_alias_count=0 then
    v_status := 'needs_mapping';
    v_reason := 'vehicle_alias_unmapped';
    v_message := 'Profilo Vehicle non ancora associato a una vettura.';
    v_resolved_device := v_device_id;
    v_resolved_car := v_device_car;
  end if;

  -- Hardware and Vehicle must agree on the same car.
  if v_status is null and v_device_id is not null and v_alias_count=1 and v_device_car<>v_alias_car then
    v_status := 'conflict';
    v_reason := 'hardware_vehicle_conflict';
    v_message := 'Il logger e il profilo Vehicle indicano vetture differenti.';
    v_resolved_device := v_device_id;
    v_resolved_car := v_device_car;
  end if;

  if v_status is null and v_device_id is not null then
    v_status := 'resolved';
    v_reason := case when v_alias_count=1 then 'hardware_and_vehicle_agree' else 'hardware_identity_resolved' end;
    v_message := 'Routing risolto con identità logger autorizzata.';
    v_resolved_device := v_device_id;
    v_resolved_car := v_device_car;
  end if;

  -- If no hardware identity matched, Vehicle may resolve only when exactly one
  -- enabled logger routes to that car at the session timestamp.
  if v_status is null and v_device_id is null and v_alias_count=1 then
    select count(*), (array_agg(q.device_id order by q.device_id))[1]
      into v_car_candidate_device_count, v_car_candidate_device
      from (
        select d.id as device_id
          from public.connected_bridge_devices bd
          join public.connected_devices d on d.id=bd.device_id and d.team_id=bd.team_id
         where bd.team_id=v_bridge.team_id
           and bd.bridge_id=v_bridge.id
           and bd.enabled=true
           and d.status='active'
           and (
             (d.routing_mode='fixed_car' and d.car_id=v_alias_car)
             or
             (d.routing_mode='assignment_history' and exists (
               select 1
                 from public.connected_device_car_assignments a
                where a.team_id=v_bridge.team_id
                  and a.device_id=d.id
                  and a.car_id=v_alias_car
                  and a.valid_from<=v_started_at
                  and (a.valid_to is null or v_started_at<a.valid_to)
             ))
           )
      ) q;

    if v_car_candidate_device_count=1 then
      v_status := 'resolved';
      v_reason := 'vehicle_alias_unique_logger';
      v_message := 'Routing risolto dal Vehicle: una sola identità logger autorizzata è compatibile con la vettura.';
      v_resolved_device := v_car_candidate_device;
      v_resolved_car := v_alias_car;
      v_basis := array_append(v_basis,'unique_device_for_car');
    elsif v_car_candidate_device_count=0 then
      v_status := 'needs_mapping';
      v_reason := 'vehicle_car_has_no_logger_mapping';
      v_message := 'Vehicle riconosciuto, ma nessun logger autorizzato è assegnato a quella vettura per la data della sessione.';
      v_resolved_car := v_alias_car;
    else
      v_status := 'needs_mapping';
      v_reason := 'vehicle_car_has_multiple_loggers';
      v_message := 'Vehicle riconosciuto, ma più logger autorizzati sono compatibili con la vettura.';
      v_resolved_car := v_alias_car;
    end if;
  end if;

  if v_status is null then
    v_status := 'needs_mapping';
    v_reason := 'insufficient_identity';
    v_message := 'Impossibile identificare con certezza logger e vettura.';
  end if;

  insert into public.connected_routing_observations(
    team_id,bridge_id,provider,file_sha256,session_started_at,identity,
    status,resolved_device_id,resolved_car_id,reason_code,message,resolution_basis,
    first_seen_at,last_seen_at,occurrences,resolved_at
  ) values (
    v_bridge.team_id,v_bridge.id,v_provider,v_file_sha256,v_started_at,p_identity,
    v_status,v_resolved_device,v_resolved_car,v_reason,v_message,v_basis,
    now(),now(),1,case when v_status='resolved' then now() else null end
  )
  on conflict (bridge_id,file_sha256) do update set
    provider=excluded.provider,
    session_started_at=excluded.session_started_at,
    identity=excluded.identity,
    status=excluded.status,
    resolved_device_id=excluded.resolved_device_id,
    resolved_car_id=excluded.resolved_car_id,
    reason_code=excluded.reason_code,
    message=excluded.message,
    resolution_basis=excluded.resolution_basis,
    last_seen_at=now(),
    occurrences=public.connected_routing_observations.occurrences+1,
    resolved_at=case when excluded.status='resolved' then now() else null end
  returning id into v_observation_id;

  if v_resolved_device is not null then
    select name into v_device_name from public.connected_devices where id=v_resolved_device;
  end if;
  if v_resolved_car is not null then
    select name into v_car_name from public.cars where id=v_resolved_car;
  end if;

  return jsonb_build_object(
    'contract','connected_bridge_route_resolver',
    'version','p2.9.5.2.2',
    'status',v_status,
    'reason_code',v_reason,
    'message',v_message,
    'observation_id',v_observation_id,
    'bridge_id',v_bridge.id,
    'team_id',v_bridge.team_id,
    'provider',v_provider,
    'session_started_at',v_started_at,
    'file_sha256',v_file_sha256,
    'resolved_device_id',v_resolved_device,
    'resolved_device_name',v_device_name,
    'resolved_car_id',v_resolved_car,
    'resolved_car_name',v_car_name,
    'resolution_basis',to_jsonb(v_basis),
    'safe_to_ingest',(v_status='resolved')
  );
end;
$$;

revoke all on function public.resolve_connected_bridge_route(text,jsonb) from public;
grant execute on function public.resolve_connected_bridge_route(text,jsonb) to anon, authenticated, service_role;

commit;
