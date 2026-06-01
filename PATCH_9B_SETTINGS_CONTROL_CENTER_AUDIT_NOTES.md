# Patch 9B — Settings Control Center Audit Fix

Questa patch non aggiunge nuove funzioni operative casuali: serve a rendere il modulo **Impostazioni / Control Center** verificabile e più affidabile.

## File principali

- `app/settings/page.tsx`
- `db/settings_control_center_audit_patch.sql`

## Cosa cambia

### 1. Stato Control Center sempre visibile

Nel modulo Impostazioni ora compare una sezione **Stato Control Center** con:

- disponibilità RPC di salvataggio transazionale;
- verifica permesso scrittura owner/admin;
- ultimo `updated_at` letto dal database;
- ultima verifica/rilettura.

### 2. Tab dedicato “Stato salvataggio”

È stata aggiunta una nuova area/tab per distinguere chiaramente:

- dati caricati nella UI;
- dati presenti sul database;
- stato RPC;
- differenza tra colore richiesto e colore realmente applicato dal tema.

### 3. Verifica post-salvataggio

Dopo il salvataggio con `save_team_settings_bundle`, la pagina rilegge i dati principali e confronta:

- impostazioni generali;
- numero componenti standard;
- numero checklist;
- numero campi setup;
- numero widget dashboard.

Se qualcosa non torna, la pagina mostra un errore mirato invece di un generico “salvataggio fallito”.

### 4. Preview locale vs tema reale

Nel tab Branding ora è visibile il confronto tra:

- colore richiesto dall’utente;
- colore effettivamente applicato alla webapp.

Questo chiarisce il caso in cui un colore troppo chiaro viene scartato dal tema Dark Race Control per proteggere la leggibilità.

## Query Supabase da eseguire

Dopo aver caricato i file, eseguire solo:

```sql
db/settings_control_center_audit_patch.sql
```

Questa patch non sostituisce la 9A: la completa.

## Verifiche locali

- `npm ci --ignore-scripts --no-audit --no-fund` → OK
- `npx tsc --noEmit --pretty false` → OK
- `npm run build` → CSS/webpack OK, poi timeout nella fase interna Next come già visto nelle patch precedenti
