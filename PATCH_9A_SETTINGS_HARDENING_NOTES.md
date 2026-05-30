# Patch 9A — Settings hardening & audit fix

Questa patch rinforza il modulo Impostazioni dopo l'aggiunta di Attività e Presenze.

## Supabase

Eseguire in Supabase SQL Editor solo:

```sql
db/settings_hardening_patch.sql
```

Non rilanciare le patch precedenti.

## Cosa cambia

- RLS delle tabelle configurative allineata al comportamento della UI:
  - tutti i membri attivi del team possono leggere le impostazioni necessarie;
  - solo owner/admin possono modificare impostazioni, componenti standard, checklist, campi setup e widget dashboard.
- Nuova RPC transazionale `save_team_settings_bundle`:
  - salva impostazioni generali;
  - componenti standard;
  - checklist e voci checklist;
  - campi setup;
  - widget dashboard;
  - se una parte fallisce, la transazione viene annullata.
- Il frontend usa la nuova RPC invece di eseguire delete/insert separati.
- Il caricamento impostazioni ora blocca il salvataggio se una sezione critica fallisce, evitando di sovrascrivere configurazioni con liste vuote.
- I widget dashboard ora si scelgono da una select di widget supportati, non da codice libero.
- I campi setup di tipo `select` ora permettono di configurare le opzioni.
- Upload logo con validazione base di formato immagine e dimensione massima 2 MB.
- Rimossa la nota tecnica interna su `team_access_patch.sql` dalla pagina Team & Accessi.

## File principali

- `app/settings/page.tsx`
- `app/settings/team/page.tsx`
- `db/settings_hardening_patch.sql`

## Verifiche

- `npm ci --ignore-scripts --no-audit --no-fund` OK
- `npx tsc --noEmit --pretty false` OK
- `npm run build` compila CSS/webpack; nel container va in timeout durante la fase interna Next, come già osservato nelle patch precedenti.
