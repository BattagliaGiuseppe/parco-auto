create or replace function public.driver_performance_page(
  p_team_id uuid,
  p_driver_id uuid,
  p_page integer default 1,
  p_page_size integer default 50
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_page integer := greatest(coalesce(p_page, 1), 1);
  v_size integer := least(greatest(coalesce(p_page_size, 50), 1), 100);
  v_offset integer;
  v_result jsonb;
begin
  if not public.has_team_permission(p_team_id, 'drivers.view') then
    raise exception 'Utente non autorizzato per il team %', p_team_id;
  end if;

  if not exists (
    select 1 from public.drivers d
    where d.id = p_driver_id and d.team_id = p_team_id
  ) then
    raise exception 'Pilota non trovato nel team';
  end if;

  v_offset := (v_page - 1) * v_size;

  with base as (
    select
      t.id,
      ec.event_id,
      e.name as event_name,
      c.name as car_name,
      coalesce(t.recorded_at, t.created_at) as recorded_at,
      coalesce(t.minutes, 0) as minutes,
      coalesce(t.laps, 0) as laps,
      m.best_lap_ms,
      m.avg_lap_ms
    from public.event_car_turns t
    join public.event_cars ec
      on ec.id = t.event_car_id
     and ec.team_id = p_team_id
    left join public.events e
      on e.id = ec.event_id
     and e.team_id = p_team_id
    left join public.cars c
      on c.id = ec.car_id
     and c.team_id = p_team_id
    left join public.event_car_turn_metrics m
      on m.turn_id = t.id
     and m.team_id = p_team_id
    where t.team_id = p_team_id
      and t.driver_id = p_driver_id
  ),
  paged as (
    select * from base
    order by recorded_at desc nulls last, id desc
    limit v_size offset v_offset
  )
  select jsonb_build_object(
    'driver', (
      select jsonb_build_object(
        'id', d.id,
        'first_name', d.first_name,
        'last_name', d.last_name
      )
      from public.drivers d
      where d.id = p_driver_id and d.team_id = p_team_id
    ),
    'summary', jsonb_build_object(
      'events', (select count(distinct event_id) from base where event_id is not null),
      'turns', (select count(*) from base),
      'minutes', coalesce((select sum(minutes) from base), 0),
      'laps', coalesce((select sum(laps) from base), 0),
      'best_lap_ms', (select min(best_lap_ms) from base where best_lap_ms is not null and best_lap_ms > 0),
      'avg_lap_ms', (select round(avg(avg_lap_ms))::integer from base where avg_lap_ms is not null and avg_lap_ms > 0)
    ),
    'rows', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'event_id', p.event_id,
          'event_name', coalesce(p.event_name, 'Evento senza nome'),
          'car_name', coalesce(p.car_name, 'Auto non indicata'),
          'recorded_at', p.recorded_at,
          'minutes', p.minutes,
          'laps', p.laps,
          'best_lap_ms', p.best_lap_ms,
          'avg_lap_ms', p.avg_lap_ms
        ) order by p.recorded_at desc nulls last, p.id desc
      ) from paged p
    ), '[]'::jsonb),
    'total', (select count(*) from base),
    'page', v_page,
    'page_size', v_size
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.driver_performance_page(uuid, uuid, integer, integer) from public, anon;
grant execute on function public.driver_performance_page(uuid, uuid, integer, integer) to authenticated, service_role;
