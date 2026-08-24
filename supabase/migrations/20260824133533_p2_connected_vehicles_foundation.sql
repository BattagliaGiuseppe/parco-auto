-- P2.1 Connected Vehicles foundation
create extension if not exists pgcrypto with schema extensions;

insert into public.app_permissions(code,label,description) values
 ('devices.view','Visualizza mezzi connessi','Accesso a dispositivi, stato connessione e sessioni automatiche'),
 ('devices.edit','Gestisci mezzi connessi','Associazione dispositivi, chiavi ingest e configurazione')
on conflict (code) do update set label=excluded.label, description=excluded.description;

insert into public.role_permissions(role,permission_code)
select r.role,p.code
from (values ('owner'),('admin'),('engineer'),('mechanic'),('viewer')) r(role)
cross join (values ('devices.view')) p(code)
on conflict do nothing;

insert into public.role_permissions(role,permission_code)
select r.role,'devices.edit'
from (values ('owner'),('admin'),('engineer')) r(role)
on conflict do nothing;

create table if not exists public.connected_devices (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  car_id uuid not null references public.cars(id) on delete cascade,
  name text not null,
  provider text not null default 'generic',
  model text,
  serial_number text,
  external_device_id text,
  source_type text not null default 'logger' check (source_type in ('logger','cloud','mobile','gateway','import')),
  status text not null default 'active' check (status in ('active','inactive','revoked')),
  capabilities jsonb not null default '{}'::jsonb,
  firmware_version text,
  last_seen_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint connected_devices_name_len check (char_length(name) between 1 and 120)
);
create unique index if not exists connected_devices_team_external_uidx on public.connected_devices(team_id, provider, external_device_id) where external_device_id is not null;
create index if not exists connected_devices_team_car_idx on public.connected_devices(team_id,car_id,status);
create index if not exists connected_devices_team_last_seen_idx on public.connected_devices(team_id,last_seen_at desc);

create table if not exists public.connected_device_keys (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  device_id uuid not null references public.connected_devices(id) on delete cascade,
  key_prefix text not null,
  key_hash text not null unique,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz
);
create index if not exists connected_device_keys_device_active_idx on public.connected_device_keys(device_id,revoked_at,expires_at);

create table if not exists public.connected_ingest_batches (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  device_id uuid not null references public.connected_devices(id) on delete cascade,
  external_batch_id text not null,
  payload_hash text not null,
  status text not null default 'received' check (status in ('received','processed','duplicate','failed')),
  points_count integer not null default 0 check (points_count >= 0),
  raw_storage_path text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  unique(device_id,external_batch_id),
  constraint connected_ingest_batch_id_len check (char_length(external_batch_id) between 1 and 200)
);
create index if not exists connected_ingest_batches_team_received_idx on public.connected_ingest_batches(team_id,received_at desc);

create table if not exists public.connected_sessions (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  device_id uuid not null references public.connected_devices(id) on delete cascade,
  car_id uuid not null references public.cars(id) on delete cascade,
  ingest_batch_id uuid not null unique references public.connected_ingest_batches(id) on delete cascade,
  telemetry_file_id uuid references public.telemetry_files(id) on delete set null,
  event_id uuid references public.events(id) on delete set null,
  event_car_id uuid references public.event_cars(id) on delete set null,
  event_session_id uuid references public.event_sessions(id) on delete set null,
  event_car_turn_id uuid references public.event_car_turns(id) on delete set null,
  detected_circuit_id uuid references public.circuits(id) on delete set null,
  track_name text,
  detection_confidence numeric check (detection_confidence is null or (detection_confidence >= 0 and detection_confidence <= 1)),
  started_at timestamptz not null,
  ended_at timestamptz,
  engine_on_at timestamptz,
  engine_off_at timestamptz,
  engine_seconds numeric not null default 0 check (engine_seconds >= 0),
  track_seconds numeric not null default 0 check (track_seconds >= 0),
  laps_count integer not null default 0 check (laps_count >= 0),
  best_lap_seconds numeric check (best_lap_seconds is null or best_lap_seconds > 0),
  max_speed numeric check (max_speed is null or max_speed >= 0),
  max_rpm numeric check (max_rpm is null or max_rpm >= 0),
  status text not null default 'processed' check (status in ('processing','processed','needs_review','rejected')),
  source text not null default 'device',
  raw_storage_path text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint connected_session_time_order check (ended_at is null or ended_at >= started_at),
  constraint connected_session_reasonable_duration check (ended_at is null or ended_at <= started_at + interval '48 hours')
);
create index if not exists connected_sessions_team_started_idx on public.connected_sessions(team_id,started_at desc);
create index if not exists connected_sessions_team_car_started_idx on public.connected_sessions(team_id,car_id,started_at desc);
create index if not exists connected_sessions_device_started_idx on public.connected_sessions(device_id,started_at desc);

create table if not exists public.connected_session_laps (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  connected_session_id uuid not null references public.connected_sessions(id) on delete cascade,
  lap_number integer not null check (lap_number > 0),
  lap_time_seconds numeric check (lap_time_seconds is null or lap_time_seconds > 0),
  sector_times jsonb not null default '[]'::jsonb,
  max_speed numeric,
  started_at timestamptz,
  ended_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(connected_session_id,lap_number)
);
create index if not exists connected_session_laps_team_session_idx on public.connected_session_laps(team_id,connected_session_id,lap_number);

create table if not exists public.connected_hour_ledger (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  connected_session_id uuid not null unique references public.connected_sessions(id) on delete cascade,
  car_id uuid not null references public.cars(id) on delete cascade,
  hours_delta numeric not null check (hours_delta >= 0),
  applied_at timestamptz not null default now(),
  reversed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);
create index if not exists connected_hour_ledger_team_car_idx on public.connected_hour_ledger(team_id,car_id,applied_at desc);

-- timestamps
create or replace function public.set_connected_updated_at()
returns trigger language plpgsql set search_path='public' as $$
begin new.updated_at=now(); return new; end; $$;
revoke all on function public.set_connected_updated_at() from public,anon,authenticated;

drop trigger if exists connected_devices_set_updated_at on public.connected_devices;
create trigger connected_devices_set_updated_at before update on public.connected_devices for each row execute function public.set_connected_updated_at();
drop trigger if exists connected_sessions_set_updated_at on public.connected_sessions;
create trigger connected_sessions_set_updated_at before update on public.connected_sessions for each row execute function public.set_connected_updated_at();

-- RLS
alter table public.connected_devices enable row level security;
alter table public.connected_device_keys enable row level security;
alter table public.connected_ingest_batches enable row level security;
alter table public.connected_sessions enable row level security;
alter table public.connected_session_laps enable row level security;
alter table public.connected_hour_ledger enable row level security;

do $$ declare t text; begin
 for t in select unnest(array['connected_devices','connected_ingest_batches','connected_sessions','connected_session_laps','connected_hour_ledger']) loop
   execute format('drop policy if exists %I on public.%I',t||'_select_permission',t);
   execute format('create policy %I on public.%I for select to authenticated using (public.has_team_permission(team_id,''devices.view''))',t||'_select_permission',t);
 end loop;
end $$;

create policy connected_devices_insert_permission on public.connected_devices for insert to authenticated with check (public.has_team_permission(team_id,'devices.edit'));
create policy connected_devices_update_permission on public.connected_devices for update to authenticated using (public.has_team_permission(team_id,'devices.edit')) with check (public.has_team_permission(team_id,'devices.edit'));
create policy connected_devices_delete_permission on public.connected_devices for delete to authenticated using (public.has_team_permission(team_id,'devices.edit'));

-- No client access to secret hashes.
revoke all on table public.connected_device_keys from anon,authenticated;

-- Ingest/event tables are written only by trusted SECURITY DEFINER functions in this phase.
revoke insert,update,delete on table public.connected_ingest_batches, public.connected_sessions, public.connected_session_laps, public.connected_hour_ledger from anon,authenticated;

grant select on table public.connected_devices, public.connected_ingest_batches, public.connected_sessions, public.connected_session_laps, public.connected_hour_ledger to authenticated;
grant insert,update,delete on table public.connected_devices to authenticated;

-- Internal hour applier; never directly executable by clients.
create or replace function public.apply_connected_session_hours(p_session_id uuid)
returns numeric
language plpgsql security definer set search_path='public' as $$
declare
  v_session public.connected_sessions%rowtype;
  v_hours numeric;
begin
  select * into v_session from public.connected_sessions where id=p_session_id for update;
  if not found then raise exception 'Sessione connessa non trovata'; end if;
  v_hours := greatest(0,coalesce(v_session.engine_seconds,0))/3600.0;
  if v_hours = 0 then return 0; end if;
  if exists(select 1 from public.connected_hour_ledger where connected_session_id=p_session_id and reversed_at is null) then return 0; end if;

  update public.cars c set hours=greatest(0,coalesce(c.hours,0)+v_hours), total_hours=greatest(0,coalesce(c.total_hours,0)+v_hours)
  where c.id=v_session.car_id and c.team_id=v_session.team_id;

  with target_mounts as (
    select distinct cc.id,cc.component_id from public.car_components cc
    where cc.team_id=v_session.team_id and cc.car_id=v_session.car_id
      and coalesce(cc.mounted_at,cc.installed_at,cc.created_at,'-infinity'::timestamptz) <= v_session.started_at
      and (cc.removed_at is null or cc.removed_at > v_session.started_at)
  ), updated_mounts as (
    update public.car_components cc set hours_used=greatest(0,coalesce(cc.hours_used,0)+v_hours)
    from target_mounts tm where cc.id=tm.id returning tm.component_id
  ), target_components as (
    select distinct component_id from updated_mounts
    union
    select c.id from public.components c where c.team_id=v_session.team_id and c.car_id=v_session.car_id and coalesce(c.is_active,true)=true
  )
  update public.components c set hours=greatest(0,coalesce(c.hours,0)+v_hours), life_hours=greatest(0,coalesce(c.life_hours,0)+v_hours), work_hours=greatest(0,coalesce(c.work_hours,0)+v_hours)
  where c.id in (select component_id from target_components);

  insert into public.connected_hour_ledger(team_id,connected_session_id,car_id,hours_delta,metadata)
  values(v_session.team_id,v_session.id,v_session.car_id,v_hours,jsonb_build_object('source','device_ingest','engine_seconds',v_session.engine_seconds));
  return v_hours;
end; $$;
revoke all on function public.apply_connected_session_hours(uuid) from public,anon,authenticated;

create or replace function public.connected_devices_page(p_team_id uuid)
returns jsonb
language plpgsql stable security definer set search_path='public' as $$
declare v_result jsonb;
begin
 if not public.has_team_permission(p_team_id,'devices.view') then raise exception 'Permesso devices.view richiesto'; end if;
 select jsonb_build_object(
  'devices',coalesce((select jsonb_agg(jsonb_build_object(
    'id',d.id,'car_id',d.car_id,'car_name',c.name,'name',d.name,'provider',d.provider,'model',d.model,'serial_number',d.serial_number,
    'external_device_id',d.external_device_id,'source_type',d.source_type,'status',d.status,'capabilities',d.capabilities,'firmware_version',d.firmware_version,
    'last_seen_at',d.last_seen_at,'created_at',d.created_at,
    'active_key_prefix',(select k.key_prefix from public.connected_device_keys k where k.device_id=d.id and k.revoked_at is null and (k.expires_at is null or k.expires_at>now()) order by k.created_at desc limit 1),
    'sessions_count',(select count(*) from public.connected_sessions s where s.device_id=d.id),
    'last_session_at',(select max(s.started_at) from public.connected_sessions s where s.device_id=d.id)
  ) order by d.created_at desc) from public.connected_devices d join public.cars c on c.id=d.car_id and c.team_id=p_team_id where d.team_id=p_team_id),'[]'::jsonb),
  'stats',jsonb_build_object(
    'total',(select count(*) from public.connected_devices where team_id=p_team_id),
    'active',(select count(*) from public.connected_devices where team_id=p_team_id and status='active'),
    'online_15m',(select count(*) from public.connected_devices where team_id=p_team_id and status='active' and last_seen_at>=now()-interval '15 minutes'),
    'sessions_30d',(select count(*) from public.connected_sessions where team_id=p_team_id and started_at>=now()-interval '30 days')
  )
 ) into v_result;
 return v_result;
end; $$;
revoke all on function public.connected_devices_page(uuid) from public,anon;
grant execute on function public.connected_devices_page(uuid) to authenticated,service_role;

create or replace function public.create_connected_device(
 p_team_id uuid,p_car_id uuid,p_name text,p_provider text default 'generic',p_model text default null,p_serial_number text default null,p_external_device_id text default null,p_source_type text default 'logger'
) returns jsonb
language plpgsql security definer set search_path='public','extensions' as $$
declare v_device public.connected_devices%rowtype; v_secret text; v_hash text; v_prefix text;
begin
 if not public.has_team_permission(p_team_id,'devices.edit') then raise exception 'Permesso devices.edit richiesto'; end if;
 if not exists(select 1 from public.cars where id=p_car_id and team_id=p_team_id) then raise exception 'Mezzo non valido per il team'; end if;
 if coalesce(trim(p_name),'')='' then raise exception 'Nome dispositivo obbligatorio'; end if;
 insert into public.connected_devices(team_id,car_id,name,provider,model,serial_number,external_device_id,source_type)
 values(p_team_id,p_car_id,trim(p_name),lower(coalesce(nullif(trim(p_provider),''),'generic')),nullif(trim(p_model),''),nullif(trim(p_serial_number),''),nullif(trim(p_external_device_id),''),p_source_type)
 returning * into v_device;
 v_secret := 'mmp_'||replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
 v_hash := encode(digest(v_secret,'sha256'),'hex'); v_prefix:=left(v_secret,12);
 insert into public.connected_device_keys(team_id,device_id,key_prefix,key_hash) values(p_team_id,v_device.id,v_prefix,v_hash);
 return jsonb_build_object('device',to_jsonb(v_device),'api_key',v_secret,'key_prefix',v_prefix);
end; $$;
revoke all on function public.create_connected_device(uuid,uuid,text,text,text,text,text,text) from public,anon;
grant execute on function public.create_connected_device(uuid,uuid,text,text,text,text,text,text) to authenticated,service_role;

create or replace function public.rotate_connected_device_key(p_team_id uuid,p_device_id uuid)
returns jsonb language plpgsql security definer set search_path='public','extensions' as $$
declare v_secret text;v_hash text;v_prefix text;
begin
 if not public.has_team_permission(p_team_id,'devices.edit') then raise exception 'Permesso devices.edit richiesto'; end if;
 if not exists(select 1 from public.connected_devices where id=p_device_id and team_id=p_team_id) then raise exception 'Dispositivo non valido'; end if;
 update public.connected_device_keys set revoked_at=now() where device_id=p_device_id and team_id=p_team_id and revoked_at is null;
 v_secret := 'mmp_'||replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
 v_hash := encode(digest(v_secret,'sha256'),'hex'); v_prefix:=left(v_secret,12);
 insert into public.connected_device_keys(team_id,device_id,key_prefix,key_hash) values(p_team_id,p_device_id,v_prefix,v_hash);
 return jsonb_build_object('api_key',v_secret,'key_prefix',v_prefix);
end; $$;
revoke all on function public.rotate_connected_device_key(uuid,uuid) from public,anon;
grant execute on function public.rotate_connected_device_key(uuid,uuid) to authenticated,service_role;

create or replace function public.revoke_connected_device(p_team_id uuid,p_device_id uuid)
returns void language plpgsql security definer set search_path='public' as $$
begin
 if not public.has_team_permission(p_team_id,'devices.edit') then raise exception 'Permesso devices.edit richiesto'; end if;
 update public.connected_devices set status='revoked' where id=p_device_id and team_id=p_team_id;
 if not found then raise exception 'Dispositivo non valido'; end if;
 update public.connected_device_keys set revoked_at=coalesce(revoked_at,now()) where device_id=p_device_id and team_id=p_team_id;
end; $$;
revoke all on function public.revoke_connected_device(uuid,uuid) from public,anon;
grant execute on function public.revoke_connected_device(uuid,uuid) to authenticated,service_role;

-- Device/gateway ingestion endpoint. Summary + laps only; high-frequency raw data belongs in Storage/processing.
create or replace function public.ingest_connected_session(p_device_key text,p_external_batch_id text,p_payload jsonb)
returns jsonb
language plpgsql security definer set search_path='public','extensions' as $$
declare
 v_key public.connected_device_keys%rowtype; v_device public.connected_devices%rowtype; v_batch public.connected_ingest_batches%rowtype; v_session public.connected_sessions%rowtype;
 v_hash text; v_started timestamptz; v_ended timestamptz; v_laps jsonb; v_lap jsonb; v_count int; v_hours numeric; v_circuit uuid;
begin
 if coalesce(char_length(p_device_key),0)<20 then raise exception 'Chiave dispositivo non valida'; end if;
 if coalesce(trim(p_external_batch_id),'')='' or char_length(p_external_batch_id)>200 then raise exception 'external_batch_id non valido'; end if;
 if p_payload is null or jsonb_typeof(p_payload)<>'object' then raise exception 'Payload non valido'; end if;
 v_hash:=encode(digest(p_device_key,'sha256'),'hex');
 select * into v_key from public.connected_device_keys where key_hash=v_hash and revoked_at is null and (expires_at is null or expires_at>now()) order by created_at desc limit 1;
 if not found then raise exception 'Credenziale dispositivo non valida o revocata'; end if;
 select * into v_device from public.connected_devices where id=v_key.device_id and team_id=v_key.team_id and status='active';
 if not found then raise exception 'Dispositivo non attivo'; end if;

 -- idempotency: return the already-created session instead of applying hours twice.
 select * into v_batch from public.connected_ingest_batches where device_id=v_device.id and external_batch_id=p_external_batch_id;
 if found then
   select * into v_session from public.connected_sessions where ingest_batch_id=v_batch.id;
   update public.connected_device_keys set last_used_at=now() where id=v_key.id;
   update public.connected_devices set last_seen_at=now() where id=v_device.id;
   return jsonb_build_object('duplicate',true,'batch_id',v_batch.id,'session_id',v_session.id,'status',v_batch.status);
 end if;

 begin v_started:=(p_payload->>'started_at')::timestamptz; exception when others then raise exception 'started_at non valido'; end;
 if v_started is null then raise exception 'started_at obbligatorio'; end if;
 begin v_ended:=nullif(p_payload->>'ended_at','')::timestamptz; exception when others then raise exception 'ended_at non valido'; end;
 if v_ended is not null and (v_ended<v_started or v_ended>v_started+interval '48 hours') then raise exception 'Durata sessione non valida'; end if;
 v_laps:=coalesce(p_payload->'laps','[]'::jsonb);
 if jsonb_typeof(v_laps)<>'array' then raise exception 'laps deve essere un array'; end if;
 v_count:=jsonb_array_length(v_laps); if v_count>500 then raise exception 'Troppi giri nel payload'; end if;
 if nullif(p_payload->>'detected_circuit_id','') is not null then
   begin v_circuit:=(p_payload->>'detected_circuit_id')::uuid; exception when others then raise exception 'detected_circuit_id non valido'; end;
   if not exists(select 1 from public.circuits where id=v_circuit and team_id=v_device.team_id) then raise exception 'Circuito non valido per il team'; end if;
 end if;

 insert into public.connected_ingest_batches(team_id,device_id,external_batch_id,payload_hash,status,points_count,raw_storage_path,metadata)
 values(v_device.team_id,v_device.id,p_external_batch_id,encode(digest(p_payload::text,'sha256'),'hex'),'received',greatest(coalesce((p_payload->>'points_count')::int,0),0),nullif(p_payload->>'raw_storage_path',''),coalesce(p_payload->'batch_metadata','{}'::jsonb)) returning * into v_batch;

 insert into public.connected_sessions(team_id,device_id,car_id,ingest_batch_id,detected_circuit_id,track_name,detection_confidence,started_at,ended_at,engine_on_at,engine_off_at,engine_seconds,track_seconds,laps_count,best_lap_seconds,max_speed,max_rpm,status,source,raw_storage_path,metadata)
 values(v_device.team_id,v_device.id,v_device.car_id,v_batch.id,v_circuit,nullif(p_payload->>'track_name',''),nullif(p_payload->>'detection_confidence','')::numeric,v_started,v_ended,
   nullif(p_payload->>'engine_on_at','')::timestamptz,nullif(p_payload->>'engine_off_at','')::timestamptz,greatest(coalesce((p_payload->>'engine_seconds')::numeric,0),0),greatest(coalesce((p_payload->>'track_seconds')::numeric,0),0),
   coalesce(nullif(p_payload->>'laps_count','')::int,v_count,0),nullif(p_payload->>'best_lap_seconds','')::numeric,nullif(p_payload->>'max_speed','')::numeric,nullif(p_payload->>'max_rpm','')::numeric,
   case when coalesce((p_payload->>'needs_review')::boolean,false) then 'needs_review' else 'processed' end,coalesce(nullif(p_payload->>'source',''),'device'),nullif(p_payload->>'raw_storage_path',''),coalesce(p_payload->'metadata','{}'::jsonb)) returning * into v_session;

 for v_lap in select value from jsonb_array_elements(v_laps) loop
   insert into public.connected_session_laps(team_id,connected_session_id,lap_number,lap_time_seconds,sector_times,max_speed,started_at,ended_at,metadata)
   values(v_device.team_id,v_session.id,(v_lap->>'lap_number')::int,nullif(v_lap->>'lap_time_seconds','')::numeric,coalesce(v_lap->'sector_times','[]'::jsonb),nullif(v_lap->>'max_speed','')::numeric,nullif(v_lap->>'started_at','')::timestamptz,nullif(v_lap->>'ended_at','')::timestamptz,coalesce(v_lap->'metadata','{}'::jsonb));
 end loop;

 v_hours:=public.apply_connected_session_hours(v_session.id);
 update public.connected_ingest_batches set status='processed',processed_at=now(),metadata=metadata||jsonb_build_object('hours_applied',v_hours) where id=v_batch.id;
 update public.connected_device_keys set last_used_at=now() where id=v_key.id;
 update public.connected_devices set last_seen_at=now() where id=v_device.id;
 return jsonb_build_object('duplicate',false,'batch_id',v_batch.id,'session_id',v_session.id,'hours_applied',v_hours,'laps_received',v_count);
exception when others then
 if v_batch.id is not null then update public.connected_ingest_batches set status='failed',error_message=sqlerrm,processed_at=now() where id=v_batch.id; end if;
 raise;
end; $$;
revoke all on function public.ingest_connected_session(text,text,jsonb) from public;
grant execute on function public.ingest_connected_session(text,text,jsonb) to anon,authenticated,service_role;

-- Keep public tables inaccessible to anon; ingestion goes only through the validated RPC.
revoke all on table public.connected_devices,public.connected_device_keys,public.connected_ingest_batches,public.connected_sessions,public.connected_session_laps,public.connected_hour_ledger from anon;
