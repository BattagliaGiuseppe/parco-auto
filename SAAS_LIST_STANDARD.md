# Standard liste SaaS

Per i moduli che possono crescere nel tempo:
1. 25–50 righe per pagina.
2. Ricerca e filtri lato server.
3. Statistiche aggregate lato DB.
4. Dettagli/storico caricati on-demand.
5. Niente `select(*)` nelle liste quando non necessario.
6. Query sempre vincolate a `team_id` e supportate da indici composti.
7. Nessun limite artificiale nei selector: usare lookup remoto.
8. Dashboard composta da aggregati e top-N, mai da dataset completi.
9. Telemetria: raw file in Storage + preview/downsampling bounded.
10. Payload per pagina deve restare sostanzialmente costante all'aumentare dei dati del cliente.
