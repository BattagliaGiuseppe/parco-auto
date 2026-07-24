# PATCH 25 — I18N sezione Piloti completa

Questa patch è mirata solo alla sezione Piloti e mantiene la modalità sicura introdotta nelle patch precedenti.

## File modificati

- `app/drivers/page.tsx`
- `app/drivers/[id]/page.tsx`
- `app/drivers/[id]/performance/page.tsx`
- `app/drivers/[id]/print/page.tsx`
- `lib/i18n.ts`

## Cosa è stato corretto

- Tradotti campi, label, placeholder e pulsanti nel modal `Nuovo pilota / Modifica pilota`.
- Tradotti filtri e tasti della tabella/lista piloti: `Tutti`, `Attivi`, `Non attivi`, `Con scadenze`, `Apri`, `Dettaglio`, `Modifica`, ecc.
- Tradotti messaggi fallback visibili: `Email non inserita`, `Telefono non inserito`, `Nessun nickname`, `Numero non inserito`, `Senza scadenza`, ecc.
- Tradotti documenti pilota, tipologie documento, form nuovo documento e upload file con controllo custom su `Scegli file / Nessun file selezionato`.
- Tradotta la scheda dettaglio pilota: profilo, checklist sicurezza, licenze, documenti, note, pulsanti e stati.
- Tradotta la pagina performance pilota.
- Tradotta la pagina stampa scheda pilota e i testi statici dentro le tabelle di stampa.
- Aggiunto catalogo `PATCH_24_DRIVERS_COMPLETE_UI_TEXTS` in `lib/i18n.ts` con traduzioni IT/EN/FR/ES/DE.

## Cosa resta volutamente non tradotto

- Nomi e cognomi dei piloti.
- Nickname reali, email, telefoni, numeri licenza, note scritte dall’utente e dati caricati da database.
- Nomi file caricati.
- Valori tecnici o date/numeri reali.

## Sicurezza performance

Non è stato reintrodotto nessun automatismo globale:

- nessun `MutationObserver`;
- nessuna scansione di `document.body`;
- nessuna traduzione automatica dei dati dinamici.

## Verifica eseguita

Eseguito controllo di transpile TypeScript isolato su:

- `app/drivers/page.tsx`
- `app/drivers/[id]/page.tsx`
- `app/drivers/[id]/performance/page.tsx`
- `app/drivers/[id]/print/page.tsx`
- `lib/i18n.ts`

Risultato: nessun errore sintattico rilevato.

È stata inoltre verificata la presenza delle traduzioni inglesi per le stringhe `tr(...)`, `LocalizedText`, `UiField`, `PageHeader`, `SectionCard`, `EmptyState` e `StatsGrid` usate nelle pagine Piloti.
