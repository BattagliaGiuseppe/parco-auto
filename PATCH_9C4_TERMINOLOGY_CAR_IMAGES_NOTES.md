# Patch 9C.4 — Terminologia, avviso non salvato e immagini mezzo

## Obiettivo
Correggere gli ultimi problemi emersi sul Control Center senza cambiare la logica dati validata.

## Cosa cambia

- Le label automatiche dei widget dashboard non usano più frasi con accordi maschile/femminile/plurale difficili da controllare. Ora usano formule neutre tipo `Prontezza · Mezzi`, `Criticità · Ricambi`, `Calendario · Weekend`.
- La dashboard usa label più neutre anche nei KPI e nel quadro operativo, così la terminologia globale non crea errori grammaticali.
- Le label custom dei widget dashboard restano limitate solo al widget specifico.
- Il popup di modifiche non salvate per la navigazione interna è ora una modale Dark Race Control, non più il `window.confirm` del browser. Il prompt nativo resta solo per chiusura/refresh scheda, dove il browser non permette modali custom.
- La pagina Auto usa meglio la terminologia globale e riduce testi hardcoded come "mezzo" dove creavano incongruenze.
- Aggiunta immagine personalizzata per ogni scheda mezzo: upload dal form di creazione/modifica, visualizzazione nelle card e nella scheda dettaglio.

## Database
Eseguire solo:

```sql
db/control_center_terminology_and_car_images_patch.sql
```

La query aggiunge `cars.image_url`.

## Note
Per le immagini viene usato il bucket/team storage già esistente tramite `uploadTeamFile`.
