# Patch audit ramo generale

## Cosa contiene questa patch

### 1. Montaggi componenti centralizzati
- Le pagine che montano/smontano componenti non scrivono più direttamente su `car_components` e `components.car_id`.
- I flussi passano da RPC Supabase:
  - `mount_component_on_car`
  - `unmount_component_from_car`
- Questo evita stati incoerenti tra storico montaggi e componente attualmente montato.

File principali modificati:
- `app/mounts/page.tsx`
- `app/components/[id]/page.tsx`
- `app/components/page.tsx`
- `db/component_mounting_consistency_patch.sql`

### 2. Chiarezza sulle ore componente
La UI ora distingue meglio:
- **Ore da ultima revisione**: campo `hours`, usato per soglie warning/revisione.
- **Ore vita accumulate**: campo `life_hours`, storico totale che non va interpretato come vita prevista.

File principali modificati:
- `app/components/page.tsx`
- `app/components/[id]/page.tsx`
- `app/cars/page.tsx`

### 3. UI più leggibile
- Rimosso l'uso del font racing su intere pagine, tabelle e form.
- Mantenuto uno stile più motorsport solo sui titoli pagina tramite `.racing-heading`.
- Eliminata la dipendenza runtime da Google Fonts per evitare problemi di build offline.

File principali modificati:
- `components/PageHeader.tsx`
- `app/globals.css`
- pagine che prima applicavano `Audiowide` all'intero layout

### 4. Lockfile npm riallineato
- `package-lock.json` è stato rigenerato perché `npm ci` falliva con lockfile non sincronizzato.

## Da applicare in Supabase
Prima di usare la nuova UI dei montaggi, eseguire nel SQL Editor:

```text
/db/component_mounting_consistency_patch.sql
```

## Verifiche fatte
- `npm ci --ignore-scripts --no-audit --no-fund`: OK dopo rigenerazione lockfile.
- `npx tsc --noEmit --pretty false`: OK.
- `next build`: compilazione webpack OK, ma nel container si ferma/timeout durante la fase Next "Checking validity of types". Il typecheck diretto con `tsc` passa correttamente.

## Nota Next.js
Durante `npm ci`, npm segnala che `next@15.5.7` ha una vulnerabilità nota e suggerisce l'upgrade a una versione patchata. Non è stato aggiornato automaticamente in questa patch per non cambiare major/minor senza verifica del deploy.
