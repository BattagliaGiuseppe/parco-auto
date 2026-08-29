# P2.9.1 — Logger Adapter Contract Foundation

Introduce uno strato adapter davanti ai canali Connected Vehicles già validati.

## Scopo
Un logger/vendor specifico non deve conoscere la struttura interna di sessioni, ore, riconciliazione o Driver Display. Deve solo essere tradotto nel formato canonico.

## Adapter iniziale
`canonical_v1` — compatibilità 1:1 con i payload P2.7/P2.8 esistenti.

## Selezione adapter
Header opzionale:

`x-logger-adapter: canonical_v1`

Se assente viene usato `canonical_v1`, quindi i client esistenti non cambiano comportamento.

## Canali
- `live_state` → display, nessuna ora/sessione.
- `official_session` → sessione conclusa ufficiale, soggetta alle regole P2.8.

## Discovery
`GET /api/connected/adapters`

Restituisce adapter installati, versioni e canali supportati.

## Regola architetturale
Gli adapter traducono soltanto. Non possono cambiare `session_authority`, applicare ore o aggirare i controlli P2.8.
