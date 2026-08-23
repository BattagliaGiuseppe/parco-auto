# P1.3 – Operations scalability batch

## Status
The four database migrations in this package have already been applied to the live Supabase project and verified. **Do not run them again manually.** They are included to keep the repository aligned with production.

## Frontend files changed
- `app/cars/page.tsx`
- `app/components/page.tsx`
- `app/maintenances/page.tsx`
- `app/mounts/page.tsx`
- `app/attendance/page.tsx`
- `app/tasks/page.tsx`
- `app/telemetry/page.tsx`

## What changes
- Cars: server-side archive/search, 30 records/page, DB statistics.
- Components: server-side search/filter/status, 50 records/page, DB statistics.
- Maintenances: server-side search/filter, 50 records/page, DB statistics.
- Mounts: server-side history/filter, 50 records/page, DB statistics.
- Attendance: bounded 180-day history, 50 records/page; currently-active/latest-per-person records remain available for operational UI.
- Tasks: Event and Inventory selectors use remote lookup instead of fixed first 80/250 records.
- Telemetry: Event/Turn selectors use remote lookup; sessions load only for selected event instead of preloading all historical sessions/event-cars/turns.

## Database migrations (already live)
- `20260823_011a_p1_cars_components_scalability.sql`
- `20260823_011b_p1_maint_mounts_scalability.sql`
- `20260823_011c_p1_attendance_scalability.sql`
- `20260823_011d_p1_reference_lookup.sql`

Each migration has a matching rollback file in `supabase/rollback/`.

## Verification already performed
Using the real Owner identity in a transaction/rollback:
- Cars payload: 3
- Components payload: 8
- Maintenances payload: 6
- Mounts payload: 11
- Attendance history payload: 6
- Event lookup: 3
- Turn lookup: 6
- Inventory lookup (`test`): 2

RPC ACLs: available to `authenticated`, unavailable to `anon`.

## Deployment
Overlay this package on the project root, commit/push, then let Vercel build. Do not execute SQL manually.
