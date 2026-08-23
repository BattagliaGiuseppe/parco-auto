select
  has_function_privilege('authenticated','public.team_reference_lookup(uuid,text,text,integer,uuid)','execute') as lookup_authenticated,
  has_function_privilege('anon','public.team_reference_lookup(uuid,text,text,integer,uuid)','execute') as lookup_anon;

select c.relname, c.reloptions
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in ('inventory_items_export_view','telemetry_files_export_view');

select p.proname, p.proconfig
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in (
  'set_updated_at','set_team_id_from_auth','attendance_validate_location',
  'attendance_normalize_badge','attendance_normalize_pin',
  'set_inventory_items_updated_at','set_telemetry_files_updated_at','current_team_id'
)
order by p.proname;
