-- P0-E.3: tighten cross-module lookup permissions.
-- Applied live already on Supabase.

create or replace function public.team_reference_lookup(
  p_team_id uuid,
  p_kind text,
  p_search text default null,
  p_limit integer default 30,
  p_parent_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_kind text:=lower(trim(coalesce(p_kind,'')));
  v_q text:=lower(trim(coalesce(p_search,'')));
  v_limit integer:=least(greatest(coalesce(p_limit,30),1),100);
  v_result jsonb;
begin
  if not public.is_team_member(p_team_id) then raise exception 'Utente non autorizzato per il team %',p_team_id; end if;
  case v_kind
  when 'events' then
    if not (public.has_team_permission(p_team_id,'events.view') or public.has_team_permission(p_team_id,'tasks.edit') or public.has_team_permission(p_team_id,'telemetry.edit') or public.has_team_permission(p_team_id,'attendance.clock_self') or public.has_team_permission(p_team_id,'attendance.manage') or public.has_team_permission(p_team_id,'attendance.kiosk')) then raise exception 'Permesso insufficiente'; end if;
    select coalesce(jsonb_agg(to_jsonb(x) order by x.date desc nulls last),'[]'::jsonb) into v_result from (select id,name,date from public.events where team_id=p_team_id and (v_q='' or lower(name) like '%'||v_q||'%') order by date desc nulls last limit v_limit) x;
  when 'inventory' then
    if not (public.has_team_permission(p_team_id,'inventory.view') or public.has_team_permission(p_team_id,'tasks.edit')) then raise exception 'Permesso insufficiente'; end if;
    select coalesce(jsonb_agg(to_jsonb(x) order by x.name),'[]'::jsonb) into v_result from (select id,name from public.inventory_items where team_id=p_team_id and archived_at is null and (v_q='' or search_text like '%'||v_q||'%') order by name limit v_limit) x;
  when 'components' then
    if not (public.has_team_permission(p_team_id,'components.view') or public.has_team_permission(p_team_id,'tasks.edit') or public.has_team_permission(p_team_id,'maintenances.edit') or public.has_team_permission(p_team_id,'mounts.edit')) then raise exception 'Permesso insufficiente'; end if;
    select coalesce(jsonb_agg(to_jsonb(x) order by x.identifier),'[]'::jsonb) into v_result from (select id,type,identifier,car_id,hours,life_hours from public.components where team_id=p_team_id and (p_parent_id is null or car_id is null or car_id=p_parent_id) and (v_q='' or lower(coalesce(identifier,'')||' '||coalesce(type,'')) like '%'||v_q||'%') order by identifier limit v_limit) x;
  when 'drivers' then
    if not (public.has_team_permission(p_team_id,'drivers.view') or public.has_team_permission(p_team_id,'tasks.edit') or public.has_team_permission(p_team_id,'telemetry.edit')) then raise exception 'Permesso insufficiente'; end if;
    select coalesce(jsonb_agg(to_jsonb(x) order by x.last_name,x.first_name),'[]'::jsonb) into v_result from (select id,first_name,last_name,nickname from public.drivers where team_id=p_team_id and (v_q='' or lower(coalesce(first_name,'')||' '||coalesce(last_name,'')||' '||coalesce(nickname,'')) like '%'||v_q||'%') order by last_name,first_name limit v_limit) x;
  when 'sessions' then
    if not (public.has_team_permission(p_team_id,'events.view') or public.has_team_permission(p_team_id,'telemetry.edit')) then raise exception 'Permesso insufficiente'; end if;
    select coalesce(jsonb_agg(to_jsonb(x) order by x.starts_at desc nulls last,x.created_at desc),'[]'::jsonb) into v_result from (select id,event_id,name,session_type,starts_at,ends_at,created_at from public.event_sessions where team_id=p_team_id and (p_parent_id is null or event_id=p_parent_id) and (v_q='' or lower(coalesce(name,'')||' '||coalesce(session_type,'')) like '%'||v_q||'%') order by starts_at desc nulls last,created_at desc limit v_limit) x;
  when 'event_cars' then
    if not (public.has_team_permission(p_team_id,'events.view') or public.has_team_permission(p_team_id,'telemetry.edit')) then raise exception 'Permesso insufficiente'; end if;
    select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb) into v_result from (select ec.id,ec.event_id,ec.car_id,ec.status,ec.created_at,ca.name as car_name,e.name as event_name from public.event_cars ec join public.cars ca on ca.id=ec.car_id and ca.team_id=p_team_id join public.events e on e.id=ec.event_id and e.team_id=p_team_id where ec.team_id=p_team_id and (p_parent_id is null or ec.event_id=p_parent_id) and (v_q='' or lower(coalesce(ca.name,'')||' '||coalesce(e.name,'')) like '%'||v_q||'%') order by ec.created_at desc limit v_limit) x;
  when 'turns' then
    if not (public.has_team_permission(p_team_id,'events.view') or public.has_team_permission(p_team_id,'telemetry.edit')) then raise exception 'Permesso insufficiente'; end if;
    select coalesce(jsonb_agg(to_jsonb(x) order by x.recorded_at desc),'[]'::jsonb) into v_result from (select t.id,t.event_car_id,t.event_session_id,t.driver_id,t.minutes,t.laps,t.recorded_at,t.created_at,ec.event_id,ec.car_id,e.name as event_name,ca.name as car_name,s.name as session_name,d.first_name,d.last_name from public.event_car_turns t join public.event_cars ec on ec.id=t.event_car_id and ec.team_id=p_team_id join public.events e on e.id=ec.event_id and e.team_id=p_team_id join public.cars ca on ca.id=ec.car_id and ca.team_id=p_team_id left join public.event_sessions s on s.id=t.event_session_id and s.team_id=p_team_id left join public.drivers d on d.id=t.driver_id and d.team_id=p_team_id where t.team_id=p_team_id and (p_parent_id is null or ec.event_id=p_parent_id) and (v_q='' or lower(coalesce(e.name,'')||' '||coalesce(ca.name,'')||' '||coalesce(s.name,'')||' '||coalesce(d.first_name,'')||' '||coalesce(d.last_name,'')) like '%'||v_q||'%') order by t.recorded_at desc limit v_limit) x;
  else raise exception 'Tipo lookup non supportato: %',p_kind;
  end case;
  return coalesce(v_result,'[]'::jsonb);
end;
$function$;

revoke all on function public.team_reference_lookup(uuid,text,text,integer,uuid) from public, anon;
grant execute on function public.team_reference_lookup(uuid,text,text,integer,uuid) to authenticated, service_role;
