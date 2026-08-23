# P0-E.3 / Final Security Hardening

Database-only repository alignment package. The migrations in this package are already applied on the live Supabase project.

## Included
- `20260823210323_p0e_reference_lookup_permissions.sql`
  - removes cross-module lookup leakage from view-only permissions;
  - preserves operational lookup access for Tasks edit, Telemetry edit and Attendance clock/manage/kiosk.
- `20260823210422_p0_function_search_path_hardening.sql`
  - fixes mutable `search_path` warnings on 8 technical functions.

## Live verification already completed
- `team_reference_lookup`: authenticated = EXECUTE, anon = denied.
- Engineer lookup for Events and Turns still works.
- Dry-run verified that Inventory lookup is denied when `inventory.view=false` and `tasks.edit=false`, even when `tasks.view=true`.
- `inventory_items_export_view` and `telemetry_files_export_view` are `security_invoker=true`.
- legacy `event_console.*` permission codes are absent; only `events.view` / `events.edit` remain.
- Supabase security advisor no longer reports mutable-search-path warnings.

## Remaining Supabase Auth setting
The advisor still reports **Leaked Password Protection Disabled**. This is an Auth project setting, not a database migration. Enable it in the Supabase dashboard when convenient.

## Installation
Copy the `supabase` directory into the repository and commit/push. **Do not execute the SQL manually**: it is already applied live.

No frontend files are changed, so no Vercel build is required for this package.
