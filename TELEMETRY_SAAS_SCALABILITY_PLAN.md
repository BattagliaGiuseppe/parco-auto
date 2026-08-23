# Telemetry SaaS Scalability Plan

## Principio architetturale
La telemetria non deve essere trattata come una normale tabella CRUD. Un SaaS motorsport può generare milioni o miliardi di campioni; PostgreSQL deve conservare soprattutto metadata, riepiloghi e dataset ottimizzati per la UI, mentre i dati raw devono restare in object storage.

## Livello 1 — implementato con questa patch
- Archivio paginato server-side.
- Ricerca server-side.
- Statistiche aggregate server-side.
- Dettagli canali/giri/insight caricati solo per la pagina visibile.
- Analisi con singolo bundle RPC.
- Preview persistito bounded: massimo 3.000 punti per nuovo file.
- File originale conservato in Storage.

## Livello 2 — prossimo passo quando la telemetria diventa più usata
- Filtri espliciti per mezzo, pilota, evento, circuito, data e logger.
- Cursor/keyset pagination per archivi molto grandi (evitare OFFSET profondo).
- Cache delle statistiche per team quando i file diventano decine di migliaia.
- Elaborazione import in worker/Edge Function invece che nel browser per file pesanti.
- Progress import e stato job (`queued`, `processing`, `parsed`, `failed`).

## Livello 3 — necessario per logger connessi / telemetria continua
Schema consigliato:

`logger/raw stream -> ingest service -> object storage -> processing job -> session summary + laps + preview series -> app`

PostgreSQL/Supabase:
- `telemetry_files` / session metadata;
- `telemetry_laps`;
- `telemetry_channels` metadata/statistiche;
- riepiloghi sessione e best lap;
- preview/downsample per rendering;
- riferimenti ai blob raw.

Object Storage:
- CSV/XRK originale;
- successivamente formato ottimizzato (es. Parquet/Arrow) per elaborazioni massive;
- eventuali segmenti raw provenienti dai logger connessi.

## Livello 4 — analisi avanzata
Per confronti ingegneristici ad alta risoluzione:
- richiesta on-demand di un solo giro e dei soli canali necessari;
- downsampling dipendente dalla larghezza del grafico;
- caching del risultato per `(file, lap, channels, resolution)`;
- metriche/precalcoli per braking points, min speed, throttle application, delta time, temperature e CAN.

## Regola SaaS generale
Nessuna pagina principale deve richiedere "tutti i record del team" per funzionare. Le liste devono utilizzare paginazione server-side, colonne selettive, aggregazioni server-side e caricamento dettagli on-demand.
