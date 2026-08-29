-- P2.9.4.5 - Multi-Day Event Reconciliation
-- Adds an event end date and makes connected-session reconciliation range-aware.

alter table public.events
  add column if not exists end_date date;

update public.events
   set end_date = date
 where date is not null
   and end_date is null;

alter table public.events
  drop constraint if exists events_date_range_valid;

alter table public.events
  add constraint events_date_range_valid
  check (date is null or end_date is null or end_date >= date);

create index if not exists events_team_circuit_date_range_idx
  on public.events(team_id,circuit_id,date,end_date);

create or replace function public.normalize_event_date_range()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if new.date is null then
    new.end_date := null;
    return new;
  end if;

  -- Old clients only knew the start date. If they move a single-day event,
  -- keep it single-day instead of leaving the previous date in end_date.
  if tg_op = 'UPDATE'
     and new.date is distinct from old.date
     and new.end_date is not distinct from old.end_date
     and old.end_date is not distinct from old.date then
    new.end_date := new.date;
  end if;

  if new.end_date is null then
    new.end_date := new.date;
  end if;

  if new.end_date < new.date then
    raise exception 'La data fine evento non può precedere la data inizio';
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_normalize_event_date_range on public.events;
create trigger trg_normalize_event_date_range
before insert or update of date,end_date on public.events
for each row execute function public.normalize_event_date_range();

create or replace function public.events_archive_page(
  p_team_id uuid,
  p_page integer default 1,
  p_page_size integer default 30
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_page integer := greatest(coalesce(p_page,1),1);
  v_size integer := least(greatest(coalesce(p_page_size,30),1),100);
  v_offset integer;
  v_result jsonb;
begin
  if not public.has_team_permission(p_team_id,'events.view') then
    raise exception 'Utente non autorizzato per il team %', p_team_id;
  end if;
  v_offset := (v_page-1)*v_size;

  with paged as (
    select e.id,e.date,e.end_date,e.name,e.notes,e.circuit_id,e.created_at,
      ci.name as circuit_name,
      coalesce(ec.event_cars,'[]'::jsonb) as event_cars
    from public.events e
    left join public.circuits ci on ci.id=e.circuit_id and ci.team_id=p_team_id
    left join lateral (
      select jsonb_agg(jsonb_build_object('id',x.id)) as event_cars
      from (select id from public.event_cars where team_id=p_team_id and event_id=e.id order by created_at limit 200) x
    ) ec on true
    where e.team_id=p_team_id
    order by e.date desc nulls last,e.created_at desc
    limit v_size offset v_offset
  )
  select jsonb_build_object(
    'items',coalesce((select jsonb_agg(jsonb_build_object(
      'id',p.id,
      'date',p.date,
      'end_date',p.end_date,
      'name',p.name,
      'notes',p.notes,
      'circuit_id',case when p.circuit_id is null then null else jsonb_build_object('id',p.circuit_id,'name',p.circuit_name) end,
      'event_cars',p.event_cars
    ) order by p.date desc nulls last,p.created_at desc) from paged p),'[]'::jsonb),
    'total',(select count(*) from public.events where team_id=p_team_id),
    'linked_cars_total',(select count(*) from public.event_cars where team_id=p_team_id),
    'next_event_date',(select min(date) from public.events where team_id=p_team_id and coalesce(end_date,date)>=current_date),
    'page',v_page,'page_size',v_size
  ) into v_result;
  return v_result;
end;
$function$;

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
    select * into v_event from public.events e
     where e.team_id=s.team_id and e.connected_day_key=v_day_key
     order by e.created_at limit 1;
  end if;

  -- P2.9.4.5: a manually configured motorsport weekend can span several days.
  -- Prefer a matching event that already contains this vehicle; then prefer
  -- manual events over auto-connected day events.
  if v_event.id is null and v_circuit_id is not null then
    select e.* into v_event
      from public.events e
     where e.team_id=s.team_id
       and e.circuit_id=v_circuit_id
       and e.date is not null
       and v_event_date between e.date and coalesce(e.end_date,e.date)
     order by
       case when exists(
         select 1 from public.event_cars ec
          where ec.team_id=s.team_id and ec.event_id=e.id and ec.car_id=s.car_id
       ) then 0 else 1 end,
       case when coalesce(e.notes,'') like '%[AUTO-CONNECTED]%' then 1 else 0 end,
       e.date desc,
       e.created_at
     limit 1;
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

    insert into public.events(team_id,date,end_date,name,notes,circuit_id,hours_total_event,connected_day_key)
    values(s.team_id,v_event_date,v_event_date,v_event_name,'[AUTO-CONNECTED] Creato automaticamente da Mezzi connessi.',v_circuit_id,0,v_day_key)
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
  on conflict(event_id,car_id) do update set team_id=excluded.team_id
  returning * into v_event_car;

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
    values(s.team_id,v_event_car.id,v_event_session.id,v_minutes,coalesce(s.laps_count,0),v_note,v_default_driver_id,0,0,null,coalesce(s.track_entry_at,s.started_at),s.id,'connected')
    returning * into v_turn;
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
         reconciliation_message=case when v_created_event then 'Evento giornata creato automaticamente' else 'Collegata al weekend/evento esistente' end
   where id=s.id;

  return jsonb_build_object('reconciled',true,'duplicate',false,'event_created',v_created_event,'event_id',v_event.id,'event_car_id',v_event_car.id,'event_session_id',v_event_session.id,'turn_id',v_turn.id,'circuit_id',v_circuit_id,'day_group_key',v_day_key);
exception when others then
  update public.connected_sessions set reconciliation_status='failed',reconciliation_message=left(sqlerrm,500) where id=p_session_id;
  raise;
end;
$function$;

revoke all on function public.events_archive_page(uuid,integer,integer) from public,anon;
grant execute on function public.events_archive_page(uuid,integer,integer) to authenticated;

comment on column public.events.end_date is 'P2.9.4.5 inclusive event end date. For single-day events it equals date.';
comment on function public.reconcile_connected_session(uuid,boolean) is 'Connected-session reconciliation with P2.9.4.5 multi-day event range matching.';
