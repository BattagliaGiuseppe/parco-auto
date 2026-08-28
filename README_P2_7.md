# P2.7 – Smartphone Driver Display

Nuova route standalone: `/driver-display`

Funzioni:
- accessibile senza login webapp; autenticazione tramite device key
- reference lap via `/api/connected/reference-lap`
- GPS browser ad alta precisione (`watchPosition`)
- delta locale tramite `LiveDeltaEngine`
- auto start/finish sul primo punto del reference
- velocità, lap corrente, last lap, progressione e qualità GPS
- fullscreen e Wake Lock quando supportati
- device key salvata solo nel localStorage del telefono e mai nell'URL

Nessuna migration DB richiesta.
