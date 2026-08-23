DROP FUNCTION IF EXISTS public.events_archive_page(uuid,integer,integer);
DROP FUNCTION IF EXISTS public.tasks_archive_page(uuid,integer,integer,text,text,text,text,text,text);
DROP FUNCTION IF EXISTS public.get_dashboard_operational_bundle(uuid);
DROP FUNCTION IF EXISTS public.drivers_archive_page(uuid,integer,integer,text,text);
DROP INDEX IF EXISTS public.drivers_search_trgm_idx;
DROP INDEX IF EXISTS public.tasks_team_created_idx;
DROP INDEX IF EXISTS public.events_team_date_desc_idx;
