# Patch 3B — Restyling UI più marcato

Questa patch corregge la Patch 3, che risultava troppo leggera e aveva reso il font troppo generico.

## Obiettivo

Mantenere un'identità motorsport più evidente, ma migliorare la leggibilità generale senza tornare a un font racing applicato ovunque.

## Modifiche principali

- Nuova combinazione font:
  - `Inter` per testi, form, tabelle e contenuti lunghi.
  - `Rajdhani` per titoli, intestazioni e parti più racing.
- Header pagina trasformato in pannello scuro “race control”, con accento giallo laterale.
- Dashboard più compatta:
  - rimosso il contenitore bianco extra attorno alle statistiche;
  - statistiche con card più tecniche, barra colore laterale e numeri più leggibili;
  - sezione “Quadro operativo” spostata sopra i widget principali.
- `SectionCard` aggiornata:
  - bordo superiore giallo;
  - titolo più motorsport ma leggibile;
  - meno effetto “card bianca generica”.
- `data-row` aggiornata con indicatore verticale giallo, utile per dare più struttura alle liste.
- Badge stato e bottoni più netti e coerenti con il tema.

## File modificati

- `app/globals.css`
- `components/PageHeader.tsx`
- `components/SectionCard.tsx`
- `components/StatsGrid.tsx`
- `components/StatusBadge.tsx`
- `components/Button.tsx`
- `app/dashboard/page.tsx`

## Database

Nessuna query Supabase da lanciare.

## Verifiche

- `npm ci --ignore-scripts --no-audit --no-fund`: OK
- `npx tsc --noEmit --pretty false`: OK
- `npm run build`: compilazione webpack OK, poi timeout nella fase Next `Linting and checking validity of types...`, come già osservato nelle patch precedenti.

## Nota

Questa patch è pensata come correzione estetica della Patch 3. Non cambia logiche di database, turni, contatori, montaggi o telemetria.
