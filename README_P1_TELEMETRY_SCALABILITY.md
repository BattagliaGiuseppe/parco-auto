# P1 Telemetry Scalability

## Stato live
La migration `20260823172327_p1_telemetry_scalability.sql` è già stata applicata al progetto Supabase live.

**Non eseguire manualmente SQL.** Il file migration è incluso solo per mantenere il repository allineato allo stato del database.

## File applicativo modificato
- `app/telemetry/page.tsx`

## Cosa cambia

### Archivio telemetria
- 25 file per pagina invece di caricare l'intero archivio.
- Ricerca eseguita lato database anche per file, note, software, formato, logger, tracciato, tag, mezzo, pilota, evento e sessione.
- Statistiche globali calcolate lato database, non sulla pagina corrente.
- Canali, giri e insight vengono caricati solo per i file presenti nella pagina corrente.
- I dati di riferimento per form/eventi vengono caricati separatamente dall'archivio e non vengono ricaricati ad ogni ricerca/pagina.

### Analisi
- Eliminato il ciclo di richieste da 1.000 righe su `telemetry_samples`.
- Un solo RPC restituisce campioni, canali e giri del file da analizzare.
- I candidati di confronto vengono caricati con una query leggera e limitata, invece di dipendere dall'intero archivio in memoria.

### Nuovi import CSV
- Il file originale resta in Storage ed è la source of truth.
- Il database conserva un preview grafico fino a 3.000 punti per file (prima 5.000).
- I 3.000 punti sono distribuiti uniformemente su tutta la sessione, includendo in pratica tutta la finestra temporale/distanza senza concentrare i punti solo all'inizio.
- `samples_count` continua a rappresentare il numero di righe originali lette; `sampled_points_count` rappresenta i punti preview persistiti.

## Metriche verificate sul live
- Archivio paginato: ~7.5 ms lato PostgreSQL con i dati attuali.
- Bundle analisi del file da 3.507 punti: ~96 ms lato PostgreSQL.
- Prima l'analisi usava più round-trip PostgREST da 1.000 righe; ogni batch risultava mediamente nell'ordine di ~73 ms nei dati di `pg_stat_statements`.

## Test dopo deploy
1. Aprire Telemetria: archivio e statistiche devono comparire normalmente.
2. Cercare un file per nome/tracciato/pilota/evento.
3. Aprire `Analizza` su entrambi i file esistenti: grafici, canali e giri devono essere presenti.
4. Confrontare un file con l'altro.
5. Importare un piccolo CSV solo se si vuole verificare il nuovo limite preview; non è necessario per validare la patch base.

## Rollback
Il rollback è incluso in:
`supabase/rollback/20260823172327_p1_telemetry_scalability_rollback.sql`

Non eseguirlo salvo regressione confermata.
