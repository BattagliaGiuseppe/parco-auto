SELECT
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='inventory_items' AND column_name='archived_at'
  ) AS archived_at_exists,
  to_regclass('public.inventory_items_team_active_name_idx') IS NOT NULL AS active_index_exists;
