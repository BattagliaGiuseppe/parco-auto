-- Rollback P0-D.1
DROP INDEX IF EXISTS public.inventory_items_team_active_name_idx;
ALTER TABLE public.inventory_items DROP COLUMN IF EXISTS archived_at;
