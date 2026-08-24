# P2.1 – Mezzi Connessi / Foundation

## Database
Le migration `20260824133533` e `20260824133723` sono già applicate sul Supabase live. **Non eseguire SQL manualmente.** Copiare le cartelle Supabase serve solo ad allineare GitHub.

## Frontend
File nuovi/modificati:
- `app/connected-devices/page.tsx` (nuovo)
- `app/api/connected/ingest/route.ts` (nuovo)
- `components/Sidebar.tsx` (modificato)

## Funzioni disponibili
- registro dispositivi associati ai mezzi;
- chiave ingest revocabile/ruotabile, salvata solo come hash;
- endpoint platform `/api/connected/ingest`;
- sessioni automatiche + giri + riepilogo;
- idempotenza via `external_batch_id`;
- aggiornamento automatico ore mezzo e componenti montati;
- ledger audit delle ore;
- raw high-frequency volutamente fuori PostgreSQL.

## Smoke test backend già eseguito
Sessione simulata da 30 minuti:
- primo ingest `duplicate=false`;
- delta mezzo `+0.5 h`;
- 3 giri salvati;
- 1 ledger row;
- secondo ingest stesso batch `duplicate=true`;
- nessun doppio incremento;
- chiave plaintext non presente nel DB.
Tutto eseguito in transazione con rollback, quindi nessun dato test residuo.
