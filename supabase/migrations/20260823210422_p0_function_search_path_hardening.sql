-- P0 final hardening: fixed search_path on technical functions.
-- Applied live already on Supabase.
alter function public.set_updated_at() set search_path = public, pg_temp;
alter function public.set_team_id_from_auth() set search_path = public, auth, pg_temp;
alter function public.attendance_validate_location(text) set search_path = public, pg_temp;
alter function public.attendance_normalize_badge(text) set search_path = public, pg_temp;
alter function public.attendance_normalize_pin(text) set search_path = public, pg_temp;
alter function public.set_inventory_items_updated_at() set search_path = public, pg_temp;
alter function public.set_telemetry_files_updated_at() set search_path = public, pg_temp;
alter function public.current_team_id() set search_path = public, auth, pg_temp;
