# Patch 9C — Control Center Core completo

Questa macro-patch consolida il modulo **Impostazioni** come fonte centrale di configurazione della webapp.

## Obiettivo

Ridurre la distanza tra:

- impostazioni salvate su Supabase;
- preview nel Control Center;
- webapp realmente applicata.

La patch non è una correzione isolata dei colori: introduce un primo livello comune per moduli, terminologia, widget dashboard, branding e renderer setup/checklist.

## File principali modificati

- `lib/controlCenter.ts` nuovo registry centrale per:
  - labels/terminologia;
  - moduli attivi;
  - widget dashboard;
  - helper setup/checklist;
  - visibilità widget per ruolo;
  - dimensioni widget.
- `lib/brandingTheme.ts`
  - labels estese;
  - colori primary/secondary/accent applicati come token reali;
  - nuove variabili RGB `--brand-*-rgb`;
  - preview/app più coerenti.
- `components/Sidebar.tsx`
  - sidebar basata sul registry moduli;
  - labels globali per moduli;
  - moduli attivi normalizzati;
  - rispetto di dipendenze e permessi.
- `app/dashboard/page.tsx`
  - dashboard usa label globali del tema;
  - usa `role_scope` e `size` dei widget;
  - filtra widget in base ai moduli attivi;
  - aggiunto supporto widget `attendance_today`.
- `app/settings/page.tsx`
  - Control Center usa registry centrale;
  - moduli gestiti con nomi, descrizioni e dipendenze;
  - widget dashboard da registry;
  - checklist con input type estesi e opzioni select;
  - preview branding più vicina al tema realmente applicato.
- `app/calendar/[eventId]/car/[eventCarId]/page.tsx`
  - setup dinamico ora renderizza anche `select`, `number`, `date`, `checkbox`, `textarea`;
  - checklist ora renderizza `status`, `text`, `number`, `select`, `checkbox`, `date`.
- `app/globals.css`
  - accenti gialli hardcoded sostituiti con token brand dinamici dove possibile.
- `db/control_center_core_patch.sql`
  - estende labels e modules esistenti;
  - aggiunge `options` a `team_checklist_items`;
  - aggiorna `save_team_settings_bundle` per salvare opzioni checklist.

## Query Supabase da eseguire

Eseguire solo:

```sql
 db/control_center_core_patch.sql
```

Non rilanciare le patch precedenti.

## Test consigliati

1. Aprire Impostazioni → Branding e modificare accent/primary/secondary.
2. Salvare e verificare che sidebar, header, bottoni, bordi attivi e dashboard cambino in modo coerente.
3. Cambiare terminologia, per esempio `Auto` → `Mezzi`, e verificare sidebar/dashboard.
4. Disattivare un modulo non critico e verificare sidebar/dashboard.
5. Configurare widget dashboard con dimensione `Small / Medium / Large / Full width` e ruolo.
6. Creare campo setup di tipo `select` e verificare nella console mezzo evento.
7. Creare voce checklist di tipo `select` e verificare nella console mezzo evento.

## Verifiche tecniche

Eseguite:

```bash
npm ci --ignore-scripts --no-audit --no-fund
npx tsc --noEmit --pretty false
npm run build
```

`npm run build` compila CSS/webpack e supera il typecheck, poi nel container va in timeout su `Collecting page data`, come già accaduto nelle patch precedenti.
