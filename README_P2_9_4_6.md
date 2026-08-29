# P2.9.4.6 – AiM Official Max Speed Preservation

## Scopo
Corregge la perdita di `max_speed` nell'Official Ingest AiM verificata sul primo XRK reale.

## Causa
Il bridge invia il valore riepilogativo già normalizzato nel campo canonico `max_speed`, mentre `aim_race_studio_v1.normalizeSpeedKph()` riconosceva solo alias live/telemetrici come `speed_kph`, `GPS Speed`, `vehicle speed`, ecc.

## Correzione
`normalizeSpeedKph()` ora accetta anche:
- `max_speed`
- `max speed`
- `maximum speed`
- `vmax`
- `v max`

Versione adapter: `1.0.1`.

## Impatto
Nessuna migration. Nessuna modifica al database. Nessuna modifica a authority, idempotenza, ore, giri o riconciliazione.
