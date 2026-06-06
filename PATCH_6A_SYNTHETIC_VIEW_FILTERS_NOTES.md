# Patch 6A — Vista sintetica e filtro auto

Questa patch introduce una prima evoluzione UX per rendere la webapp meno confusionaria ai primi utilizzi e più rapida nella consultazione quotidiana.

## Obiettivo

Passare da pagine che mostrano subito molte schede grandi a una navigazione più operativa:

- vista sintetica di default;
- vista a schede/dettagliata opzionale;
- filtri principali sempre visibili;
- liste raggruppate per auto dove ha senso.

## Cosa è stato aggiunto

### Nuovi componenti / utility

- `lib/usePersistedViewMode.ts`
  - hook client per salvare la preferenza vista nel browser;
  - supporta `compact` e `cards`;
  - default: `compact`.

- `components/ViewModeToggle.tsx`
  - controllo unico `Sintetica / Schede`;
  - coerente con il tema Dark Race Control;
  - riutilizzato nelle pagine principali.

## Pagine aggiornate

### Auto

File: `app/cars/page.tsx`

- default: vista sintetica a righe;
- vista a schede disponibile dal toggle;
- ricerca e cambio vista unificati nella stessa sezione;
- righe compatte con ore, componenti, criticità, stato e azioni principali.

### Componenti

File: `app/components/page.tsx`

- default: vista sintetica raggruppata per auto;
- gruppo separato per `Componenti non montati`;
- filtri auto/stato/tipo sempre disponibili;
- vista a schede mantenuta per il dettaglio completo;
- azione `Apri` sempre visibile in riga.

### Manutenzioni

File: `app/maintenances/page.tsx`

- aggiunti filtri dedicati per ricerca, auto e stato;
- default: vista sintetica raggruppata per mezzo;
- vista a schede mantenuta per consultazione più dettagliata;
- righe compatte con intervento, componente, data, priorità, stato e azione modifica.

### Montaggi

File: `app/mounts/page.tsx`

- aggiunto toggle `Sintetica / Schede` nello storico;
- default: storico montaggi sintetico e raggruppato per auto;
- vista a schede mantenuta per il dettaglio completo;
- nelle righe compatte sono visibili componente, note, date, stato e azione smonta.

## Supabase

Nessuna query Supabase da lanciare.

La patch è solo frontend/UX.

## Test consigliati in Vercel Preview

1. Apri **Auto**:
   - verifica che parta in vista sintetica;
   - passa a `Schede` e torna a `Sintetica`;
   - ricarica la pagina e verifica che la preferenza sia salvata.

2. Apri **Componenti**:
   - verifica raggruppamento per auto;
   - prova filtro auto;
   - prova filtro stato;
   - passa alla vista a schede.

3. Apri **Manutenzioni**:
   - verifica raggruppamento per auto;
   - prova filtro stato `Aperte` / `Completate`;
   - prova ricerca;
   - passa alla vista a schede.

4. Apri **Montaggi**:
   - verifica storico sintetico raggruppato;
   - prova filtro auto;
   - prova `Montaggi attivi` / `Storico chiuso`;
   - prova vista a schede.

## Nota

Questa patch non cambia la logica dati e non modifica i trigger/contatori. È pensata come primo blocco UX per ridurre il carico visivo e rendere la webapp più chiara già dal primo utilizzo.
