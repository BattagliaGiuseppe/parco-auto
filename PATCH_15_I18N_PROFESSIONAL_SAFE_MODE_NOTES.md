# PATCH 15 — i18n Professional Safe Mode

Questa patch disattiva definitivamente il sistema di traduzione post-render basato su scansione del DOM.

## Perché

Le patch precedenti traducevano anche tramite:

- `document.createTreeWalker(document.body, ...)`
- `MutationObserver` su `document.body` con `subtree`, `childList`, `characterData` e attributi
- traduzione di `placeholder`, `title` e `aria-label` dopo il render

Su pagine grandi come Inventario/Magazzino questo può diventare pesante, perché ogni aggiornamento della tabella/lista può riattivare la scansione di molti nodi DOM. Inoltre un traduttore DOM rischia di toccare dati dinamici provenienti dal database, cosa non corretta per una webapp gestionale.

## Cosa cambia

- `LanguageProvider` non usa più `MutationObserver`.
- `LanguageProvider` non richiama più la traduzione dell'intero documento.
- `translateDocumentText()` non scansiona più `document.body`: aggiorna solo `html lang` e `data-language`.
- `translateElementAttributes()` è disattivata in safe mode.
- Rimane attivo solo il sistema corretto: testi statici tradotti a render tramite `t("chiave", "fallback")`.

## Approccio professionale consigliato

Per tradurre il resto dell'app bisogna sostituire i testi statici direttamente nei componenti/pagine con chiavi i18n, ad esempio:

```tsx
const { t } = useLanguage();
return <h1>{t("inventory.title", "Magazzino")}</h1>;
```

Non bisogna tradurre automaticamente righe inventario, nomi articolo, codici, descrizioni database, numeri, file o valori inseriti dagli utenti.

## File modificati

- `components/providers/LanguageProvider.tsx`
- `lib/i18n.ts`
