# PATCH 12 - Audit multilingua completo webapp

Questa patch prosegue sopra le patch i18n precedenti e punta a coprire i testi rimasti hardcoded nelle schermate principali e secondarie.

## Cosa è stato fatto

- Eseguito audit sui file `app/**/*.tsx`, `components/**/*.tsx` e `lib/**/*.ts`.
- Individuate 673 stringhe candidate non ancora coperte dal sistema multilingua precedente.
- Aggiunto in `lib/i18n.ts` un catalogo `AUTO_AUDIT_SOURCE_TEXTS` generato dall'audit con testi provenienti da:
  - pagine Auto, Componenti, Montaggi, Manutenzioni, Eventi, Turni tecnici, Telemetria;
  - Presenze, Kiosk, Timbratura rapida;
  - Piloti, documenti pilota, stampa pilota;
  - Magazzino e import CSV;
  - Dashboard, Control Center, Team & Accessi, Onboarding, Login;
  - testi di card, empty state, modali, messaggi, placeholder, aria-label e title.
- Esteso il motore di traduzione con:
  - normalizzazione di entità HTML tipo `&apos;`, `&amp;`, `&quot;`;
  - matching normalizzato degli spazi;
  - glossario automatico IT -> EN/FR/ES/DE per le stringhe emerse dall'audit;
  - fallback per testi non ancora presenti nel dizionario manuale.
- Migliorata la traduzione DOM post-render:
  - i text node conservano il valore originale tramite `WeakMap`;
  - gli attributi `placeholder`, `title`, `aria-label` conservano il valore originale tramite `WeakMap`;
  - il cambio lingua può quindi passare da una lingua all'altra senza tentare di ritradurre il testo già tradotto.
- Convertiti i componenti condivisi a tradurre direttamente le props ricevute:
  - `PageHeader`
  - `SectionCard`
  - `StatsGrid`
  - `EmptyState`
  - `StatusBadge`
  - `PagePermissionState`
  - `FormStatusBanner`
  - `UiField`
  - `ViewModeToggle`
  - `ModalShell`
  - `InlineConfirmButton`

## File modificati

- `lib/i18n.ts`
- `components/PageHeader.tsx`
- `components/SectionCard.tsx`
- `components/StatsGrid.tsx`
- `components/EmptyState.tsx`
- `components/StatusBadge.tsx`
- `components/PagePermissionState.tsx`
- `components/FormStatusBanner.tsx`
- `components/UiField.tsx`
- `components/ViewModeToggle.tsx`
- `components/ModalShell.tsx`
- `components/InlineConfirmButton.tsx`

## Cosa resta volutamente non tradotto

- dati inseriti dagli utenti;
- nomi auto, piloti, eventi, componenti e articoli;
- codici tecnici, SKU, EAN, seriali, numeri documento;
- nomi file e nomi canali importati dai logger;
- sigle tecniche come CSV, PDF, RPM, GPS, ECU, AIM, OEM;
- testi provenienti direttamente dal database se creati dall'utente.

## Verifica effettuata nel sandbox

- Eseguito controllo sintattico AST su tutti i file `.ts` e `.tsx`: **0 errori di parsing**.
- Eseguito transpile isolato di `lib/i18n.ts`: **0 errori**.
- Non ho potuto completare `npx tsc --noEmit` o `next build` nel sandbox perché lo ZIP non contiene `node_modules` e l'installazione dipendenze tramite `npm ci/npm install` è andata in timeout nell'ambiente. La patch non aggiunge nuove dipendenze npm.

## Nota tecnica

Questa patch usa un approccio misto:

1. traduzione diretta nei componenti condivisi che stampano props;
2. catalogo automatico dei testi emersi dall'audit;
3. traduzione DOM post-render per i testi hardcoded rimasti nei componenti pagina.

Questo riduce la necessità di riscrivere manualmente migliaia di punti JSX e rende più stabile il cambio lingua anche su modali, toast, placeholder e sezioni che vengono montate dinamicamente.
