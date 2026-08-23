-- P0-D: eliminate implicit workspace assignment from write paths.
-- Preconditions verified before migration:
--   * all 28 affected team_id columns are UUID NOT NULL + FK to public.teams
--   * application/database write paths provide team_id explicitly
--   * public.current_team_id() is only used by public.set_team_id_from_auth()
-- Strategy: remove the BEFORE INSERT fallback triggers, keep helper functions dormant for rollback.

DO $p0d$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.relname AS table_name, t.tgname AS trigger_name
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_proc p ON p.oid = t.tgfoid
    WHERE n.nspname = 'public'
      AND p.proname = 'set_team_id_from_auth'
      AND NOT t.tgisinternal
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', r.trigger_name, r.table_name);
  END LOOP;
END
$p0d$;

-- The selected workspace must now come from the app request, never from "first membership".
REVOKE EXECUTE ON FUNCTION public.current_team_id() FROM PUBLIC, anon, authenticated;
