# Patch 9C.3 — Control Center: modifiche non salvate e label widget

Questa patch rifinisce il Control Center dopo i test della 9C.2.

## Cosa corregge

### Avviso modifiche non salvate

- Aggiunto rilevamento delle modifiche non salvate nel modulo Impostazioni.
- Se l'utente prova a cambiare pagina con modifiche aperte, appare una conferma.
- Se l'utente chiude o ricarica la scheda del browser, appare l'avviso nativo del browser.
- Aggiunto banner informativo nella pagina quando ci sono modifiche non salvate.

### Conflitto terminologia globale / label dashboard

Prima le label personalizzate dei widget dashboard potevano entrare in conflitto con la terminologia globale. Per esempio cambiando `vehicle` in Branding/Terminologia, un widget dashboard poteva restare con una vecchia etichetta salvata.

Ora ogni widget ha una logica chiara:

- **Auto**: segue sempre la terminologia globale del Control Center.
- **Custom**: sovrascrive solo quel widget dashboard.

La dashboard legge la modalità dal campo `config.label_mode`, senza richiedere nuove tabelle.

## File modificati

- `app/settings/page.tsx`
- `app/dashboard/page.tsx`
- `lib/controlCenter.ts`

## Supabase

Nessuna query Supabase da eseguire.
