alter table public.events add column if not exists connected_day_key text;
alter table public.connected_sessions add column if not exists day_group_key text;

create unique index if not exists events_connected_day_key_uq
  on public.events(team_id, connected_day_key)
  where connected_day_key is not null;
create index if not exists connected_sessions_day_group_idx
  on public.connected_sessions(team_id, day_group_key, started_at desc)
  where day_group_key is not null;

create or replace function public.reconcile_connected_session(p_session_id uuid, p_create_event boolean default true)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  s public.connected_sessions%rowtype;
  v_event public.events%rowtype;
  v_event_car public.event_cars%rowtype;
  v_event_session public.event_sessions%rowtype;
  v_turn public.event_car_turns%rowtype;
  v_circuit_id uuid;
  v_circuit_name text;
  v_event_date date;
  v_event_name text;
  v_day_key text;
  v_avg_lap numeric;
  v_minutes integer;
  v_created_event boolean := false;
  v_note text;
  v_geo jsonb;
  v_default_driver_id uuid;
begin
  select * into s from public.connected_sessions where id=p_session_id for update;
  if not found then raise exception 'Sessione connessa non trovata'; end if;

  if s.activity_type <> 'track' then
    update public.connected_sessions
       set reconciliation_status='not_applicable', reconciled_at=now(),
           reconciliation_message=case when s.activity_type='engine_only'
             then 'Attività motore senza ingresso pista: ore registrate, nessun turno creato'
             else 'Attività pista non rilevata' end
     where id=s.id;
    return jsonb_build_object('reconciled',false,'not_applicable',true,'activity_type',s.activity_type);
  end if;

  if s.event_car_turn_id is not null and exists(
    select 1 from public.event_car_turns t where t.id=s.event_car_turn_id and t.connected_session_id=s.id
  ) then
    update public.connected_sessions
       set reconciliation_status='reconciled',reconciled_at=coalesce(reconciled_at,now()),reconciliation_message='Già riconciliata'
     where id=s.id;
    return jsonb_build_object('reconciled',true,'duplicate',true,'event_id',s.event_id,'event_car_id',s.event_car_id,'event_session_id',s.event_session_id,'turn_id',s.event_car_turn_id,'day_group_key',s.day_group_key);
  end if;

  v_circuit_id := s.detected_circuit_id;
  if v_circuit_id is null and s.gps_latitude is not null and s.gps_longitude is not null then
    v_geo := public.detect_connected_circuit(s.team_id,s.gps_latitude,s.gps_longitude);
    if coalesce((v_geo->>'matched')::boolean,false) then
      v_circuit_id := (v_geo->>'circuit_id')::uuid;
      v_circuit_name := v_geo->>'circuit_name';
      update public.connected_sessions
         set detected_circuit_id=v_circuit_id,
             detection_confidence=greatest(coalesce(detection_confidence,0),coalesce((v_geo->>'confidence')::numeric,0.7)),
             track_name=coalesce(nullif(track_name,''),v_circuit_name)
       where id=s.id;
    end if;
  end if;

  if v_circuit_id is null and nullif(trim(coalesce(s.track_name,'')),'') is not null then
    select c.id,c.name into v_circuit_id,v_circuit_name
      from public.circuits c
     where c.team_id=s.team_id and lower(trim(c.name))=lower(trim(s.track_name))
     order by c.created_at limit 1;
    if v_circuit_id is not null then
      update public.connected_sessions
         set detected_circuit_id=v_circuit_id,detection_confidence=greatest(coalesce(detection_confidence,0),0.80)
       where id=s.id;
    end if;
  elsif v_circuit_id is not null then
    select name into v_circuit_name from public.circuits where id=v_circuit_id and team_id=s.team_id;
  end if;

  v_event_date := (s.started_at at time zone 'Europe/Rome')::date;
  v_day_key := to_char(v_event_date,'YYYY-MM-DD') || ':' || coalesce(v_circuit_id::text, md5(lower(trim(coalesce(s.track_name,'unknown')))));
  update public.connected_sessions set day_group_key=v_day_key where id=s.id;

  if s.event_id is not null then
    select * into v_event from public.events where id=s.event_id and team_id=s.team_id;
  end if;
  if v_event.id is null then
    select * into v_event from public.events e where e.team_id=s.team_id and e.connected_day_key=v_day_key order by e.created_at limit 1;
  end if;
  if v_event.id is null and v_circuit_id is not null then
    select * into v_event from public.events e
     where e.team_id=s.team_id and e.date=v_event_date and e.circuit_id=v_circuit_id
     order by case when coalesce(e.notes,'') like '%[AUTO-CONNECTED]%' then 0 else 1 end, e.created_at limit 1;
  end if;

  v_event_name := 'Test - '||coalesce(v_circuit_name,nullif(trim(s.track_name),''),'Sessione connessa')||' - '||to_char(v_event_date,'DD/MM/YYYY');
  if v_event.id is null then
    select * into v_event from public.events e
     where e.team_id=s.team_id and e.date=v_event_date and e.name=v_event_name and coalesce(e.notes,'') like '%[AUTO-CONNECTED]%'
     order by e.created_at limit 1;
  end if;

  if v_event.id is not null and coalesce(v_event.notes,'') like '%[AUTO-CONNECTED]%' and v_event.connected_day_key is null then
    begin
      update public.events set connected_day_key=v_day_key where id=v_event.id and connected_day_key is null returning * into v_event;
    exception when unique_violation then
      select * into v_event from public.events e where e.team_id=s.team_id and e.connected_day_key=v_day_key order by e.created_at limit 1;
    end;
  end if;

  if v_event.id is null then
    if not p_create_event then
      update public.connected_sessions set reconciliation_status='needs_review',reconciliation_message='Nessun evento compatibile trovato' where id=s.id;
      return jsonb_build_object('reconciled',false,'needs_review',true,'day_group_key',v_day_key);
    end if;
    insert into public.events(team_id,date,name,notes,circuit_id,hours_total_event,connected_day_key)
    values(s.team_id,v_event_date,v_event_name,'[AUTO-CONNECTED] Creato automaticamente da Mezzi connessi.',v_circuit_id,0,v_day_key)
    on conflict (team_id,connected_day_key) where connected_day_key is not null do nothing
    returning * into v_event;
    if found then
      v_created_event := true;
    else
      select * into v_event from public.events e where e.team_id=s.team_id and e.connected_day_key=v_day_key order by e.created_at limit 1;
    end if;
  end if;

  insert into public.event_cars(team_id,event_id,car_id,status,notes)
  values(s.team_id,v_event.id,s.car_id,'in_corso','Associato automaticamente da Mezzi connessi')
  on conflict(event_id,car_id) do update set team_id=excluded.team_id returning * into v_event_car;

  select * into v_event_session from public.event_sessions es where es.connected_session_id=s.id;
  if v_event_session.id is null then
    insert into public.event_sessions(team_id,event_id,name,session_type,starts_at,ends_at,notes,connected_session_id,source)
    values(s.team_id,v_event.id,'Turno automatico '||to_char(s.started_at at time zone 'Europe/Rome','HH24:MI'),'test',coalesce(s.track_entry_at,s.started_at),coalesce(s.track_exit_at,s.ended_at),'Creato dalla sessione device '||s.id,s.id,'connected')
    returning * into v_event_session;
  end if;

  v_minutes := greatest(0,round(coalesce(nullif(s.track_seconds,0),s.engine_seconds,0)/60.0)::integer);
  if coalesce(s.track_seconds,s.engine_seconds,0)>0 and v_minutes=0 then v_minutes:=1; end if;
  select avg(l.lap_time_seconds) into v_avg_lap from public.connected_session_laps l where l.connected_session_id=s.id and l.lap_time_seconds is not null;
  select d.default_driver_id into v_default_driver_id from public.connected_devices d where d.id=s.device_id and d.team_id=s.team_id;
  v_note := 'Origine: Mezzi connessi. Tempo motore: '||round(coalesce(s.engine_seconds,0),1)||' s; tempo pista: '||round(coalesce(s.track_seconds,0),1)||' s.';

  select * into v_turn from public.event_car_turns t where t.connected_session_id=s.id;
  if v_turn.id is null then
    insert into public.event_car_turns(team_id,event_car_id,event_session_id,minutes,laps,notes,driver_id,fuel_start_liters,fuel_end_liters,created_by_team_user_id,recorded_at,connected_session_id,hours_source)
    values(s.team_id,v_event_car.id,v_event_session.id,v_minutes,coalesce(s.laps_count,0),v_note,v_default_driver_id,0,0,null,coalesce(s.track_entry_at,s.started_at),s.id,'connected') returning * into v_turn;
  else
    update public.event_car_turns
       set event_car_id=v_event_car.id,event_session_id=v_event_session.id,minutes=v_minutes,laps=coalesce(s.laps_count,0),notes=v_note,recorded_at=coalesce(s.track_entry_at,s.started_at),hours_source='connected'
     where id=v_turn.id returning * into v_turn;
  end if;

  insert into public.event_car_turn_metrics(team_id,turn_id,event_id,event_car_id,best_lap_ms,avg_lap_ms,technical_notes)
  values(s.team_id,v_turn.id,v_event.id,v_event_car.id,
         case when s.best_lap_seconds is null then null else round(s.best_lap_seconds*1000)::integer end,
         case when v_avg_lap is null then null else round(v_avg_lap*1000)::integer end,
         'Sessione automatica. V-max: '||coalesce(s.max_speed::text,'n/d')||'; RPM max: '||coalesce(s.max_rpm::text,'n/d')||'.')
  on conflict(turn_id) do update set event_id=excluded.event_id,event_car_id=excluded.event_car_id,best_lap_ms=excluded.best_lap_ms,avg_lap_ms=excluded.avg_lap_ms,technical_notes=excluded.technical_notes,updated_at=now();

  update public.connected_sessions
     set event_id=v_event.id,event_car_id=v_event_car.id,event_session_id=v_event_session.id,event_car_turn_id=v_turn.id,
         day_group_key=v_day_key,reconciliation_status='reconciled',reconciled_at=now(),
         reconciliation_message=case when v_created_event then 'Evento giornata creato automaticamente' else 'Collegata alla giornata pista esistente' end
   where id=s.id;

  return jsonb_build_object('reconciled',true,'duplicate',false,'event_created',v_created_event,'event_id',v_event.id,'event_car_id',v_event_car.id,'event_session_id',v_event_session.id,'turn_id',v_turn.id,'circuit_id',v_circuit_id,'day_group_key',v_day_key);
exception when others then
  update public.connected_sessions set reconciliation_status='failed',reconciliation_message=left(sqlerrm,500) where id=p_session_id;
  raise;
end;
$function$;

revoke execute on function public.reconcile_connected_session(uuid,boolean) from public, anon, authenticated;
grant execute on function public.reconcile_connected_session(uuid,boolean) to service_role;
