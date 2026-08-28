# P2.6 – Live Timing Engine / Delta

- Nuovo motore locale `lib/connected/live-delta.ts` per calcolo delta senza cloud.
- Nuovo endpoint device `/api/connected/reference-lap` (GET/POST).
- Reference lap compresso: max 400 punti GPS, non telemetria raw.
- Il backend conserva automaticamente il riferimento più veloce per pilota/circuito (fallback auto/circuito).
- Migration Supabase già applicata live: `20260828124019_p2_live_delta_reference_laps`.
