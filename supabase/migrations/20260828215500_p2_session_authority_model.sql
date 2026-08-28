-- P2.8.1 Session Authority Model
-- One official session source per connected device.

alter table public.connected_devices add column if not exists session_authority text;
update public.connected_devices
set session_authority=case when acquisition_mode='smartphone' then 'smartphone' else 'external_logger' end
where session_authority is null;
alter table public.connected_devices alter column session_authority set not null;
alter table public.connected_devices drop constraint if exists connected_devices_session_authority_check;
alter table public.connected_devices add constraint connected_devices_session_authority_check
  check (session_authority in ('smartphone','external_logger'));
alter table public.connected_devices drop constraint if exists connected_devices_mode_authority_consistency_check;
alter table public.connected_devices add constraint connected_devices_mode_authority_consistency_check check (
  (acquisition_mode='smartphone' and session_authority='smartphone') or
  (acquisition_mode in ('external_logger','hybrid') and session_authority='external_logger')
);

create or replace function public.set_connected_device_acquisition_mode(p_team_id uuid,p_device_id uuid,p_mode text)
returns jsonb language plpgsql security definer set search_path='public' as $function$
declare d public.connected_devices%rowtype;
begin
  if not public.has_team_permission(p_team_id,'devices.edit') then raise exception 'Permesso devices.edit richiesto'; end if;
  if p_mode not in ('smartphone','external_logger','hybrid') then raise exception 'Modalità acquisizione non valida'; end if;
  update public.connected_devices
     set acquisition_mode=p_mode,
         session_authority=case when p_mode='smartphone' then 'smartphone' else 'external_logger' end
   where id=p_device_id and team_id=p_team_id returning * into d;
  if not found then raise exception 'Dispositivo non trovato'; end if;
  return jsonb_build_object('id',d.id,'acquisition_mode',d.acquisition_mode,'session_authority',d.session_authority);
end;
$function$;
revoke all on function public.set_connected_device_acquisition_mode(uuid,uuid,text) from public;
grant execute on function public.set_connected_device_acquisition_mode(uuid,uuid,text) to authenticated,service_role;

create or replace function public.get_connected_device_runtime_config(p_device_key text)
returns jsonb language plpgsql stable security definer set search_path='public','extensions' as $function$
declare k public.connected_device_keys%rowtype; d public.connected_devices%rowtype; v_hash text;
begin
  if coalesce(char_length(p_device_key),0)<20 then raise exception 'Chiave dispositivo non valida'; end if;
  v_hash:=encode(digest(p_device_key,'sha256'),'hex');
  select * into k from public.connected_device_keys where key_hash=v_hash and revoked_at is null and (expires_at is null or expires_at>now()) order by created_at desc limit 1;
  if not found then raise exception 'Credenziale dispositivo non valida o revocata'; end if;
  select * into d from public.connected_devices where id=k.device_id and team_id=k.team_id and status='active';
  if not found then raise exception 'Dispositivo non attivo'; end if;
  return jsonb_build_object('device_id',d.id,'car_id',d.car_id,'name',d.name,'source_type',d.source_type,'acquisition_mode',d.acquisition_mode,'session_authority',d.session_authority,'default_driver_id',d.default_driver_id,'capabilities',coalesce(d.capabilities,'{}'::jsonb));
end;
$function$;
revoke all on function public.get_connected_device_runtime_config(text) from public;
grant execute on function public.get_connected_device_runtime_config(text) to anon,authenticated,service_role;

-- Core is callable only from trusted SECURITY DEFINER functions.
create or replace function public.ingest_connected_session_core(p_device_key text,p_external_batch_id text,p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public','extensions'
as $function$
declare
  k public.connected_device_keys%rowtype; d public.connected_devices%rowtype; b public.connected_ingest_batches%rowtype; s public.connected_sessions%rowtype;
  hash text; st timestamptz; en timestamptz; laps jsonb; lap jsonb; n int; h numeric; circuit uuid; rec jsonb;
  v_lat numeric; v_lon numeric; v_entry timestamptz; v_exit timestamptz; v_track_seconds numeric; v_engine_seconds numeric; v_laps_count int; v_activity text; v_geo jsonb; v_track_name text; v_conf numeric;
begin
  if coalesce(char_length(p_device_key),0)<20 then raise exception 'Chiave dispositivo non valida'; end if;
  if coalesce(trim(p_external_batch_id),'')='' or char_length(p_external_batch_id)>200 then raise exception 'external_batch_id non valido'; end if;
  if p_payload is null or jsonb_typeof(p_payload)<>'object' then raise exception 'Payload non valido'; end if;
  hash:=encode(digest(p_device_key,'sha256'),'hex');
  select * into k from public.connected_device_keys where key_hash=hash and revoked_at is null and(expires_at is null or expires_at>now()) order by created_at desc limit 1;
  if not found then raise exception 'Credenziale dispositivo non valida o revocata'; end if;
  select * into d from public.connected_devices where id=k.device_id and team_id=k.team_id and status='active';
  if not found then raise exception 'Dispositivo non attivo'; end if;
  select * into b from public.connected_ingest_batches where device_id=d.id and external_batch_id=p_external_batch_id;
  if found then
    select * into s from public.connected_sessions where ingest_batch_id=b.id;
    update public.connected_device_keys set last_used_at=now() where id=k.id; update public.connected_devices set last_seen_at=now() where id=d.id;
    return jsonb_build_object('duplicate',true,'batch_id',b.id,'session_id',s.id,'status',b.status,'activity_type',s.activity_type,'reconciliation_status',s.reconciliation_status,'event_id',s.event_id,'turn_id',s.event_car_turn_id,'detected_circuit_id',s.detected_circuit_id);
  end if;
  begin st:=(p_payload->>'started_at')::timestamptz; exception when others then raise exception 'started_at non valido'; end;
  if st is null then raise exception 'started_at obbligatorio'; end if;
  begin en:=nullif(p_payload->>'ended_at','')::timestamptz; exception when others then raise exception 'ended_at non valido'; end;
  if en is not null and(en<st or en>st+interval '48 hours') then raise exception 'Durata sessione non valida'; end if;
  laps:=coalesce(p_payload->'laps','[]'::jsonb); if jsonb_typeof(laps)<>'array' then raise exception 'laps deve essere un array'; end if;
  n:=jsonb_array_length(laps); if n>500 then raise exception 'Troppi giri nel payload'; end if;
  begin v_lat:=nullif(p_payload->>'latitude','')::numeric; v_lon:=nullif(p_payload->>'longitude','')::numeric; exception when others then raise exception 'Coordinate GPS non valide'; end;
  if (v_lat is null)<>(v_lon is null) or (v_lat is not null and (v_lat not between -90 and 90 or v_lon not between -180 and 180)) then raise exception 'Coordinate GPS non valide'; end if;
  begin v_entry:=nullif(p_payload->>'track_entry_at','')::timestamptz; v_exit:=nullif(p_payload->>'track_exit_at','')::timestamptz; exception when others then raise exception 'Finestra pista non valida'; end;
  if v_entry is not null and v_exit is not null and v_exit<v_entry then raise exception 'track_exit_at precedente a track_entry_at'; end if;
  v_engine_seconds:=greatest(coalesce(nullif(p_payload->>'engine_seconds','')::numeric,0),0);
  v_track_seconds:=greatest(coalesce(nullif(p_payload->>'track_seconds','')::numeric,case when v_entry is not null and v_exit is not null then extract(epoch from(v_exit-v_entry)) else 0 end),0);
  v_laps_count:=coalesce(nullif(p_payload->>'laps_count','')::int,n,0);
  v_activity:=case when v_track_seconds>0 or v_laps_count>0 or v_entry is not null or v_exit is not null then 'track' when v_engine_seconds>0 then 'engine_only' else 'unknown' end;
  v_track_name:=nullif(p_payload->>'track_name',''); v_conf:=nullif(p_payload->>'detection_confidence','')::numeric;
  if nullif(p_payload->>'detected_circuit_id','') is not null then
    begin circuit:=(p_payload->>'detected_circuit_id')::uuid; exception when others then raise exception 'detected_circuit_id non valido'; end;
    if not exists(select 1 from public.circuits where id=circuit and team_id=d.team_id) then raise exception 'Circuito non valido per il team'; end if;
  elsif v_lat is not null and v_activity='track' then
    v_geo:=public.detect_connected_circuit(d.team_id,v_lat,v_lon);
    if coalesce((v_geo->>'matched')::boolean,false) then circuit:=(v_geo->>'circuit_id')::uuid; v_track_name:=coalesce(v_track_name,v_geo->>'circuit_name'); v_conf:=greatest(coalesce(v_conf,0),coalesce((v_geo->>'confidence')::numeric,0.7)); end if;
  end if;
  insert into public.connected_ingest_batches(team_id,device_id,external_batch_id,payload_hash,status,points_count,raw_storage_path,metadata)
  values(d.team_id,d.id,p_external_batch_id,encode(digest(p_payload::text,'sha256'),'hex'),'received',greatest(coalesce(nullif(p_payload->>'points_count','')::int,0),0),nullif(p_payload->>'raw_storage_path',''),coalesce(p_payload->'batch_metadata','{}'::jsonb)) returning * into b;
  insert into public.connected_sessions(team_id,device_id,car_id,ingest_batch_id,detected_circuit_id,track_name,detection_confidence,started_at,ended_at,engine_on_at,engine_off_at,engine_seconds,track_seconds,laps_count,best_lap_seconds,max_speed,max_rpm,status,source,raw_storage_path,metadata,gps_latitude,gps_longitude,track_entry_at,track_exit_at,activity_type)
  values(d.team_id,d.id,d.car_id,b.id,circuit,v_track_name,v_conf,st,en,nullif(p_payload->>'engine_on_at','')::timestamptz,nullif(p_payload->>'engine_off_at','')::timestamptz,v_engine_seconds,v_track_seconds,v_laps_count,nullif(p_payload->>'best_lap_seconds','')::numeric,nullif(p_payload->>'max_speed','')::numeric,nullif(p_payload->>'max_rpm','')::numeric,case when coalesce((p_payload->>'needs_review')::boolean,false) then 'needs_review' else 'processed' end,coalesce(nullif(p_payload->>'source',''),'device'),nullif(p_payload->>'raw_storage_path',''),coalesce(p_payload->'metadata','{}'::jsonb),v_lat,v_lon,v_entry,v_exit,v_activity) returning * into s;
  for lap in select value from jsonb_array_elements(laps) loop
    insert into public.connected_session_laps(team_id,connected_session_id,lap_number,lap_time_seconds,sector_times,max_speed,started_at,ended_at,metadata)
    values(d.team_id,s.id,(lap->>'lap_number')::int,nullif(lap->>'lap_time_seconds','')::numeric,coalesce(lap->'sector_times','[]'::jsonb),nullif(lap->>'max_speed','')::numeric,nullif(lap->>'started_at','')::timestamptz,nullif(lap->>'ended_at','')::timestamptz,coalesce(lap->'metadata','{}'::jsonb));
  end loop;
  h:=public.apply_connected_session_hours(s.id);
  begin rec:=public.reconcile_connected_session(s.id,true); exception when others then update public.connected_sessions set reconciliation_status='needs_review',reconciliation_message=left(sqlerrm,500) where id=s.id; rec:=jsonb_build_object('reconciled',false,'needs_review',true,'error',left(sqlerrm,300)); end;
  update public.connected_ingest_batches set status='processed',processed_at=now(),metadata=metadata||jsonb_build_object('hours_applied',h,'reconciliation',rec) where id=b.id;
  update public.connected_device_keys set last_used_at=now() where id=k.id; update public.connected_devices set last_seen_at=now() where id=d.id;
  select * into s from public.connected_sessions where id=s.id;
  return jsonb_build_object('duplicate',false,'batch_id',b.id,'session_id',s.id,'hours_applied',h,'laps_received',n,'activity_type',s.activity_type,'reconciliation_status',s.reconciliation_status,'event_id',s.event_id,'turn_id',s.event_car_turn_id,'detected_circuit_id',s.detected_circuit_id,'detection_confidence',s.detection_confidence);
exception when others then
  if b.id is not null then update public.connected_ingest_batches set status='failed',error_message=sqlerrm,processed_at=now() where id=b.id; end if;
  raise;
end;
$function$;
revoke all on function public.ingest_connected_session_core(text,text,jsonb) from public,anon,authenticated,service_role;

-- Direct /ingest is the official external-logger channel.
create or replace function public.ingest_connected_session(p_device_key text,p_external_batch_id text,p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public','extensions'
as $function$
declare
  k public.connected_device_keys%rowtype;
  d public.connected_devices%rowtype;
  v_hash text;
begin
  if coalesce(char_length(p_device_key),0)<20 then raise exception 'Chiave dispositivo non valida'; end if;
  v_hash:=encode(digest(p_device_key,'sha256'),'hex');
  select * into k from public.connected_device_keys where key_hash=v_hash and revoked_at is null and (expires_at is null or expires_at>now()) order by created_at desc limit 1;
  if not found then raise exception 'Credenziale dispositivo non valida o revocata'; end if;
  select * into d from public.connected_devices where id=k.device_id and team_id=k.team_id and status='active';
  if not found then raise exception 'Dispositivo non attivo'; end if;
  if d.session_authority <> 'external_logger' then
    raise exception 'Ingest logger esterno rifiutato: autorità sessione = %',d.session_authority;
  end if;
  return public.ingest_connected_session_core(p_device_key,p_external_batch_id,p_payload);
end;
$function$;
revoke all on function public.ingest_connected_session(text,text,jsonb) from public;
grant execute on function public.ingest_connected_session(text,text,jsonb) to anon,authenticated,service_role;

-- Smartphone stream is accepted only when the smartphone owns session authority.
create or replace function public.ingest_connected_stream_window(
  p_device_key text,
  p_external_window_id text,
  p_payload jsonb
) returns jsonb
language plpgsql
security definer
set search_path to 'public','extensions'
as $function$
declare
  k public.connected_device_keys%rowtype;
  d public.connected_devices%rowtype;
  w public.connected_stream_windows%rowtype;
  seg public.connected_stream_segments%rowtype;
  v_hash text;
  v_samples jsonb;
  v_count int;
  v_first_ts timestamptz;
  v_last_ts timestamptz;
  v_max_gap numeric;
  v_entry_speed numeric;
  v_exit_speed numeric;
  v_exit_hold numeric;
  rec record;
  v_s jsonb;
  v_next jsonb;
  v_ts timestamptz;
  v_next_ts timestamptz;
  v_delta numeric;
  v_lat numeric;
  v_lon numeric;
  v_speed numeric;
  v_rpm numeric;
  v_engine boolean;
  v_geo jsonb;
  v_geo_match boolean;
  v_geo_circuit uuid;
  v_on_track boolean := false;
  v_low_speed_seconds numeric := 0;
  v_activity text;
  v_current_segment_id uuid;
  v_current_activity text;
  v_current_circuit uuid;
  v_segment_index int := 0;
  v_ingest_result jsonb;
  v_segment_payload jsonb;
  v_results jsonb := '[]'::jsonb;
  v_ext_id text;
  v_gate_lat numeric;
  v_gate_lon numeric;
  v_gate_radius integer;
  v_min_lap_seconds integer;
  v_gate_inside boolean := false;
  v_inside_gate boolean := false;
  v_last_crossing timestamptz;
  v_crossing_index integer := 0;
  v_lap_number integer := 0;
  v_lap_time numeric;
  v_session_id uuid;
  v_lap_count integer;
  v_best_lap numeric;
  v_avg_lap numeric;
begin
  if coalesce(char_length(p_device_key),0) < 20 then raise exception 'Chiave dispositivo non valida'; end if;
  if coalesce(trim(p_external_window_id),'')='' or char_length(p_external_window_id)>200 then raise exception 'external_window_id non valido'; end if;
  if p_payload is null or jsonb_typeof(p_payload)<>'object' then raise exception 'Payload non valido'; end if;

  v_hash:=encode(digest(p_device_key,'sha256'),'hex');
  select * into k from public.connected_device_keys where key_hash=v_hash and revoked_at is null and (expires_at is null or expires_at>now()) order by created_at desc limit 1;
  if not found then raise exception 'Credenziale dispositivo non valida o revocata'; end if;
  select * into d from public.connected_devices where id=k.device_id and team_id=k.team_id and status='active';
  if not found then raise exception 'Dispositivo non attivo'; end if;
  if d.session_authority <> 'smartphone' then raise exception 'Stream smartphone rifiutato: autorità sessione = %', d.session_authority; end if;

  perform pg_advisory_xact_lock(hashtextextended(d.id::text, 0));

  select * into w from public.connected_stream_windows where device_id=d.id and external_window_id=p_external_window_id;
  if found then
    return jsonb_build_object(
      'duplicate',true,'window_id',w.id,'status',w.status,'segments_count',w.segments_count,
      'segments',coalesce((select jsonb_agg(jsonb_build_object('segment_index',s.segment_index,'activity_type',s.activity_type,'session_id',s.connected_session_id,'circuit_id',s.detected_circuit_id,'started_at',s.started_at,'ended_at',s.ended_at) order by s.segment_index) from public.connected_stream_segments s where s.stream_window_id=w.id),'[]'::jsonb)
    );
  end if;

  v_samples:=coalesce(p_payload->'samples','[]'::jsonb);
  if jsonb_typeof(v_samples)<>'array' then raise exception 'samples deve essere un array'; end if;
  v_count:=jsonb_array_length(v_samples);
  if v_count < 2 then raise exception 'Servono almeno 2 campioni'; end if;
  if v_count > 2000 then raise exception 'Troppi campioni nella finestra (max 2000)'; end if;

  begin v_first_ts:=(v_samples->0->>'ts')::timestamptz; exception when others then raise exception 'Timestamp primo campione non valido'; end;
  begin v_last_ts:=(v_samples->(v_count-1)->>'ts')::timestamptz; exception when others then raise exception 'Timestamp ultimo campione non valido'; end;
  if v_first_ts is null or v_last_ts is null or v_last_ts<=v_first_ts or v_last_ts>v_first_ts+interval '12 hours' then raise exception 'Finestra temporale non valida'; end if;

  v_max_gap:=least(300,greatest(5,coalesce(nullif(p_payload->>'max_gap_seconds','')::numeric,30)));
  v_entry_speed:=least(250,greatest(5,coalesce(nullif(p_payload->>'track_entry_speed_kph','')::numeric,45)));
  v_exit_speed:=least(v_entry_speed,greatest(0,coalesce(nullif(p_payload->>'track_exit_speed_kph','')::numeric,20)));
  v_exit_hold:=least(180,greatest(5,coalesce(nullif(p_payload->>'track_exit_hold_seconds','')::numeric,20)));

  if exists(
    select 1 from public.connected_stream_windows x
    where x.device_id=d.id and x.status in ('received','processed')
      and x.started_at < v_last_ts and x.ended_at > v_first_ts
  ) then raise exception 'Finestra temporale sovrapposta a dati già acquisiti'; end if;

  insert into public.connected_stream_windows(team_id,device_id,external_window_id,started_at,ended_at,samples_count,status,metadata)
  values(d.team_id,d.id,p_external_window_id,v_first_ts,v_last_ts,v_count,'received',jsonb_build_object('max_gap_seconds',v_max_gap,'track_entry_speed_kph',v_entry_speed,'track_exit_speed_kph',v_exit_speed,'track_exit_hold_seconds',v_exit_hold))
  returning * into w;

  for rec in
    select value as sample, lead(value) over(order by ord) as next_sample, ord
    from jsonb_array_elements(v_samples) with ordinality a(value,ord)
    order by ord
  loop
    v_s:=rec.sample; v_next:=rec.next_sample;
    if v_next is null then exit; end if;
    begin v_ts:=(v_s->>'ts')::timestamptz; v_next_ts:=(v_next->>'ts')::timestamptz; exception when others then raise exception 'Timestamp campione non valido in posizione %',rec.ord; end;
    v_delta:=extract(epoch from (v_next_ts-v_ts));
    if v_delta<=0 then raise exception 'I campioni devono essere in ordine temporale crescente'; end if;

    if v_delta>v_max_gap then
      v_current_segment_id:=null; v_current_activity:=null; v_current_circuit:=null; v_on_track:=false; v_low_speed_seconds:=0;
      v_gate_inside:=false; v_last_crossing:=null; v_crossing_index:=0; v_lap_number:=0;
      continue;
    end if;

    v_lat:=nullif(v_s->>'lat','')::numeric;
    v_lon:=nullif(v_s->>'lon','')::numeric;
    if (v_lat is null)<>(v_lon is null) or (v_lat is not null and (v_lat not between -90 and 90 or v_lon not between -180 and 180)) then raise exception 'Coordinate GPS non valide nel campione %',rec.ord; end if;
    v_speed:=greatest(coalesce(nullif(v_s->>'speed_kph','')::numeric,0),0);
    v_rpm:=greatest(coalesce(nullif(v_s->>'rpm','')::numeric,0),0);
    v_engine:=coalesce(nullif(v_s->>'engine_on','')::boolean, v_rpm>0, false);

    v_geo_match:=false; v_geo_circuit:=null;
    if v_lat is not null then
      v_geo:=public.detect_connected_circuit(d.team_id,v_lat,v_lon);
      v_geo_match:=coalesce((v_geo->>'matched')::boolean,false);
      if v_geo_match then v_geo_circuit:=(v_geo->>'circuit_id')::uuid; end if;
    end if;

    if not v_engine then
      v_on_track:=false; v_low_speed_seconds:=0; v_activity:='off';
    else
      if not v_on_track then
        if v_geo_match and v_speed>=v_entry_speed then v_on_track:=true; v_low_speed_seconds:=0; end if;
      else
        if not v_geo_match then
          v_on_track:=false; v_low_speed_seconds:=0;
        elsif v_speed<=v_exit_speed then
          v_low_speed_seconds:=v_low_speed_seconds+v_delta;
          if v_low_speed_seconds>=v_exit_hold then v_on_track:=false; v_low_speed_seconds:=0; end if;
        else
          v_low_speed_seconds:=0;
        end if;
      end if;
      v_activity:=case when v_on_track then 'track' else 'engine_only' end;
    end if;

    if v_activity='off' then
      v_current_segment_id:=null; v_current_activity:=null; v_current_circuit:=null;
      v_gate_inside:=false; v_last_crossing:=null; v_crossing_index:=0; v_lap_number:=0;
      continue;
    end if;

    if v_current_segment_id is null or v_current_activity is distinct from v_activity or (v_activity='track' and v_current_circuit is distinct from v_geo_circuit) then
      v_segment_index:=v_segment_index+1;
      insert into public.connected_stream_segments(stream_window_id,team_id,device_id,segment_index,activity_type,detected_circuit_id,started_at,ended_at,engine_seconds,track_seconds,samples_count,max_speed,max_rpm,representative_latitude,representative_longitude)
      values(w.id,d.team_id,d.id,v_segment_index,v_activity,case when v_activity='track' then v_geo_circuit else null end,v_ts,v_next_ts,v_delta,case when v_activity='track' then v_delta else 0 end,1,v_speed,v_rpm,v_lat,v_lon)
      returning id into v_current_segment_id;
      v_current_activity:=v_activity; v_current_circuit:=case when v_activity='track' then v_geo_circuit else null end;
      v_gate_inside:=false; v_last_crossing:=null; v_crossing_index:=0; v_lap_number:=0;
      if v_activity='track' and v_geo_circuit is not null then
        select lap_gate_latitude,lap_gate_longitude,lap_gate_radius_m,min_lap_seconds
          into v_gate_lat,v_gate_lon,v_gate_radius,v_min_lap_seconds
        from public.circuits where id=v_geo_circuit and team_id=d.team_id;
      else
        v_gate_lat:=null; v_gate_lon:=null; v_gate_radius:=null; v_min_lap_seconds:=null;
      end if;
    else
      update public.connected_stream_segments set
        ended_at=v_next_ts,
        engine_seconds=engine_seconds+v_delta,
        track_seconds=track_seconds+case when v_activity='track' then v_delta else 0 end,
        samples_count=samples_count+1,
        max_speed=greatest(coalesce(max_speed,0),v_speed),
        max_rpm=greatest(coalesce(max_rpm,0),v_rpm)
      where id=v_current_segment_id;
    end if;

    if v_activity='track' and v_current_segment_id is not null and v_gate_lat is not null and v_gate_lon is not null and v_gate_radius is not null and v_lat is not null then
      v_inside_gate:=public.connected_distance_m(v_lat,v_lon,v_gate_lat,v_gate_lon)<=v_gate_radius;
      if v_inside_gate and not v_gate_inside then
        if v_last_crossing is null then
          v_crossing_index:=v_crossing_index+1;
          insert into public.connected_stream_lap_marks(stream_window_id,stream_segment_id,team_id,device_id,detected_circuit_id,crossing_index,crossing_at)
          values(w.id,v_current_segment_id,d.team_id,d.id,v_geo_circuit,v_crossing_index,v_ts);
          v_last_crossing:=v_ts;
        else
          v_lap_time:=extract(epoch from(v_ts-v_last_crossing));
          if v_lap_time>=coalesce(v_min_lap_seconds,20) then
            v_lap_number:=v_lap_number+1;
            v_crossing_index:=v_crossing_index+1;
            insert into public.connected_stream_lap_marks(stream_window_id,stream_segment_id,team_id,device_id,detected_circuit_id,crossing_index,crossing_at,lap_number,lap_time_seconds)
            values(w.id,v_current_segment_id,d.team_id,d.id,v_geo_circuit,v_crossing_index,v_ts,v_lap_number,v_lap_time);
            v_last_crossing:=v_ts;
          end if;
        end if;
      end if;
      v_gate_inside:=v_inside_gate;
    else
      v_gate_inside:=false;
    end if;
  end loop;

  for seg in select * from public.connected_stream_segments where stream_window_id=w.id order by segment_index
  loop
    v_ext_id:=left('stream:'||p_external_window_id||':'||seg.segment_index,200);
    v_segment_payload:=jsonb_build_object(
      'started_at',seg.started_at,
      'ended_at',seg.ended_at,
      'engine_on_at',seg.started_at,
      'engine_off_at',seg.ended_at,
      'engine_seconds',seg.engine_seconds,
      'track_seconds',seg.track_seconds,
      'latitude',seg.representative_latitude,
      'longitude',seg.representative_longitude,
      'max_speed',seg.max_speed,
      'max_rpm',seg.max_rpm,
      'points_count',seg.samples_count,
      'source','stream_segmenter',
      'metadata',jsonb_build_object('stream_window_id',w.id,'segment_index',seg.segment_index,'segmentation','p2.4')
    );
    if seg.activity_type='track' then
      v_segment_payload:=v_segment_payload || jsonb_build_object('track_entry_at',seg.started_at,'track_exit_at',seg.ended_at,'detected_circuit_id',seg.detected_circuit_id);
    end if;
    v_ingest_result:=public.ingest_connected_session_core(p_device_key,v_ext_id,v_segment_payload);
    v_session_id:=(v_ingest_result->>'session_id')::uuid;
    update public.connected_stream_segments set connected_session_id=v_session_id where id=seg.id;

    if seg.activity_type='track' then
      insert into public.connected_session_laps(team_id,connected_session_id,lap_number,lap_time_seconds,started_at,ended_at,metadata)
      select m.team_id,v_session_id,m.lap_number,m.lap_time_seconds,m.crossing_at-(m.lap_time_seconds||' seconds')::interval,m.crossing_at,jsonb_build_object('source','p2.5_gps_lap_gate','stream_segment_id',seg.id)
      from public.connected_stream_lap_marks m
      where m.stream_segment_id=seg.id and m.lap_number is not null and m.lap_time_seconds is not null
      order by m.lap_number;

      select count(*),min(lap_time_seconds),avg(lap_time_seconds) into v_lap_count,v_best_lap,v_avg_lap
      from public.connected_session_laps where connected_session_id=v_session_id;

      if coalesce(v_lap_count,0)>0 then
        update public.connected_sessions set laps_count=v_lap_count,best_lap_seconds=v_best_lap where id=v_session_id;
        update public.event_car_turns t set laps=v_lap_count
        from public.connected_sessions cs where cs.id=v_session_id and t.id=cs.event_car_turn_id;
        update public.event_car_turn_metrics m set best_lap_ms=round(v_best_lap*1000)::integer,avg_lap_ms=round(v_avg_lap*1000)::integer,updated_at=now()
        from public.connected_sessions cs where cs.id=v_session_id and m.turn_id=cs.event_car_turn_id;
      end if;
    else
      v_lap_count:=0; v_best_lap:=null;
    end if;

    v_results:=v_results||jsonb_build_array(jsonb_build_object('segment_index',seg.segment_index,'activity_type',seg.activity_type,'session_id',v_session_id,'event_id',v_ingest_result->>'event_id','turn_id',v_ingest_result->>'turn_id','circuit_id',seg.detected_circuit_id,'started_at',seg.started_at,'ended_at',seg.ended_at,'engine_seconds',seg.engine_seconds,'track_seconds',seg.track_seconds,'laps_detected',coalesce(v_lap_count,0),'best_lap_seconds',v_best_lap));
  end loop;

  update public.connected_stream_windows set status='processed',processed_at=now(),segments_count=v_segment_index where id=w.id returning * into w;
  update public.connected_device_keys set last_used_at=now() where id=k.id;
  update public.connected_devices set last_seen_at=now() where id=d.id;
  return jsonb_build_object('duplicate',false,'window_id',w.id,'segments_count',v_segment_index,'segments',v_results);
exception when others then
  if w.id is not null then update public.connected_stream_windows set status='failed',processed_at=now(),error_message=left(sqlerrm,500) where id=w.id; end if;
  raise;
end;
$function$;
revoke all on function public.ingest_connected_stream_window(text,text,jsonb) from public;
grant execute on function public.ingest_connected_stream_window(text,text,jsonb) to anon,authenticated,service_role;

create or replace function public.connected_devices_page(p_team_id uuid)
returns jsonb
language plpgsql
stable security definer
set search_path='public'
as $function$
declare r jsonb;
begin
  if not public.has_team_permission(p_team_id,'devices.view') then raise exception 'Permesso devices.view richiesto'; end if;
  select jsonb_build_object(
    'devices',coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'car_id',d.car_id,'car_name',c.name,'name',d.name,'provider',d.provider,'model',d.model,'serial_number',d.serial_number,'external_device_id',d.external_device_id,'source_type',d.source_type,'acquisition_mode',d.acquisition_mode,'session_authority',d.session_authority,'status',d.status,'capabilities',d.capabilities,'firmware_version',d.firmware_version,'last_seen_at',d.last_seen_at,'created_at',d.created_at,'default_driver_id',d.default_driver_id,'default_driver_name',case when drv.id is null then null else trim(drv.first_name||' '||drv.last_name) end,'active_key_prefix',(select k.key_prefix from public.connected_device_keys k where k.device_id=d.id and k.revoked_at is null and(k.expires_at is null or k.expires_at>now()) order by k.created_at desc limit 1),'sessions_count',(select count(*) from public.connected_sessions s where s.device_id=d.id),'last_session_at',(select max(s.started_at) from public.connected_sessions s where s.device_id=d.id)) order by d.created_at desc) from public.connected_devices d join public.cars c on c.id=d.car_id and c.team_id=p_team_id left join public.drivers drv on drv.id=d.default_driver_id and drv.team_id=p_team_id where d.team_id=p_team_id),'[]'::jsonb),
    'cars',case when public.has_team_permission(p_team_id,'devices.edit') then coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'chassis_number',c.chassis_number) order by c.name) from public.cars c where c.team_id=p_team_id),'[]'::jsonb) else '[]'::jsonb end,
    'drivers',case when public.has_team_permission(p_team_id,'devices.edit') then coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'first_name',d.first_name,'last_name',d.last_name,'nickname',d.nickname,'racing_number',d.racing_number,'is_active',d.is_active) order by d.last_name,d.first_name) from public.drivers d where d.team_id=p_team_id and d.is_active=true),'[]'::jsonb) else '[]'::jsonb end,
    'circuits',case when public.has_team_permission(p_team_id,'events.view') then coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'city',c.city,'country',c.country,'latitude',c.latitude,'longitude',c.longitude,'detection_radius_m',c.detection_radius_m,'lap_gate_latitude',c.lap_gate_latitude,'lap_gate_longitude',c.lap_gate_longitude,'lap_gate_radius_m',c.lap_gate_radius_m,'min_lap_seconds',c.min_lap_seconds) order by c.name) from public.circuits c where c.team_id=p_team_id),'[]'::jsonb) else '[]'::jsonb end,
    'recent_sessions',coalesce((select jsonb_agg(to_jsonb(x) order by x.started_at desc) from(select s.id,s.device_id,d.name device_name,s.car_id,c.name car_name,s.track_name,s.started_at,s.ended_at,s.engine_seconds,s.track_seconds,s.laps_count,s.best_lap_seconds,s.max_speed,s.max_rpm,s.status,s.activity_type,s.day_group_key,s.gps_latitude,s.gps_longitude,s.track_entry_at,s.track_exit_at,s.detected_circuit_id,s.detection_confidence,ci.name detected_circuit_name,s.reconciliation_status,s.reconciliation_message,s.reconciled_at,s.event_id,e.name event_name,s.event_session_id,s.event_car_turn_id,t.driver_id,case when drv.id is null then null else trim(drv.first_name||' '||drv.last_name) end driver_name from public.connected_sessions s join public.connected_devices d on d.id=s.device_id join public.cars c on c.id=s.car_id left join public.circuits ci on ci.id=s.detected_circuit_id left join public.events e on e.id=s.event_id left join public.event_car_turns t on t.id=s.event_car_turn_id left join public.drivers drv on drv.id=t.driver_id where s.team_id=p_team_id order by s.started_at desc limit 20)x),'[]'::jsonb),
    'day_summaries',coalesce((select jsonb_agg(to_jsonb(ds) order by ds.day_date desc,ds.event_name) from (
      select (min(s.started_at) at time zone 'Europe/Rome')::date as day_date,s.event_id,e.name as event_name,s.detected_circuit_id,ci.name as circuit_name,count(*)::int as turns_count,sum(s.laps_count)::int as laps_count,sum(s.track_seconds) as track_seconds,sum(s.engine_seconds) as engine_seconds,min(s.best_lap_seconds) filter (where s.best_lap_seconds is not null) as best_lap_seconds,max(s.max_speed) as max_speed,min(s.day_group_key) as day_group_key
      from public.connected_sessions s left join public.events e on e.id=s.event_id left join public.circuits ci on ci.id=s.detected_circuit_id
      where s.team_id=p_team_id and s.activity_type='track' and s.reconciliation_status='reconciled' and s.started_at>=now()-interval '30 days' and s.event_id is not null
      group by s.event_id,e.name,s.detected_circuit_id,ci.name order by day_date desc limit 12
    ) ds),'[]'::jsonb),
    'stats',jsonb_build_object('total',(select count(*) from public.connected_devices where team_id=p_team_id),'active',(select count(*) from public.connected_devices where team_id=p_team_id and status='active'),'online_15m',(select count(*) from public.connected_devices where team_id=p_team_id and status='active' and last_seen_at>=now()-interval '15 minutes'),'sessions_30d',(select count(*) from public.connected_sessions where team_id=p_team_id and started_at>=now()-interval '30 days'),'track_30d',(select count(*) from public.connected_sessions where team_id=p_team_id and activity_type='track' and started_at>=now()-interval '30 days'),'engine_only_30d',(select count(*) from public.connected_sessions where team_id=p_team_id and activity_type='engine_only' and started_at>=now()-interval '30 days'),'needs_review',(select count(*) from public.connected_sessions where team_id=p_team_id and reconciliation_status in ('needs_review','failed')))
  ) into r;
  return r;
end;
$function$;
