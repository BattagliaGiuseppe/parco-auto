create table if not exists public.connected_stream_windows (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  device_id uuid not null references public.connected_devices(id) on delete cascade,
  external_window_id text not null check (char_length(external_window_id) between 1 and 200),
  started_at timestamptz not null,
  ended_at timestamptz not null,
  samples_count integer not null default 0 check (samples_count >= 0),
  segments_count integer not null default 0 check (segments_count >= 0),
  status text not null default 'received' check (status in ('received','processed','failed')),
  metadata jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  unique(device_id, external_window_id),
  check (ended_at >= started_at),
  check (ended_at <= started_at + interval '12 hours')
);

create table if not exists public.connected_stream_segments (
  id uuid primary key default gen_random_uuid(),
  stream_window_id uuid not null references public.connected_stream_windows(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  device_id uuid not null references public.connected_devices(id) on delete cascade,
  segment_index integer not null check (segment_index >= 1),
  activity_type text not null check (activity_type in ('track','engine_only')),
  detected_circuit_id uuid references public.circuits(id) on delete set null,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  engine_seconds numeric not null default 0 check (engine_seconds >= 0),
  track_seconds numeric not null default 0 check (track_seconds >= 0),
  samples_count integer not null default 0 check (samples_count >= 0),
  max_speed numeric,
  max_rpm numeric,
  representative_latitude numeric,
  representative_longitude numeric,
  connected_session_id uuid references public.connected_sessions(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(stream_window_id, segment_index),
  check (ended_at >= started_at)
);

create index if not exists connected_stream_windows_device_time_idx on public.connected_stream_windows(device_id, started_at, ended_at);
create index if not exists connected_stream_segments_window_idx on public.connected_stream_segments(stream_window_id, segment_index);
create index if not exists connected_stream_segments_session_idx on public.connected_stream_segments(connected_session_id) where connected_session_id is not null;

alter table public.connected_stream_windows enable row level security;
alter table public.connected_stream_segments enable row level security;
revoke all on public.connected_stream_windows from anon, authenticated;
revoke all on public.connected_stream_segments from anon, authenticated;
grant select on public.connected_stream_windows to authenticated;
grant select on public.connected_stream_segments to authenticated;

drop policy if exists connected_stream_windows_select on public.connected_stream_windows;
create policy connected_stream_windows_select on public.connected_stream_windows for select to authenticated using (public.has_team_permission(team_id,'devices.view'));
drop policy if exists connected_stream_segments_select on public.connected_stream_segments;
create policy connected_stream_segments_select on public.connected_stream_segments for select to authenticated using (public.has_team_permission(team_id,'devices.view'));

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
begin
  if coalesce(char_length(p_device_key),0) < 20 then raise exception 'Chiave dispositivo non valida'; end if;
  if coalesce(trim(p_external_window_id),'')='' or char_length(p_external_window_id)>200 then raise exception 'external_window_id non valido'; end if;
  if p_payload is null or jsonb_typeof(p_payload)<>'object' then raise exception 'Payload non valido'; end if;

  v_hash:=encode(digest(p_device_key,'sha256'),'hex');
  select * into k from public.connected_device_keys where key_hash=v_hash and revoked_at is null and (expires_at is null or expires_at>now()) order by created_at desc limit 1;
  if not found then raise exception 'Credenziale dispositivo non valida o revocata'; end if;
  select * into d from public.connected_devices where id=k.device_id and team_id=k.team_id and status='active';
  if not found then raise exception 'Dispositivo non attivo'; end if;

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
      continue;
    end if;

    if v_current_segment_id is null or v_current_activity is distinct from v_activity or (v_activity='track' and v_current_circuit is distinct from v_geo_circuit) then
      v_segment_index:=v_segment_index+1;
      insert into public.connected_stream_segments(stream_window_id,team_id,device_id,segment_index,activity_type,detected_circuit_id,started_at,ended_at,engine_seconds,track_seconds,samples_count,max_speed,max_rpm,representative_latitude,representative_longitude)
      values(w.id,d.team_id,d.id,v_segment_index,v_activity,case when v_activity='track' then v_geo_circuit else null end,v_ts,v_next_ts,v_delta,case when v_activity='track' then v_delta else 0 end,1,v_speed,v_rpm,v_lat,v_lon)
      returning id into v_current_segment_id;
      v_current_activity:=v_activity; v_current_circuit:=case when v_activity='track' then v_geo_circuit else null end;
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
    v_ingest_result:=public.ingest_connected_session(p_device_key,v_ext_id,v_segment_payload);
    update public.connected_stream_segments set connected_session_id=(v_ingest_result->>'session_id')::uuid where id=seg.id;
    v_results:=v_results||jsonb_build_array(jsonb_build_object('segment_index',seg.segment_index,'activity_type',seg.activity_type,'session_id',v_ingest_result->>'session_id','event_id',v_ingest_result->>'event_id','turn_id',v_ingest_result->>'turn_id','circuit_id',seg.detected_circuit_id,'started_at',seg.started_at,'ended_at',seg.ended_at,'engine_seconds',seg.engine_seconds,'track_seconds',seg.track_seconds));
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
grant execute on function public.ingest_connected_stream_window(text,text,jsonb) to anon, authenticated, service_role;
