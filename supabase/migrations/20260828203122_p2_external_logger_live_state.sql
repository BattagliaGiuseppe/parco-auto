-- P2.7.5 External Logger Display Mode
-- Live state is intentionally separate from historical sessions/hour ledger.
create table if not exists public.connected_device_live_state (
  device_id uuid primary key references public.connected_devices(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  car_id uuid not null references public.cars(id) on delete cascade,
  circuit_id uuid null references public.circuits(id) on delete set null,
  activity_state text not null default 'idle' check (activity_state in ('idle','armed','track','pit','offline')),
  speed_kph numeric null,
  rpm numeric null,
  gear text null,
  lap_number integer null,
  current_lap_seconds numeric null,
  last_lap_seconds numeric null,
  best_lap_seconds numeric null,
  delta_seconds numeric null,
  gps_accuracy_m numeric null,
  source_timestamp timestamptz null,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create index if not exists idx_connected_device_live_state_team_updated on public.connected_device_live_state(team_id,updated_at desc);
alter table public.connected_device_live_state enable row level security;
revoke all on public.connected_device_live_state from anon, authenticated;
grant select, insert, update, delete on public.connected_device_live_state to service_role;

create or replace function public.publish_connected_live_state(p_device_key text, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare k public.connected_device_keys%rowtype; d public.connected_devices%rowtype; v_hash text; v_circuit uuid; v_state text; v_ts timestamptz;
begin
  if coalesce(char_length(p_device_key),0)<20 then raise exception 'Chiave dispositivo non valida'; end if;
  if p_payload is null or jsonb_typeof(p_payload)<>'object' then raise exception 'Payload live non valido'; end if;
  v_hash:=encode(digest(p_device_key,'sha256'),'hex');
  select * into k from public.connected_device_keys where key_hash=v_hash and revoked_at is null and(expires_at is null or expires_at>now()) order by created_at desc limit 1;
  if not found then raise exception 'Credenziale dispositivo non valida o revocata'; end if;
  select * into d from public.connected_devices where id=k.device_id and team_id=k.team_id and status='active';
  if not found then raise exception 'Dispositivo non attivo'; end if;
  if d.acquisition_mode not in ('external_logger','hybrid') then raise exception 'Stato live esterno consentito solo in modalità logger esterno o ibrida'; end if;
  v_state:=coalesce(nullif(p_payload->>'activity_state',''),'idle');
  if v_state not in ('idle','armed','track','pit','offline') then raise exception 'activity_state non valido'; end if;
  v_ts:=coalesce(nullif(p_payload->>'source_timestamp','')::timestamptz,now());
  if v_ts>now()+interval '5 minutes' or v_ts<now()-interval '24 hours' then raise exception 'source_timestamp non valido'; end if;
  if nullif(p_payload->>'circuit_id','') is not null then v_circuit:=(p_payload->>'circuit_id')::uuid; if not exists(select 1 from public.circuits c where c.id=v_circuit and c.team_id=d.team_id) then raise exception 'Circuito non valido per il team'; end if; end if;
  insert into public.connected_device_live_state(device_id,team_id,car_id,circuit_id,activity_state,speed_kph,rpm,gear,lap_number,current_lap_seconds,last_lap_seconds,best_lap_seconds,delta_seconds,gps_accuracy_m,source_timestamp,metadata,updated_at)
  values(d.id,d.team_id,d.car_id,v_circuit,v_state,nullif(p_payload->>'speed_kph','')::numeric,nullif(p_payload->>'rpm','')::numeric,nullif(p_payload->>'gear',''),nullif(p_payload->>'lap_number','')::integer,nullif(p_payload->>'current_lap_seconds','')::numeric,nullif(p_payload->>'last_lap_seconds','')::numeric,nullif(p_payload->>'best_lap_seconds','')::numeric,nullif(p_payload->>'delta_seconds','')::numeric,nullif(p_payload->>'gps_accuracy_m','')::numeric,v_ts,coalesce(p_payload->'metadata','{}'::jsonb),now())
  on conflict(device_id) do update set team_id=excluded.team_id,car_id=excluded.car_id,circuit_id=excluded.circuit_id,activity_state=excluded.activity_state,speed_kph=excluded.speed_kph,rpm=excluded.rpm,gear=excluded.gear,lap_number=excluded.lap_number,current_lap_seconds=excluded.current_lap_seconds,last_lap_seconds=excluded.last_lap_seconds,best_lap_seconds=excluded.best_lap_seconds,delta_seconds=excluded.delta_seconds,gps_accuracy_m=excluded.gps_accuracy_m,source_timestamp=excluded.source_timestamp,metadata=excluded.metadata,updated_at=now();
  update public.connected_device_keys set last_used_at=now() where id=k.id; update public.connected_devices set last_seen_at=now() where id=d.id;
  return jsonb_build_object('ok',true,'device_id',d.id,'updated_at',now());
end$$;

create or replace function public.get_connected_live_state(p_device_key text)
returns jsonb language plpgsql stable security definer set search_path=public,extensions as $$
declare k public.connected_device_keys%rowtype; d public.connected_devices%rowtype; s public.connected_device_live_state%rowtype; v_hash text; v_circuit_name text; v_fresh boolean;
begin
  if coalesce(char_length(p_device_key),0)<20 then raise exception 'Chiave dispositivo non valida'; end if;
  v_hash:=encode(digest(p_device_key,'sha256'),'hex');
  select * into k from public.connected_device_keys where key_hash=v_hash and revoked_at is null and(expires_at is null or expires_at>now()) order by created_at desc limit 1;
  if not found then raise exception 'Credenziale dispositivo non valida o revocata'; end if;
  select * into d from public.connected_devices where id=k.device_id and team_id=k.team_id and status='active'; if not found then raise exception 'Dispositivo non attivo'; end if;
  select * into s from public.connected_device_live_state where device_id=d.id;
  if not found then return jsonb_build_object('found',false,'device_id',d.id,'acquisition_mode',d.acquisition_mode,'last_seen_at',d.last_seen_at); end if;
  if s.circuit_id is not null then select name into v_circuit_name from public.circuits where id=s.circuit_id and team_id=d.team_id; end if;
  v_fresh:=s.updated_at>=now()-interval '10 seconds';
  return jsonb_build_object('found',true,'fresh',v_fresh,'device_id',d.id,'car_id',d.car_id,'acquisition_mode',d.acquisition_mode,'activity_state',case when v_fresh then s.activity_state else 'offline' end,'circuit_id',s.circuit_id,'circuit_name',v_circuit_name,'speed_kph',s.speed_kph,'rpm',s.rpm,'gear',s.gear,'lap_number',s.lap_number,'current_lap_seconds',s.current_lap_seconds,'last_lap_seconds',s.last_lap_seconds,'best_lap_seconds',s.best_lap_seconds,'delta_seconds',s.delta_seconds,'gps_accuracy_m',s.gps_accuracy_m,'source_timestamp',s.source_timestamp,'updated_at',s.updated_at,'age_ms',greatest(0,extract(epoch from(now()-s.updated_at))*1000)::bigint);
end$$;
revoke all on function public.publish_connected_live_state(text,jsonb) from public;
revoke all on function public.get_connected_live_state(text) from public;
grant execute on function public.publish_connected_live_state(text,jsonb) to anon,authenticated,service_role;
grant execute on function public.get_connected_live_state(text) to anon,authenticated,service_role;
