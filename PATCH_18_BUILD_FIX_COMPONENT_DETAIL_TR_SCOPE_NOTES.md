# PATCH 18 - Build fix: `tr` non definito in Scheda componente

## Problema
Il deploy Vercel falliva con:

```txt
./app/components/[id]/page.tsx:1198:25
Type error: Cannot find name 'tr'.
```

La causa era nella funzione `ModalShell` definita in fondo a `app/components/[id]/page.tsx`: il componente usava `tr("Chiudi")`, ma `tr` era dichiarata solo dentro `ComponentDetailPage`, quindi non era disponibile nello scope di `ModalShell`.

## Modifica applicata
In `ModalShell` è stato aggiunto l'accesso diretto a `useLanguage()` e l'aria-label ora usa una chiave sicura:

```tsx
const { t } = useLanguage();
aria-label={t("common.close", "Chiudi")}
```

## Sicurezza della modifica
- Non riattiva traduzioni automatiche globali.
- Non usa MutationObserver.
- Non traduce dati dinamici.
- Corregge solo lo scope della traduzione nel componente modale.

## Verifica locale nel sandbox
Eseguita scansione statica delle chiamate `tr(...)` fuori scope: nessuna chiamata residua trovata.
