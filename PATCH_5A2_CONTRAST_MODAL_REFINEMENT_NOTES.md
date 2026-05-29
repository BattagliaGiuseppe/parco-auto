# Patch 5A.2 — Contrast & Modal Refinement

Questa patch corregge il problema principale emerso dopo la Patch 5A: il tema Dark Race Control era attivo, ma diversi testi risultavano troppo scuri o poco leggibili.

## Diagnosi

Il problema non era solo nelle classi delle card: `BrandThemeProvider` applicava al documento token provenienti dal tema/branding precedente, con valori chiari come testo scuro e superfici chiare. Questo sovrascriveva le variabili CSS del nuovo tema dark dopo il caricamento della pagina.

## Interventi principali

- Aggiornati i default di `lib/brandingTheme.ts` al tema Dark Race Control.
- Aggiunti controlli per impedire che vecchi `theme_tokens` chiari sovrascrivano testo e superfici del tema dark.
- Rafforzati i token applicati al documento: `--text-primary`, `--text-secondary`, `--surface-*`, `--border-*`.
- Aumentato il contrasto di `data-row`, card interne, mini pannelli e tabelle.
- Migliorata la leggibilità di input, select, textarea e placeholder.
- Rifinito `ModalShell` e bottoni secondari.
- Corretti testi legacy nel report evento che usavano ancora `text-neutral-600` e risultavano quasi invisibili.
- Convertito `InfoBlock` e badge evento in stile coerente con il tema dark.

## File principali modificati

- `lib/brandingTheme.ts`
- `app/globals.css`
- `components/SectionCard.tsx`
- `components/StatsGrid.tsx`
- `components/ModalShell.tsx`
- `components/Button.tsx`
- `app/dashboard/page.tsx`
- `app/calendar/[eventId]/page.tsx`

## Supabase

Non serve lanciare query Supabase.

## Verifiche

- `npm ci --ignore-scripts --no-audit --no-fund` OK
- `npx tsc --noEmit --pretty false` OK
- `npm run build` compila correttamente CSS/webpack e arriva a `Collecting page data ...`; nel container va in timeout come nelle patch precedenti.

## Test consigliato

Controllare in Vercel Preview:

1. Dashboard — Quadro operativo, Mezzi pronti, Componenti critici.
2. Evento — report evento e tabella riepilogo.
3. Modale nuovo evento.
4. Manutenzioni — modale aggiungi manutenzione.
5. Montaggi — form e filtri.
6. Auto e Componenti — card e testi interni.
