# P2.9.5.2.1 – Multi-Car Routing Foundation

Foundation database layer for one Windows AiM Bridge routing multiple loggers/cars safely.

## Adds

- `connected_bridges`: one bridge installation per team/PC.
- `connected_bridge_keys`: hashed Bridge Key credentials (server-only through RLS, same pattern as device keys).
- `connected_bridge_devices`: explicit allow-list of logger devices a bridge may use.
- `connected_device_car_assignments`: date-aware logger → car history.
- `connected_vehicle_aliases`: date-aware Race Studio/AiM Vehicle alias → car mapping.
- `connected_devices.routing_mode`:
  - `fixed_car` (default/backward compatible)
  - `assignment_history` (moveable logger)

## Safety

- No automatic import/routing is enabled by this migration.
- Cross-team references are rejected by triggers.
- Overlapping logger→car assignments are rejected.
- Overlapping active Vehicle aliases are rejected.
- Bridge key hashes have RLS enabled and intentionally expose no authenticated client policy.
- Existing `connected_devices.car_id` remains untouched for backward compatibility.

## Next

P2.9.5.2.2 will add the server resolver/API that receives XRK identity metadata and returns one of:

- `resolved`
- `needs_mapping`
- `conflict`
- `blocked`

without creating a session until routing is certain.
