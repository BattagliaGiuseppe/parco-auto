create extension if not exists pg_trgm with schema extensions;

alter table public.inventory_items
  add column if not exists is_low_stock boolean
  generated always as (
    greatest(coalesce(quantity, 0) - coalesce(reserved_quantity, 0), 0) <= coalesce(minimum_quantity, 0)
  ) stored;

alter table public.inventory_items
  add column if not exists search_text text
  generated always as (
    lower(
      coalesce(name, '') || ' ' ||
      coalesce(sku, '') || ' ' ||
      coalesce(category, '') || ' ' ||
      coalesce(brand, '') || ' ' ||
      coalesce(supplier_name, '') || ' ' ||
      coalesce(supplier_code, '') || ' ' ||
      coalesce(manufacturer_code, '') || ' ' ||
      coalesce(barcode, '') || ' ' ||
      coalesce(location, '') || ' ' ||
      coalesce(notes, '')
    )
  ) stored;

create index if not exists inventory_items_team_active_low_name_idx
  on public.inventory_items (team_id, is_low_stock, name, id)
  where archived_at is null;

create index if not exists inventory_items_search_trgm_idx
  on public.inventory_items using gin (search_text extensions.gin_trgm_ops)
  where archived_at is null;

create or replace function public.get_inventory_stats(p_team_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not public.has_team_permission(p_team_id, 'inventory.view') then
    raise exception 'Permesso inventory.view richiesto';
  end if;

  select jsonb_build_object(
    'total_items', count(*),
    'low_stock', count(*) filter (where is_low_stock),
    'reserved_items', count(*) filter (where coalesce(reserved_quantity, 0) > 0),
    'categories', count(distinct category) filter (where category is not null and btrim(category) <> '')
  )
  into v_result
  from public.inventory_items
  where team_id = p_team_id
    and archived_at is null;

  return coalesce(v_result, '{"total_items":0,"low_stock":0,"reserved_items":0,"categories":0}'::jsonb);
end;
$$;

revoke all on function public.get_inventory_stats(uuid) from public, anon;
grant execute on function public.get_inventory_stats(uuid) to authenticated, service_role;
