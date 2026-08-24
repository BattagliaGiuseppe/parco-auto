# P2.4 – Track Entry/Exit & Automatic Turn Segmentation

## Cosa aggiunge
- `POST /api/connected/stream`
- ingest di finestre continue con massimo 2000 campioni / 12 ore
- segmentazione automatica `engine_only` / `track`
- geofence + velocità ingresso + soglia/hold uscita
- anti-overlap per evitare doppio conteggio tra finestre
- i campioni vengono elaborati ma non persistiti riga-per-riga
- ogni segmento riusa `ingest_connected_session`, quindi ledger, Eventi, grouping giornata e pilota predefinito restano le fonti autorevoli

## Payload campione
Ogni sample supporta: `ts`, `lat`, `lon`, `engine_on`, `speed_kph`, `rpm`.
Parametri opzionali finestra: `max_gap_seconds` (default 30), `track_entry_speed_kph` (45), `track_exit_speed_kph` (20), `track_exit_hold_seconds` (20).

## Database
Le migration sono già applicate live. Non eseguire SQL manualmente.
