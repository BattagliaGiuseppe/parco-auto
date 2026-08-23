# P1.2 — Batch SaaS Scalability

## Stato database live
La migration `p1_batch_scalability` è già stata applicata e verificata sul progetto Supabase live.
NON eseguire manualmente i file SQL contenuti nel pacchetto.

La migration precedente `p1_saas_scalability_indexes` era già stata applicata live durante l'audit; il relativo SQL è incluso per mantenere il repository allineato e per i futuri ambienti/fresh setup.

## File applicativi modificati
- `app/drivers/page.tsx`
- `app/dashboard/page.tsx`
- `app/tasks/page.tsx`
- `app/calendar/page.tsx`

## Piloti
- 50 piloti per pagina.
- Ricerca e filtri lato database.
- Documenti caricati solo per i piloti della pagina visibile.
- Performance aggregate lato DB; ultimi 8 turni per pilota visibile.
- Statistiche globali lato DB.
- Indice trigram per ricerca anagrafica.

## Dashboard
- Riduzione da 10 query parallele a 3 richieste complessive.
- Un solo bundle RPC contiene dati operativi già aggregati e limitati.
- Auto visualizzate max 50; conteggi globali separati.
- Alert componenti max 8.
- Prossimi eventi max 5.
- Manutenzioni aperte max 6.
- Documenti piloti in scadenza max 6.
- Articoli sotto scorta max 8.
- Task aperti max 8.
- Presenze del giorno max 50.

## Tasks
- 50 task per pagina.
- Ricerca, stato, area, priorità, assegnatario e auto filtrati lato DB.
- Statistiche globali lato DB.
- Debounce ricerca 300 ms.
- Le opzioni del form vengono caricate una sola volta e non a ogni cambio filtro/pagina.

### Residuo Tasks
I selettori Evento e Magazzino mantengono temporaneamente i limiti esistenti (80 eventi / 250 articoli). La prossima microfase li trasformerà in lookup remoto/autocomplete, eliminando i limiti artificiali senza rendere questa patch più invasiva.

## Calendario
- 30 eventi per pagina.
- Conteggio totale eventi e mezzi collegati lato DB.
- Prossimo evento calcolato correttamente dal DB.
- Lo storico non viene più scaricato integralmente.

## Verifiche eseguite
- 4 file TSX: parser TypeScript OK.
- RPC Owner live: OK.
- `authenticated`: EXECUTE OK.
- `anon`: EXECUTE negato.
- Ricerca Piloti con zero risultati: OK.
- Tasks all/open: 2/1 sul dataset live, coerente.
- Eventi: totale 3, coerente.

Il build locale Next.js completo non è stato eseguito perché `npm ci` ha superato il limite operativo dell'ambiente. Vercel deve quindi fare la verifica completa del progetto.
