# PATCH 10 - Multilingua e cambio lingua

## Obiettivo
Rendere operativo il cambio lingua e predisporre la piattaforma per più lingue.

## Lingue abilitate
- Italiano (`it`)
- English (`en`)
- Français (`fr`)
- Español (`es`)
- Deutsch (`de`)

## File aggiunti
- `lib/i18n.ts`
  - elenco lingue supportate;
  - normalizzazione dei codici lingua;
  - traduzioni base dell'interfaccia;
  - traduttore legacy per testi statici già presenti nelle pagine.
- `components/providers/LanguageProvider.tsx`
  - provider client per lingua corrente;
  - salvataggio scelta in `localStorage`;
  - aggiornamento di `html lang`;
  - traduzione automatica dei testi statici principali già renderizzati.
- `components/LanguageSelector.tsx`
  - selettore lingua riutilizzabile.

## File modificati
- `app/providers.tsx`
  - aggiunto `LanguageProvider` dentro `BrandThemeProvider`.
- `components/Sidebar.tsx`
  - aggiunto selettore lingua nella sidebar;
  - tradotte le etichette principali del menu/footer.
- `app/settings/page.tsx`
  - il campo “Lingua piattaforma” ora mostra IT/EN/FR/ES/DE;
  - il cambio lingua aggiorna subito l'interfaccia;
  - la lingua resta salvabile nel Control Center come prima.
- `lib/brandingTheme.ts`
  - normalizzazione della lingua del tema;
  - aggiornamento coerente di `html lang` e `data-language`.

## Nota tecnica
La app contiene molte pagine con testi hardcoded in italiano. Per evitare una conversione rischiosa e invasiva in un solo passaggio, è stato aggiunto un traduttore legacy controllato che traduce solo testi statici riconosciuti. Da ora in avanti, i nuovi testi dovrebbero usare `useLanguage().t("chiave")` oppure essere aggiunti alla mappa in `lib/i18n.ts`.

## Verifica locale
- `npx tsc --noEmit --pretty false` completato senza errori.
- `next build` compila correttamente la fase “Compiled successfully”; nel sandbox si blocca/va in timeout nella fase interna di Next “Checking validity of types / traces”, ma il controllo TypeScript separato è pulito.
