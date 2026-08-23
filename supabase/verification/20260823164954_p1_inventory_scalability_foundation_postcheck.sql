select
  count(*) filter (where archived_at is null) as active_items,
  count(*) filter (where archived_at is null and is_low_stock) as low_stock,
  count(*) filter (where archived_at is null and search_text is null) as null_search_text
from public.inventory_items;

select indexname
from pg_indexes
where schemaname = 'public'
  and tablename = 'inventory_items'
  and indexname in (
    'inventory_items_team_active_low_name_idx',
    'inventory_items_search_trgm_idx'
  )
order by indexname;

select
  has_function_privilege('authenticated','public.get_inventory_stats(uuid)','EXECUTE') as authenticated_execute,
  has_function_privilege('anon','public.get_inventory_stats(uuid)','EXECUTE') as anon_execute;
