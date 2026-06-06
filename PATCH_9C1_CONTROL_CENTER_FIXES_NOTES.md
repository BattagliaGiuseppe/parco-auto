# Patch 9C.1 — Fix validazione Control Center

Patch mirata sui problemi emersi dal test veloce della Macro Patch 9C.

## Cosa corregge

### Branding / colori
- Aggiunti token visivi derivati dal primary e secondary color:
  - `--brand-primary-signal`
  - `--brand-secondary-signal`
  - relativi valori RGB
- Il primary color ora viene usato come colore identità visibile su:
  - voce attiva sidebar;
  - indicatori laterali delle righe dati;
  - titoli/separatori sezione;
  - header sezione e glow grafici.
- L'accent color resta dedicato alle CTA/bottoni principali, così il tema rimane leggibile.
- Se il primary color scelto è troppo scuro per essere visibile sul tema dark, viene mantenuto come token tecnico ma il segnale grafico usa un fallback leggibile.

### Dashboard builder
- Aggiunti controlli freccia su/giù per modificare l'ordine dei widget.
- Le dimensioni widget sono state rese più usabili:
  - `Compatto` non crea più card troppo strette;
  - `Standard` resta mezza riga;
  - `Ampio` usa più spazio;
  - `Riga intera` occupa tutta la riga.
- Le label dei widget standard ora seguono meglio la terminologia globale quando non sono state personalizzate manualmente.

### Setup dinamico e Checklist
- Le opzioni dei campi `select` ora possono essere scritte liberamente nel textarea.
- Non vengono più normalizzate mentre scrivi: puoi usare virgole, punto e virgola o una voce per riga.
- La normalizzazione avviene solo al salvataggio.

### Terminologia dashboard
- Aggiornate alcune etichette della dashboard per usare le label globali del Control Center.

## Supabase
Nessuna query Supabase da eseguire.

## Verifiche
- `npx tsc --noEmit --pretty false` completato correttamente.
- `npm run build` compila CSS/webpack e arriva alla fase interna Next di lint/typecheck; nel container va in timeout come già visto nelle patch precedenti.
