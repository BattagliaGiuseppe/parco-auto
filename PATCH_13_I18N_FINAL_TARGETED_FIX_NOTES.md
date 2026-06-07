# PATCH 13 - i18n fix mirato testi ancora non tradotti

Questa patch interviene sul problema riscontrato dopo le patch precedenti: molti testi risultavano ancora in italiano perché venivano passati come `title`, `subtitle`, `label`, `helper`, `message`, `placeholder`, children di pulsanti o valori di componenti condivisi, senza passare davvero dal sistema di traduzione.

## File modificati

- `lib/i18n.ts`
- `components/Button.tsx`
- `components/PageHeader.tsx`
- `components/SectionCard.tsx`
- `components/StatsGrid.tsx`
- `components/EmptyState.tsx`
- `components/StatusBadge.tsx`
- `components/FormStatusBanner.tsx`
- `components/UiField.tsx`
- `components/ViewModeToggle.tsx`
- `components/ModalShell.tsx`
- `components/InlineConfirmButton.tsx`
- `components/ThemeToggle.tsx`
- `components/Navbar.tsx`
- `components/Sidebar.tsx`
- `components/PrintDocumentFooter.tsx`
- `components/PrintLetterhead.tsx`

## Cosa cambia

1. I componenti condivisi ora traducono direttamente le stringhe ricevute come props:
   - titoli pagina;
   - sottotitoli;
   - titoli card/sezioni;
   - card statistiche;
   - empty state;
   - badge di stato;
   - banner di stato form;
   - label/hint dei campi;
   - modali;
   - pulsanti di conferma;
   - pulsanti comuni;
   - toggle vista;
   - header e footer di stampa;
   - link sidebar.

2. `translateKey()` ora non restituisce più il fallback italiano così com'è: se manca una chiave esatta, passa comunque il fallback a `translateKnownText()`.

3. `lib/i18n.ts` ora include un fallback lessicale più robusto per testi composti/dinamici. Questo aiuta quando un testo non è presente come frase esatta nel dizionario, ma contiene parole UI/domain note come:
   - auto, mezzo, pilota, evento, turno, componente, magazzino, telemetria;
   - aggiungi, modifica, salva, elimina, carica, scarica, apri;
   - caricamento, scadenza, revisione, stato, storico, dettagli;
   - presenza, entrata, uscita, badge, staff;
   - setup, checklist, grafico, tracciato, analisi.

4. La traduzione DOM post-render rimane attiva per intercettare testi ancora stampati direttamente dalle pagine, ma ora i componenti comuni fanno già la traduzione prima del render.

## Verifica eseguita

Nel sandbox non sono presenti `node_modules`, quindi `npx tsc --noEmit` non può essere completato correttamente perché mancano i tipi di React/Next/lucide/Supabase.

È stata però eseguita una verifica sintattica/transpile isolata su tutti i file `.ts` e `.tsx` del progetto, esclusi i `.d.ts`:

```txt
Syntax/transpile errors: 0
```

## Note importanti

- I valori inseriti dagli utenti e i dati provenienti dal database non dovrebbero essere tradotti intenzionalmente.
- Alcuni termini tecnici motorsport/telemetria restano uguali se sono sigle o standard internazionali, ad esempio RPM, GPS, CSV, AIM, ECU, SKU.
- Se dopo questa patch resta ancora qualche testo specifico non tradotto, molto probabilmente arriva da una stringa costruita dinamicamente in una pagina molto specifica o da dati salvati nel database. In quel caso conviene correggerlo puntualmente nel file/pagina indicata.
