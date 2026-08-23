drop function if exists public.get_inventory_stats(uuid);
drop index if exists public.inventory_items_search_trgm_idx;
drop index if exists public.inventory_items_team_active_low_name_idx;
alter table public.inventory_items drop column if exists search_text;
alter table public.inventory_items drop column if exists is_low_stock;
-- pg_trgm is intentionally left installed: dropping a shared extension can affect future indexes/functions.
