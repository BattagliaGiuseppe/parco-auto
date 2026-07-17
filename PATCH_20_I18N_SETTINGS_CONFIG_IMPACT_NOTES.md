# PATCH 20 - i18n impostazioni, campi configurabili e impatto sui moduli

## Obiettivo
Questa patch corregge un problema strutturale: alcune voci configurabili dal Control Center/Impostazioni venivano salvate come testo italiano o come label personalizzata e poi riutilizzate in sidebar, dashboard, schede auto, componenti, setup e check-up senza localizzazione.

La patch mantiene la modalità professionale/sicura già scelta:

- nessun MutationObserver;
- nessuna scansione globale del DOM;
- nessuna traduzione automatica dell'inventario o di dati database liberi;
- traduzione solo al momento del render, nei punti dove i testi statici/configurabili vengono mostrati.

## File modificati

- `lib/controlCenter.ts`
- `lib/i18n.ts`
- `components/Sidebar.tsx`
- `app/settings/page.tsx`
- `app/dashboard/page.tsx`
- `app/cars/page.tsx`
- `app/cars/[id]/page.tsx`
- `app/components/page.tsx`
- `app/components/[id]/page.tsx`
- `app/calendar/[eventId]/car/[eventCarId]/page.tsx`
- `app/telemetry/page.tsx`

## Cosa viene corretto

### Control Center / Impostazioni
Le etichette configurabili dei moduli, dei widget dashboard e delle aree standard vengono ora localizzate quando sono mostrate nella UI.

Sono stati aggiunti helper sicuri in `lib/controlCenter.ts`:

- `getModuleLabel(..., language)`
- `getModuleDescription(..., language)`
- `getLocalizedControlCenterLabels(...)`
- `getDashboardWidgetLabel(..., language)`
- `getDashboardWidgetAutoLabel(..., language)`
- `getDashboardWidgetDisplayLabel(..., language)`

Questi helper traducono solo testi noti e non modificano dati liberi inseriti dagli utenti.

### Sidebar
Le voci del menu derivate dalle impostazioni globali vengono localizzate in base alla lingua corrente.

### Dashboard
Le label dei widget automatici configurati dal Control Center vengono localizzate. Questo include esempi come:

- Prontezza · Car
- Criticità · Ricambi
- Calendario · Eventi
- Da completare · Maintenance
- Documenti · Driver
- Sotto soglia · Magazzino

### Schede auto e scheda mezzo
La terminologia del mezzo configurata nelle impostazioni viene localizzata nelle pagine auto e dettaglio auto.

### Componenti / Ricambi
Le definizioni standard configurate nel Control Center, quando corrispondono a termini noti come Motore, Cambio, Differenziale, Cinture, Estintore ecc., vengono localizzate nelle liste, nei filtri, nella creazione componente e nella scheda componente.

### Setup dinamico e Check-up
I campi configurabili dal Control Center vengono localizzati in:

- pagina Impostazioni;
- console mezzo evento;
- opzioni select note;
- gruppi check-up;
- voci checklist.

I valori liberi scritti dall'utente restano invariati.

## Dizionario ampliato
Sono state aggiunte traduzioni IT/EN/FR/ES/DE per termini configurabili frequenti:

- Car
- Ricambi
- Driver
- Componenti standard
- Campi setup
- Moduli attivi
- Motore / motore
- Cambio / cambio
- Differenziale / differenziale
- Cinture di sicurezza
- Cavi ritenuta ruote
- Estintore
- Serbatoio
- Passaporto tecnico
- Pneumatici
- Pressione ant. sx/dx
- Pressione post. sx/dx
- Base, Opzionale, Ore, Scadenza, Anni
- Testo, Numero, Select, Checkbox

## Verifica eseguita
Controllo sintattico/transpile isolato TypeScript sui file modificati: OK.

Non è stato possibile eseguire `next build` completo nel sandbox perché non sono presenti `node_modules`, ma non risultano errori sintattici introdotti dalla patch.
