# P2.9.5.2.2 - Server Resolver

Introduces the fail-closed server-side multi-car routing resolver.

## New endpoint

`POST /api/connected/bridge-resolve`

Authentication: `x-bridge-key`.

The endpoint does **not** create sessions, turns or hours. It only returns one of:

- `resolved`
- `needs_mapping`
- `conflict`
- `blocked`

`safe_to_ingest` is true only for `resolved`.

## Persistent queue

`connected_routing_observations` stores each authenticated XRK routing decision by `(bridge_id, file_sha256)`. This will feed the P2.9.5.2.3 “Da associare” UI.

## Safety rules

- hardware serial / external id must identify at most one allow-listed logger;
- historical assignment is used when `routing_mode=assignment_history`;
- a declared Race Studio `Vehicle` must be mapped once before import;
- hardware and Vehicle must resolve to the same car;
- alias-only routing is allowed only if exactly one authorized logger is compatible with that car;
- unresolved or conflicting inputs never proceed to Official Ingest.

## Live migration

The migration was applied to Supabase production as:

`20260917103136_p2_9_5_2_2_server_resolver`

Do not execute the SQL manually.
