# PATCH 11 — Audit multilingua approfondito

Questa patch estende il sistema multilingua introdotto nella patch precedente.

## Obiettivo

Ridurre drasticamente i testi ancora non tradotti dopo il cambio lingua, senza appesantire il progetto con una riscrittura completa di ogni pagina.

## File modificato

- `lib/i18n.ts`

## Cosa è stato fatto

- Aggiunte nuove liste di traduzione derivate da un audit dei file in:
  - `app/**/*.tsx`
  - `components/**/*.tsx`
- Estesa la copertura di testi hardcoded visibili in:
  - inviti e onboarding;
  - presenze, kiosk, badge e PIN;
  - calendario eventi;
  - console mezzo;
  - turni tecnici;
  - auto e documenti mezzo;
  - componenti;
  - manutenzioni;
  - montaggi;
  - piloti;
  - magazzino;
  - attività/promemoria;
  - dashboard;
  - Control Center;
  - Team & Accessi;
  - Telemetria.
- Aggiunte traduzioni per pulsanti, titoli, sottotitoli, placeholder, help text, tooltip/aria-label e stati principali.
- Mantenuto il funzionamento precedente: la lingua viene applicata a tutto il DOM tramite `LanguageProvider` e `translateDocumentText`.

## Verifica tecnica

Eseguito:

```bash
npx tsc --noEmit --pretty false
```

Risultato: nessun errore TypeScript.

## Nota importante

Questa patch è pensata per essere applicata sopra la patch multilingua precedente. Non sostituisce la struttura `LanguageProvider` / `LanguageSelector`, ma amplia la copertura del dizionario centrale.

Alcuni testi dinamici generati da dati utente, nomi file, valori di database, codici tecnici, sigle e contenuti liberi non vengono tradotti intenzionalmente.
