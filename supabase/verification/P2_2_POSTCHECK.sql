select id,reconciliation_status,event_id,event_session_id,event_car_turn_id,reconciled_at,reconciliation_message
from public.connected_sessions order by started_at desc limit 20;

select t.id,t.connected_session_id,t.hours_source,t.minutes,t.laps,m.best_lap_ms,m.avg_lap_ms
from public.event_car_turns t left join public.event_car_turn_metrics m on m.turn_id=t.id
where t.connected_session_id is not null order by t.recorded_at desc limit 20;
