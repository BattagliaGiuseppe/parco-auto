# Patch 7 — Polishing grafico moduli operativi

Questa patch completa il giro di rifinitura grafica sui moduli rimasti meno allineati al tema **Dark Race Control**.

## Moduli rifiniti

- Piloti
- Magazzino
- Telemetria
- Impostazioni / Team & Accessi

## Interventi principali

- Rimosse le ultime superfici chiare legacy (`bg-white`, `bg-neutral-*`, `border-neutral-*`) dai moduli principali rimasti.
- Allineati card, tabelle, righe sintetiche, modali e box informativi al tema dark.
- Migliorati i testi secondari e i contrasti nelle liste compatte.
- Resi coerenti i colori di stato su dark theme:
  - rosso per errori/criticità;
  - verde per ok/carichi;
  - blu/azzurro per info/telemetria;
  - giallo per warning e richiami racing.
- Rifiniti input, select, textarea, upload file e modali rimaste in stile chiaro.
- Migliorata la leggibilità nelle aree estese di Telemetria e Magazzino senza modificare la logica dati.

## Supabase

Nessuna query Supabase da eseguire.

## Verifiche

- `npm ci --ignore-scripts --no-audit --no-fund` completato.
- `npx tsc --noEmit --pretty false` completato senza errori.
- `npm run build` compila correttamente CSS/webpack e arriva alla fase interna Next di validazione tipi; nel container va in timeout come nelle patch precedenti.
