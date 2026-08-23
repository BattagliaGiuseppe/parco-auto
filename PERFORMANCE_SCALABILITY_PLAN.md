# Performance & SaaS scalability plan

## Misure live rilevate (23/08/2026)

### Magazzino
- `inventory_items`: ~538 righe
- `inventory_movements`: ~540 righe
- query DB archivio completo: circa 19 ms medi
- conclusione: il collo di bottiglia attuale è soprattutto frontend (caricamento/render di tutti i record), non PostgreSQL.

### Telemetria
- 2 file telemetria
- 18.200 campioni originali dichiarati
- 7.347 campioni salvati nel DB
- `telemetry_samples`: ~8 MB già con soli 2 file
- lettura campioni: batch da 1.000, ~73 ms medi lato DB per batch nelle statistiche osservate
- conclusione: il modello attuale di analisi “scarica tutti i campioni” non scala.

## Pattern SaaS da adottare
1. Liste sempre paginate lato server.
2. Mai `select("*")` nelle viste elenco; selezionare solo i campi necessari.
3. Ricerca e filtri lato database con indici appropriati.
4. Statistiche aggregate lato DB, non calcolate caricando tutto nel browser.
5. Immagini/documenti lazy/on-demand.
6. Dati pesanti caricati solo quando l'utente apre il dettaglio.
7. Per telemetria: downsampling server-side per grafici e full-resolution solo quando realmente necessario.
8. Raw telemetry file in Storage come source of truth; PostgreSQL conserva metadata, lap summary, channel summary e campioni ottimizzati per analisi.
9. Monitoraggio continuativo con `pg_stat_statements`, dimensione tabelle e indici.

## Prossimo intervento: Telemetry scalability
- paginare `telemetry_files`;
- non caricare all'apertura tutti `channels/laps/insights/events/sessions/turns` del team;
- caricare relazioni solo per file visibili/dettaglio;
- RPC server-side per campioni downsampled (target ~1.500–3.000 punti per grafico);
- caricamento full-resolution limitato al giro/canale richiesto;
- valutare una soglia massima di campioni persistiti per file e mantenere sempre il raw file originale in Storage.
