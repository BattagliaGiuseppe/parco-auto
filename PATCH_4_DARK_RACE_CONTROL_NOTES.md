# Patch 4 — UI definitiva Dark Race Control

Questa patch applica come riferimento principale il mockup dark scelto come direzione estetica definitiva.

## Obiettivo

Portare la webapp da un tema ibrido chiaro/scuro a un tema principale più coerente:

- sfondo generale graphite/dark;
- sidebar dark più professionale;
- header pagina stile race-control;
- card e pannelli scuri;
- titoli sezione giallo racing;
- testi stato più leggibili;
- badge coerenti sul tema dark;
- campi, tabelle e modali più integrati nel tema scuro.

## File principali modificati

- `app/globals.css`
- `components/PageHeader.tsx`
- `components/SectionCard.tsx`
- `components/StatsGrid.tsx`
- `components/Sidebar.tsx`
- `components/Button.tsx`
- `components/StatusBadge.tsx`
- `components/EmptyState.tsx`
- `components/UiField.tsx`

## Cosa cambia visivamente

### Tema globale

La palette principale ora è dark:

- background app: nero/blu grafite;
- card: graphite scuro;
- pannelli: dark con bordi sottili;
- testo principale: quasi bianco;
- testo secondario: grigio chiaro;
- accento principale: giallo racing;
- stati: verde, rosso, blu e arancio più leggibili su dark.

### Dashboard

La dashboard eredita il nuovo sistema:

- KPI scuri;
- `Quadro operativo` scuro;
- card inferiori dark;
- righe dati dark compatte;
- titoli sezione gialli in stile motorsport.

### Pagine operative

Le pagine già costruite con componenti condivisi prendono automaticamente il nuovo look. Sono state aggiunte anche regole di compatibilità per molte classi Tailwind legacy (`bg-white`, `bg-neutral-*`, `text-neutral-*`) quando sono dentro l'app autenticata, così le schermate non restano metà bianche e metà dark.

## Supabase

Nessuna query da lanciare.

Questa patch è solo frontend/UI.

## Verifiche

- `npm ci --ignore-scripts --no-audit --no-fund` eseguito correttamente.
- `npx tsc --noEmit --pretty false` eseguito correttamente.
- `npm run build` compila la parte principale con successo, poi nel container va in timeout nella fase interna Next `Linting and checking validity of types...`, come nelle patch precedenti.

## Test consigliati su Vercel Preview

Controllare soprattutto:

1. Dashboard;
2. Auto;
3. Componenti;
4. Manutenzioni;
5. Eventi;
6. Montaggi;
7. Magazzino;
8. Telemetria solo come controllo visivo generale.

Da verificare con attenzione:

- leggibilità delle tabelle;
- modali di creazione/modifica;
- input e select;
- badge stato;
- scrollbar sidebar;
- pagine con molti dati come Magazzino e Telemetria.
