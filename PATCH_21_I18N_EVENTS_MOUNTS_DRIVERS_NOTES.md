# PATCH 21 - i18n mirata Eventi, Console turni, Montaggi e Piloti

Questa patch continua il lavoro multilingua in modalità sicura e manuale, senza riattivare traduzioni automatiche globali.

## Moduli corretti

- Eventi (`app/calendar/page.tsx`)
  - pulsanti, loading, titolo modale nuovo/modifica evento, hint note, placeholder, messaggi e fallback.
- Gestione evento (`app/calendar/[eventId]/page.tsx`)
  - report evento, controlli completezza, statistiche, fallback data/autodromo, messaggi sessioni/mezzi.
- Console mezzo evento (`app/calendar/[eventId]/car/[eventCarId]/page.tsx`)
  - header, hub operativo, piloti associati, ultimi turni, badge dinamici controllati, messaggi setup/check-up.
- Console turni (`app/calendar/[eventId]/car/[eventCarId]/turns/page.tsx`)
  - KPI, turn intelligence, confronto turni, drawer nuovo/modifica turno, campi e bottoni principali.
- Montaggi (`app/mounts/page.tsx`)
  - widget, filtri, pulsanti di montaggio, fallback auto/componente/note e storico movimenti.
- Piloti (`app/drivers/page.tsx`)
  - modale nuovo/modifica pilota, selezione file localizzata, note sportive/interne, crea pilota/salvataggio.

## Sicurezza prestazioni

- Nessun `MutationObserver` reintrodotto.
- Nessuna scansione globale del DOM.
- Nessuna traduzione automatica di dati database, note utente, codici articolo, nomi auto o valori inventario.
- Traduzione solo sui testi statici e sulle label configurabili già previste dal sistema i18n.

## Verifiche eseguite nel sandbox

- Transpile/syntax check isolato sui file modificati: OK.
- Ricerca `MutationObserver` / traduzione DOM globale: nessuna reintroduzione.

Nota: il controllo `next build` completo non è stato eseguito nel sandbox perché non sono presenti `node_modules`. La patch non aggiunge nuove dipendenze.
