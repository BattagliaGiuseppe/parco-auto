-- Already applied live during the SaaS scalability audit.
-- Kept in the repository so a fresh environment receives the same baseline indexes.
CREATE INDEX IF NOT EXISTS events_team_date_desc_idx
  ON public.events (team_id, date DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS event_cars_team_event_idx
  ON public.event_cars (team_id, event_id);
CREATE INDEX IF NOT EXISTS event_car_turns_team_driver_recorded_idx
  ON public.event_car_turns (team_id, driver_id, recorded_at DESC)
  WHERE driver_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS event_car_turns_team_event_car_recorded_idx
  ON public.event_car_turns (team_id, event_car_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS components_team_car_idx
  ON public.components (team_id, car_id);
CREATE INDEX IF NOT EXISTS maintenances_team_status_created_idx
  ON public.maintenances (team_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS maintenances_team_date_desc_idx
  ON public.maintenances (team_id, date DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS tasks_team_created_idx
  ON public.tasks (team_id, created_at DESC);
CREATE INDEX IF NOT EXISTS driver_session_performance_team_driver_created_idx
  ON public.driver_session_performance (team_id, driver_id, created_at DESC);
