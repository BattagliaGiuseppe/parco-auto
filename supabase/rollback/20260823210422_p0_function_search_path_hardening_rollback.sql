-- Technical rollback only. Re-introduces the Supabase search_path warnings.
alter function public.set_updated_at() reset search_path;
alter function public.set_team_id_from_auth() reset search_path;
alter function public.attendance_validate_location(text) reset search_path;
alter function public.attendance_normalize_badge(text) reset search_path;
alter function public.attendance_normalize_pin(text) reset search_path;
alter function public.set_inventory_items_updated_at() reset search_path;
alter function public.set_telemetry_files_updated_at() reset search_path;
alter function public.current_team_id() reset search_path;
