# P2.3.1 – Circuit Geofence Management

Patch incrementale per configurare le geofence dei circuiti usate dal riconoscimento GPS dei Mezzi connessi.

## File modificati
- `app/connected-devices/page.tsx`
- `supabase/migrations/20260824171830_p2_circuit_geofence_management.sql`

## Comportamento
- Espone nella pagina Mezzi connessi la sezione `Geofence circuiti`.
- Permette di impostare latitudine, longitudine e raggio (50–10.000 m).
- Permette di rimuovere una geofence svuotando i tre campi.
- La modifica richiede il permesso `events.edit`.
- Il riconoscimento GPS continua a usare `detect_connected_circuit(...)`.

## Database
La migration è già stata applicata al progetto Supabase live. Non eseguire SQL manualmente.
