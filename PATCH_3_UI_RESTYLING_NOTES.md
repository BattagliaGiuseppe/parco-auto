# Patch 3 — Restyling leggibilità generale

Questa patch interviene solo sull'aspetto grafico e sulla leggibilità del ramo generale. Non introduce migrazioni database e non modifica la logica Supabase già validata nelle Patch 1 e 2.

## Obiettivi

- Rendere la webapp più leggibile e meno confusionaria.
- Mantenere l'identità motorsport, ma limitare lo stile racing ai punti giusti.
- Uniformare card, header, statistiche, badge e stati vuoti.
- Migliorare la dashboard come vista di controllo operativo.
- Rendere più chiara la visualizzazione delle ore brevi, ad esempio 10 minuti invece di 0.2 h.

## File principali modificati

- `app/globals.css`
- `components/PageHeader.tsx`
- `components/SectionCard.tsx`
- `components/StatsGrid.tsx`
- `components/StatusBadge.tsx`
- `components/Button.tsx`
- `components/EmptyState.tsx`
- `components/AppShell.tsx`
- `app/dashboard/page.tsx`
- `app/cars/page.tsx`
- `app/cars/[id]/page.tsx`
- `app/components/page.tsx`
- `app/components/[id]/page.tsx`
- `app/maintenances/page.tsx`
- `lib/componentStatus.ts`

## Cosa cambia visivamente

### Header pagina

`PageHeader` ora ha un aspetto più da race-control:

- pannello più pulito;
- accento giallo più controllato;
- titolo racing solo dove serve;
- sottotitoli più leggibili;
- card logo/team meno invadente.

### Card e sezioni

`SectionCard` ora ha:

- bordo più leggero;
- ombra più morbida;
- header interno separato dal contenuto;
- migliore gerarchia tra titolo, sottotitolo e azioni.

### Statistiche

`StatsGrid` ora supporta anche un `tone` visivo:

- verde per OK;
- giallo per attenzione;
- rosso per criticità;
- blu per info/calendario.

La dashboard usa questi toni per distinguere subito stato mezzi, urgenze e manutenzioni.

### Badge

`StatusBadge` è stato reso più coerente:

- testo uppercase;
- bordi e sfondi più ordinati;
- tono giallo collegato al colore brand;
- migliore leggibilità in card e liste.

### Ore e minuti

`formatComponentHours` ora evita la visualizzazione confusa dei valori piccoli.

Esempi:

- `0.1667 h` diventa `10 min`;
- `0.5 h` diventa `30 min`;
- valori tra 1 e 10 ore restano più precisi, ad esempio `1.25 h`;
- valori più grandi restano compatti, ad esempio `40.3 h`.

Questo rende più chiaro il caso reale dei turni brevi, dove prima un turno da 10 minuti poteva sembrare un aumento strano da `0.0` a `0.2 h`.

## Dashboard

La dashboard è stata ripulita come centro operativo:

- statistiche con helper testuali;
- righe dati uniformi;
- link meno invadenti;
- colori più coerenti;
- stato sintetico più leggibile.

## Colori brand

Dove possibile, il giallo hardcoded è stato sostituito con:

- `var(--brand-accent)`;
- `var(--brand-on-accent)`;
- `var(--brand-accent-soft)`.

Così le impostazioni brand continuano a propagarsi meglio nell'interfaccia.

## Database

Nessuna query Supabase da lanciare per questa patch.

Le patch SQL già applicate restano valide:

- `component_mounting_consistency_patch.sql`
- `event_turns_atomic_counters_patch.sql`

## Verifica consigliata su Vercel Preview

Dopo il deploy preview, controllare:

1. Dashboard: card, statistiche, widget e pulsante configurazione.
2. Sidebar: leggibilità voci e stato attivo.
3. Componenti: ore brevi mostrate come minuti.
4. Auto: riepilogo componenti e ore montate.
5. Manutenzioni: box componente selezionato con ore leggibili.
6. Telemetria: solo controllo visivo generale, non è stata cambiata la logica.

## Nota sulle verifiche locali

In container non è stato possibile completare `npm ci` per problemi di rete/registry durante il download delle dipendenze. La patch non modifica `package.json` o `package-lock.json`.

La verifica definitiva va quindi fatta dalla Preview Deployment di Vercel, che userà il suo ambiente di installazione pulito.
