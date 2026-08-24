create or replace function public.reconcile_connected_session(p_session_id uuid, p_create_event boolean default true)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  s public.connected_sessions%rowtype; v_event public.events%rowtype; v_event_car public.event_cars%rowtype;
  v_event_session public.event_sessions%rowtype; v_turn public.event_car_turns%rowtype;
  v_circuit_id uuid; v_circuit_name text; v_event_date date; v_event_name text; v_avg_lap numeric;
  v_minutes integer; v_created_event boolean:=false; v_note text; v_geo jsonb;
begin
  select * into s from public.connected_sessions where id=p_session_id for update;
  if not found then raise exception 'Sessione connessa non trovata'; end if;

  if s.activity_type <> 'track' then
    update public.connected_sessions set reconciliation_status='not_applicable',reconciled_at=now(),
      reconciliation_message=case when s.activity_type='engine_only' then 'Attività motore senza ingresso pista: ore registrate, nessun turno creato' else 'Attività pista non rilevata' end
    where id=s.id;
    return jsonb_build_object('reconciled',false,'not_applicable',true,'activity_type',s.activity_type);
  end if;

  if s.event_car_turn_id is not null and exists(select 1 from public.event_car_turns t where t.id=s.event_car_turn_id and t.connected_session_id=s.id) then
    update public.connected_sessions set reconciliation_status='reconciled',reconciled_at=coalesce(reconciled_at,now()),reconciliation_message='Già riconciliata' where id=s.id;
    return jsonb_build_object('reconciled',true,'duplicate',true,'event_id',s.event_id,'event_car_id',s.event_car_id,'event_session_id',s.event_session_id,'turn_id',s.event_car_turn_id);
  end if;

  v_circuit_id:=s.detected_circuit_id;
  if v_circuit_id is null and s.gps_latitude is not null and s.gps_longitude is not null then
    v_geo:=public.detect_connected_circuit(s.team_id,s.gps_latitude,s.gps_longitude);
    if coalesce((v_geo->>'matched')::boolean,false) then
      v_circuit_id:=(v_geo->>'circuit_id')::uuid;
      v_circuit_name:=v_geo->>'circuit_name';
      update public.connected_sessions set detected_circuit_id=v_circuit_id,
        detection_confidence=greatest(coalesce(detection_confidence,0),coalesce((v_geo->>'confidence')::numeric,0.7)),
        track_name=coalesce(nullif(track_name,''),v_circuit_name) where id=s.id;
    end if;
  end if;
  if v_circuit_id is null and nullif(trim(coalesce(s.track_name,'')),'') is not null then
    select c.id,c.name into v_circuit_id,v_circuit_name from public.circuits c
    where c.team_id=s.team_id and lower(trim(c.name))=lower(trim(s.track_name)) order by c.created_at limit 1;
    if v_circuit_id is not null then update public.connected_sessions set detected_circuit_id=v_circuit_id,detection_confidence=greatest(coalesce(detection_confidence,0),0.80) where id=s.id; end if;
  elsif v_circuit_id is not null then
    select name into v_circuit_name from public.circuits where id=v_circuit_id and team_id=s.team_id;
  end if;

  v_event_date:=(s.started_at at time zone 'Europe/Rome')::date;
  if s.event_id is not null then select * into v_event from public.events where id=s.event_id and team_id=s.team_id; end if;
  if v_event.id is null and v_circuit_id is not null then
    select * into v_event from public.events e where e.team_id=s.team_id and e.date=v_event_date and e.circuit_id=v_circuit_id order by e.created_at limit 1;
  end if;
  v_event_name:='Test - '||coalesce(v_circuit_name,nullif(trim(s.track_name),''),'Sessione connessa')||' - '||to_char(v_event_date,'DD/MM/YYYY');
  if v_event.id is null then
    select * into v_event from public.events e where e.team_id=s.team_id and e.date=v_event_date and e.name=v_event_name and coalesce(e.notes,'') like '%[AUTO-CONNECTED]%' order by e.created_at limit 1;
  end if;
  if v_event.id is null then
    if not p_create_event then
      update public.connected_sessions set reconciliation_status='needs_review',reconciliation_message='Nessun evento compatibile trovato' where id=s.id;
      return jsonb_build_object('reconciled',false,'needs_review',true,'reason','event_not_found');
    end if;
    insert into public.events(team_id,date,name,notes,circuit_id,hours_total_event)
    values(s.team_id,v_event_date,v_event_name,'[AUTO-CONNECTED] Creato automaticamente da Mezzi connessi.',v_circuit_id,0) returning * into v_event;
    v_created_event:=true;
  end if;

  insert into public.event_cars(team_id,event_id,car_id,status,notes)
  values(s.team_id,v_event.id,s.car_id,'in_corso','Associato automaticamente da Mezzi connessi')
  on conflict(event_id,car_id) do update set team_id=excluded.team_id returning * into v_event_car;

  select * into v_event_session from public.event_sessions es where es.connected_session_id=s.id;
  if v_event_session.id is null then
    insert into public.event_sessions(team_id,event_id,name,session_type,starts_at,ends_at,notes,connected_session_id,source)
    values(s.team_id,v_event.id,'Turno automatico '||to_char(s.started_at at time zone 'Europe/Rome','HH24:MI'),'test',coalesce(s.track_entry_at,s.started_at),coalesce(s.track_exit_at,s.ended_at),'Creato dalla sessione device '||s.id,s.id,'connected') returning * into v_event_session;
  end if;

  v_minutes:=greatest(0,round(coalesce(nullif(s.track_seconds,0),s.engine_seconds,0)/60.0)::integer);
  if coalesce(s.track_seconds,s.engine_seconds,0)>0 and v_minutes=0 then v_minutes:=1; end if;
  select avg(l.lap_time_seconds) into v_avg_lap from public.connected_session_laps l where l.connected_session_id=s.id and l.lap_time_seconds is not null;
  v_note:='Origine: Mezzi connessi. Tempo motore: '||round(coalesce(s.engine_seconds,0),1)||' s; tempo pista: '||round(coalesce(s.track_seconds,0),1)||' s.';
  select * into v_turn from public.event_car_turns t where t.connected_session_id=s.id;
  if v_turn.id is null then
    insert into public.event_car_turns(team_id,event_car_id,event_session_id,minutes,laps,notes,driver_id,fuel_start_liters,fuel_end_liters,created_by_team_user_id,recorded_at,connected_session_id,hours_source)
    values(s.team_id,v_event_car.id,v_event_session.id,v_minutes,coalesce(s.laps_count,0),v_note,null,0,0,null,coalesce(s.track_entry_at,s.started_at),s.id,'connected') returning * into v_turn;
  else
    update public.event_car_turns set event_car_id=v_event_car.id,event_session_id=v_event_session.id,minutes=v_minutes,laps=coalesce(s.laps_count,0),notes=v_note,recorded_at=coalesce(s.track_entry_at,s.started_at),hours_source='connected' where id=v_turn.id returning * into v_turn;
  end if;

  insert into public.event_car_turn_metrics(team_id,turn_id,event_id,event_car_id,best_lap_ms,avg_lap_ms,technical_notes)
  values(s.team_id,v_turn.id,v_event.id,v_event_car.id,case when s.best_lap_seconds is null then null else round(s.best_lap_seconds*1000)::integer end,case when v_avg_lap is null then null else round(v_avg_lap*1000)::integer end,'Sessione automatica. V-max: '||coalesce(s.max_speed::text,'n/d')||'; RPM max: '||coalesce(s.max_rpm::text,'n/d')||'.')
  on conflict(turn_id) do update set event_id=excluded.event_id,event_car_id=excluded.event_car_id,best_lap_ms=excluded.best_lap_ms,avg_lap_ms=excluded.avg_lap_ms,technical_notes=excluded.technical_notes,updated_at=now();

  update public.connected_sessions set event_id=v_event.id,event_car_id=v_event_car.id,event_session_id=v_event_session.id,event_car_turn_id=v_turn.id,reconciliation_status='reconciled',reconciled_at=now(),reconciliation_message=case when v_created_event then 'Evento creato automaticamente' else 'Collegata a evento esistente' end where id=s.id;
  return jsonb_build_object('reconciled',true,'duplicate',false,'event_created',v_created_event,'event_id',v_event.id,'event_car_id',v_event_car.id,'event_session_id',v_event_session.id,'turn_id',v_turn.id,'circuit_id',v_circuit_id);
exception when others then
  update public.connected_sessions set reconciliation_status='failed',reconciliation_message=left(sqlerrm,500) where id=p_session_id;
  raise;
end;
$function$;

create or replace function public.ingest_connected_session(p_device_key text,p_external_batch_id text,p_payload jsonb)
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

