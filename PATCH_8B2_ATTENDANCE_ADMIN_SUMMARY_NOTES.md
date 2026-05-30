# Patch 8B.2 — Presenze: gestione admin, riepiloghi e azzeramento contatori

## Obiettivo
Estende il modulo Presenze/Timbature aggiunto nella Patch 8B con le funzioni richieste per owner/admin:

- timbrare entrata/uscita per qualsiasi membro staff;
- modificare una timbratura di qualsiasi membro;
- vedere statistiche e riepiloghi per utente;
- azzerare il contatore ore di un utente senza cancellare lo storico;
- registrare se inviare o meno notifica/conferma all'utente dopo l'azzeramento.

## File modificati

- `app/attendance/page.tsx`
- `db/attendance_admin_counters_patch.sql`

## Nuove funzioni database

La patch SQL crea:

- `attendance_counter_resets`
- `attendance_admin_clock_in(...)`
- `attendance_admin_clock_out(...)`
- `attendance_admin_update_record(...)`
- `attendance_reset_counter(...)`
- `attendance_staff_summary(...)`

## Cosa fa l'azzeramento

L'azzeramento non elimina né modifica le timbrature storiche. Crea un nuovo record in `attendance_counter_resets` e da quel momento il contatore “Ore periodo” riparte da zero per il membro scelto.

Rimangono sempre disponibili:

- ore totali storiche;
- numero timbrature;
- giorni lavorati;
- timbrature archiviate.

## Notifica utente

L'opzione “Registra richiesta notifica all'utente” salva nel database la scelta `notify_user = true` e `notification_status = requested`.

In questa fase non viene ancora inviato un messaggio automatico/email perché la webapp non ha ancora un sistema notifiche dedicato. La traccia è però già pronta per una prossima integrazione notifiche/email.

## Query Supabase da eseguire

Dopo aver caricato i file, eseguire solo:

```sql
db/attendance_admin_counters_patch.sql
```

Non rilanciare le patch precedenti.

## Test consigliati

1. Entrare con utente owner/admin.
2. Aprire Presenze.
3. Usare “Timbratura staff” per registrare entrata a un membro diverso dall'utente corrente.
4. Registrare uscita dello stesso membro.
5. Modificare una timbratura dalla vista storico/schede.
6. Verificare il riepilogo ore per utente.
7. Usare “Azzera” su un membro e verificare che:
   - ore periodo ripartano da zero;
   - ore totali restino invariate;
   - ultimo reset sia valorizzato.

## Verifiche tecniche

- `npm ci --ignore-scripts --no-audit --no-fund` OK
- `npx tsc --noEmit --pretty false` OK
- `npm run build` compila CSS/webpack e typecheck, poi nel container va in timeout durante la generazione statica come già visto nelle patch precedenti.
