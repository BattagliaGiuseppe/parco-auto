# P2.7.5 – External Logger Display Mode

## Cosa introduce
- feed live effimero separato dalle sessioni storiche e dal ledger ore;
- `POST /api/connected/live-state` per logger/gateway in modalità `external_logger` o `hybrid`;
- `GET /api/connected/live-state` per il Driver Display;
- polling display ogni 2 secondi;
- stato `LOGGER LIVE`, `ATTESA LOGGER`, `LOGGER OFFLINE` (timeout 10 s);
- speed, lap, current/last/best lap, delta opzionale, RPM, gear e GPS accuracy disponibili nel payload live;
- nessuna creazione sessione/turno/ore dal feed live.

## Migration già applicata live
`20260828203122_p2_external_logger_live_state.sql`

## File patch
- `app/driver-display/page.tsx`
- `app/api/connected/live-state/route.ts`
- `supabase/migrations/20260828203122_p2_external_logger_live_state.sql`

## Nota
Il delta sub-secondo non deve dipendere dal polling cloud. Se il logger esterno dispone di un feed diretto verso lo smartphone (BLE/Wi-Fi), quello sarà il percorso Pro per il delta realmente live. Il campo `delta_seconds` del feed cloud è supportato come dato opzionale.
