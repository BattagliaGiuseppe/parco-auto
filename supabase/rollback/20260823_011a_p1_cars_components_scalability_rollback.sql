DROP FUNCTION IF EXISTS public.components_archive_page(uuid,integer,integer,text,text,text,text);
DROP FUNCTION IF EXISTS public.cars_archive_page(uuid,integer,integer,text);

DROP INDEX IF EXISTS public.attendance_records_team_checkin_desc_idx;
DROP INDEX IF EXISTS public.car_components_team_created_desc_idx;
DROP INDEX IF EXISTS public.maintenances_team_date_desc_idx;
DROP INDEX IF EXISTS public.components_team_identifier_trgm_idx;
DROP INDEX IF EXISTS public.cars_team_name_trgm_idx;

-- pg_trgm is intentionally kept: it can be shared by other search indexes/functions.
