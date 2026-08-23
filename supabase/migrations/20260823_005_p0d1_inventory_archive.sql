-- P0-D.1 Inventory fixes
-- Adds a non-destructive archive marker so the UI can remove an item without
-- deleting its inventory movement history (currently protected by ON DELETE CASCADE).

ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE INDEX IF NOT EXISTS inventory_items_team_active_name_idx
  ON public.inventory_items(team_id, name)
  WHERE archived_at IS NULL;
