# Patch 7B — Settings / Team Access polish

Intervento mirato sulle ultime incoerenze grafiche viste negli screenshot di Impostazioni e Team & Accessi.

## File modificati

- `app/settings/page.tsx`
- `app/settings/team/page.tsx`

## Cosa cambia

- Tab di Impostazioni non più chiari/bianchi in stato inattivo.
- Snapshot Team in Team & Accessi convertito al tema Dark Race Control.
- Card membri, override e permessi effettivi più coerenti con il resto della webapp.
- Select, pulsanti secondari e messaggi informativi più leggibili su sfondo scuro.
- Matrice permessi con righe, bordi e testi coerenti con il tema dark.
- Nota prodotto e box di supporto convertiti a card scure.

## Supabase

Nessuna query da eseguire. Patch solo frontend/UI.

## Verifiche

- `npm ci --ignore-scripts --no-audit --no-fund` OK
- `npx tsc --noEmit --pretty false` OK
- `npm run build` compila CSS/webpack e arriva alla fase interna Next di controllo dati/tipi; nel container va in timeout come nelle patch precedenti.
