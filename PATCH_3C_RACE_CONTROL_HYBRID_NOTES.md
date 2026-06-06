# Patch 3C — Race Control Hybrid UI

Questa patch è solo grafica/UX. Non modifica schema Supabase, RPC, trigger, query dati o logica dei turni.

## Obiettivo

Passare da una UI ancora troppo simile a un gestionale chiaro con tocchi racing a una piattaforma più riconoscibile come centro operativo motorsport, mantenendo però leggibilità su tabelle, form e liste lunghe.

Direzione scelta: **Race Control Hybrid**.

- parti di orientamento e controllo più scure;
- contenuti operativi e form ancora chiari;
- più contrasto fra header, sezioni, righe e azioni;
- font racing reintrodotto solo in micro-label e titoli, non nei testi lunghi;
- dashboard e card più tecniche e meno generiche.

## File principali modificati

- `app/globals.css`
- `components/AppShell.tsx`
- `components/PageHeader.tsx`
- `components/SectionCard.tsx`
- `components/StatsGrid.tsx`
- `components/StatusBadge.tsx`
- `components/Button.tsx`
- `components/Sidebar.tsx`

## Cosa cambia visivamente

### Layout generale

- sfondo workspace con fascia scura superiore;
- pannelli principali inseriti sopra un ambiente più “race-control”;
- più prevalenza scura senza trasformare tutta l'app in dark mode.

### Dashboard e statistiche

- statistiche principali ora in card scure tecniche;
- numeri più leggibili e più evidenti;
- icone e accenti colorati più sobri;
- maggiore gerarchia visiva fra dato, etichetta e descrizione.

### Sezioni

- `SectionCard` ora ha header scuro e corpo chiaro;
- le liste restano leggibili su fondo chiaro;
- ogni sezione ha più carattere motorsport senza compromettere i form.

### Sidebar

- sidebar più profonda e meno piatta;
- voce attiva meno “blocco giallo pieno” e più tecnica;
- hover più ordinato;
- mantiene identità scura.

### Font

- `Inter` rimane per testi, form e tabelle;
- `Rajdhani` viene usato per titoli tecnici;
- `Audiowide` rientra solo nelle micro-label racing, per recuperare personalità senza appesantire la lettura.

## Supabase

Nessuna query da lanciare.

Restano valide le patch SQL già applicate:

- `db/component_mounting_consistency_patch.sql`
- `db/event_turns_atomic_counters_patch.sql`

## Verifiche locali

Eseguite nel container:

```bash
npm ci --ignore-scripts --no-audit --no-fund
npx tsc --noEmit --pretty false
```

Entrambe OK.

`npm run build` compila correttamente la build ottimizzata, poi resta in timeout nella fase interna Next `Linting and checking validity of types...`, come nelle patch precedenti. La preview Vercel resta il test finale.

## Test consigliato in Preview Vercel

Controllare soprattutto:

1. Dashboard: header, statistiche, card e lista mezzi/componenti.
2. Auto: card, form, lista componenti e dettagli.
3. Componenti: lista, progress bar, dettaglio componente.
4. Manutenzioni: form e storico.
5. Eventi/Turni: leggibilità di form, metriche e liste.
6. Telemetria: solo controllo visivo generale, senza test funzionali nuovi.

