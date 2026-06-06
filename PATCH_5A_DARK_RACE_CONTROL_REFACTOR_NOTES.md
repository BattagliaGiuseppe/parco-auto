# Patch 5A — Dark Race Control refactor reale

Questa patch nasce dall'audit dello zip `parco-auto-master (5).zip`: il problema delle patch 4B/4C era l'uso di override CSS globali aggressivi per trasformare classi Tailwind light in dark. Il risultato era fragile e in parte non visibile, perché molte pagine continuavano a usare direttamente `bg-white`, `bg-neutral-*`, `text-neutral-*` e modali costruite a mano.

## Cosa cambia

### 1. Pulizia `globals.css`

Rimossi gli override globali più pericolosi, compresa la regola che trasformava `bg-neutral-900` / `bg-gray-900` in giallo racing.

Ora il CSS contiene:

- token Dark Race Control;
- classi riutilizzabili (`modal-panel`, `race-mini-panel`, `race-info-box`, `race-action-secondary`, `race-action-danger`, `form-control-dark`);
- scrollbar dark;
- nessuna conversione globale indiscriminata di tutte le classi light.

### 2. Nuovo componente `ModalShell`

Aggiunto:

```text
components/ModalShell.tsx
```

Serve a standardizzare overlay, pannello modale, header, chiusura, footer e scrollbar in stile Dark Race Control.

### 3. Form control unificati

Aggiornato:

```text
components/UiField.tsx
```

Ora espone classi coerenti con il tema:

```text
uiInputClassName
uiSelectClassName
uiTextareaClassName
```

### 4. Pagine convertite direttamente, non via override

Interventi diretti su:

```text
app/calendar/page.tsx
app/calendar/[eventId]/page.tsx
app/maintenances/page.tsx
app/mounts/page.tsx
app/components/page.tsx
app/components/[id]/page.tsx
app/cars/page.tsx
```

Conversioni principali:

- modale nuovo/modifica evento;
- modale nuovo autodromo;
- modale manutenzione;
- modale nuovo componente;
- card eventi registrati;
- card storico manutenzioni;
- card storico montaggi;
- filtri componenti e montaggi;
- pagina auto e modale mezzo più coerenti con il tema scuro;
- box informativi gialli convertiti in `race-info-box`;
- mini card dati convertite in `race-mini-panel`;
- azioni secondarie/danger convertite in classi dedicate.

## Supabase

Nessuna query da lanciare.

Questa patch è solo frontend/UI.

## Verifiche

Eseguite con successo:

```text
npm ci --ignore-scripts --no-audit --no-fund
npx tsc --noEmit --pretty false
```

## Cosa controllare in preview

Controllare soprattutto:

1. Dashboard
2. Eventi
3. Nuovo evento / nuovo autodromo
4. Montaggi
5. Manutenzioni / aggiungi manutenzione
6. Componenti / nuovo componente
7. Dettaglio componente
8. Auto / modifica mezzo

## Nota

Questa è la prima patch del refactor UI reale. Non copre ancora in profondità Magazzino, Piloti, Settings e Telemetria, che sono moduli più grandi e vanno trattati in una Patch 5B separata.
