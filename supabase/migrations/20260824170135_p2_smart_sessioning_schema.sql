alter table public.circuits
  add column if not exists latitude numeric,
  add column if not exists longitude numeric,
  add column if not exists detection_radius_m integer;

alter table public.circuits
  drop constraint if exists circuits_latitude_check,
  drop constraint if exists circuits_longitude_check,
  drop constraint if exists circuits_detection_radius_check;
alter table public.circuits
  add constraint circuits_latitude_check check (latitude is null or (latitude between -90 and 90)),
  add constraint circuits_longitude_check check (longitude is null or (longitude between -180 and 180)),
  add constraint circuits_detection_radius_check check (detection_radius_m is null or (detection_radius_m between 100 and 10000));

alter table public.connected_sessions
  add column if not exists gps_latitude numeric,
  add column if not exists gps_longitude numeric,
  add column if not exists track_entry_at timestamptz,
  add column if not exists track_exit_at timestamptz,
  add column if not exists activity_type text not null default 'unknown';

alter table public.connected_sessions
  drop constraint if exists connected_sessions_activity_type_check,
  drop constraint if exists connected_sessions_reconciliation_status_check,
  drop constraint if exists connected_sessions_gps_latitude_check,
  drop constraint if exists connected_sessions_gps_longitude_check,
  drop constraint if exists connected_sessions_track_window_check;
alter table public.connected_sessions
  add constraint connected_sessions_activity_type_check check (activity_type in ('track','engine_only','unknown')),
  add constraint connected_sessions_reconciliation_status_check check (reconciliation_status in ('pending','reconciled','not_applicable','needs_review','failed')),
  add constraint connected_sessions_gps_latitude_check check (gps_latitude is null or (gps_latitude between -90 and 90)),
  add constraint connected_sessions_gps_longitude_check check (gps_longitude is null or (gps_longitude between -180 and 180)),
  add constraint connected_sessions_track_window_check check (track_exit_at is null or track_entry_at is null or track_exit_at >= track_entry_at);

create index if not exists circuits_geo_detection_idx on public.circuits(team_id) where latitude is not null and longitude is not null and detection_radius_m is not null;
create index if not exists connected_sessions_activity_idx on public.connected_sessions(team_id, activity_type, started_at desc);
create index if not exists connected_sessions_circuit_day_idx on public.connected_sessions(team_id, detected_circuit_id, started_at desc) where detected_circuit_id is not null;

create or replace function public.connected_distance_m(p_lat1 numeric,p_lon1 numeric,p_lat2 numeric,p_lon2 numeric)
returns numeric
language sql
immutable
set search_path to 'public'
as $function$
  select 6371000 * 2 * asin(sqrt(
    power(sin(radians((p_lat2-p_lat1)/2)),2) +
    cos(radians(p_lat1))*cos(radians(p_lat2))*power(sin(radians((p_lon2-p_lon1)/2)),2)
  ));
$function$;

revoke all on function public.connected_distance_m(numeric,numeric,numeric,numeric) from public, anon, authenticated;

create or replace function public.detect_connected_circuit(p_team_id uuid,p_latitude numeric,p_longitude numeric)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare r record;
begin
  if p_latitude is null or p_longitude is null or p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then
    return jsonb_build_object('matched',false);
  end if;
  select c.id,c.name,c.detection_radius_m,
         public.connected_distance_m(p_latitude,p_longitude,c.latitude,c.longitude) distance_m
  into r
  from public.circuits c
  where c.team_id=p_team_id and c.latitude is not null and c.longitude is not null and c.detection_radius_m is not null
    and public.connected_distance_m(p_latitude,p_longitude,c.latitude,c.longitude) <= c.detection_radius_m
  order by public.connected_distance_m(p_latitude,p_longitude,c.latitude,c.longitude), c.name
  limit 1;
  if not found then return jsonb_build_object('matched',false); end if;
  return jsonb_build_object(
    'matched',true,'circuit_id',r.id,'circuit_name',r.name,'distance_m',round(r.distance_m,1),
    'confidence',greatest(0.70,least(0.99,1-(r.distance_m/greatest(r.detection_radius_m,1))*0.30))
  );
end;
$function$;

revoke all on function public.detect_connected_circuit(uuid,numeric,numeric) from public, anon;
grant execute on function public.detect_connected_circuit(uuid,numeric,numeric) to authenticated;

create or replace function public.set_circuit_detection_geofence(
  p_team_id uuid,p_circuit_id uuid,p_latitude numeric,p_longitude numeric,p_radius_m integer default 1500
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not public.has_team_permission(p_team_id,'events.edit') then raise exception 'Permesso events.edit richiesto'; end if;
  if p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then raise exception 'Coordinate non valide'; end if;
  if p_radius_m not between 100 and 10000 then raise exception 'Raggio di rilevamento non valido'; end if;
  update public.circuits set latitude=p_latitude,longitude=p_longitude,detection_radius_m=p_radius_m
  where id=p_circuit_id and team_id=p_team_id;
  if not found then raise exception 'Circuito non trovato'; end if;
  return jsonb_build_object('circuit_id',p_circuit_id,'latitude',p_latitude,'longitude',p_longitude,'radius_m',p_radius_m);
end;
$function$;
revoke all on function public.set_circuit_detection_geofence(uuid,uuid,numeric,numeric,integer) from public, anon;
grant execute on function public.set_circuit_detection_geofence(uuid,uuid,numeric,numeric,integer) to authenticated;

-- Backfill old sessions from known summary data.
update public.connected_sessions
set activity_type=case when coalesce(track_seconds,0)>0 or coalesce(laps_count,0)>0 then 'track'
                       when coalesce(engine_seconds,0)>0 then 'engine_only' else 'unknown' end
where activity_type='unknown';

