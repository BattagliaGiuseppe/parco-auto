# Patch 2 — Turni eventi, salvataggio atomico e contatori ore

Questa patch lavora sul ramo generale e non modifica la logica Telemetria.

## File modificati

- `app/calendar/[eventId]/car/[eventCarId]/turns/page.tsx`
- `db/event_turns_atomic_counters_patch.sql`

## Cosa cambia

### 1. Salvataggio turno atomico

La pagina Turni non salva più prima `event_car_turns` e poi `event_car_turn_metrics` con due operazioni frontend separate.

Ora usa la RPC:

```sql
save_event_car_turn_with_metrics(...)
```

La funzione salva in un'unica transazione:

- turno base;
- metriche tecniche;
- riferimenti team/evento/mezzo/sessione/pilota;
- lascia al trigger il calcolo ore auto/componenti.

Se una parte fallisce, viene annullato tutto.

### 2. Cancellazione turno team-scoped

La pagina Turni usa ora la RPC:

```sql
delete_event_car_turn(...)
```

La cancellazione è vincolata al team e il trigger sottrae automaticamente i minuti dai contatori.

### 3. Trigger contatori consolidato

La patch SQL ricrea il trigger:

```sql
trg_sync_turn_hours_to_assets
```

su `event_car_turns`, con gestione delta per:

- inserimento turno;
- modifica minuti;
- modifica data/ora turno;
- modifica mezzo evento;
- eliminazione turno.

Il delta aggiorna:

- `cars.hours`;
- `cars.total_hours`;
- `car_components.hours_used` per i montaggi attivi alla data/ora del turno;
- `components.hours`;
- `components.life_hours`;
- `components.work_hours`.

### 4. Validazioni lato database

La RPC controlla:

- utente membro del team;
- evento appartenente al team;
- mezzo evento appartenente all'evento corretto;
- sessione appartenente allo stesso evento;
- pilota appartenente allo stesso team;
- minuti maggiori di zero;
- giri non negativi;
- carburante finale non superiore a quello iniziale;
- condizione tracciato valida.

### 5. Piccola chiarezza UI

Nel drawer turno è ora indicato che il salvataggio aggiorna insieme turno, metriche, ore auto e ore componenti.

## Query Supabase da eseguire

Eseguire solo:

```text
db/event_turns_atomic_counters_patch.sql
```

Non serve rilanciare le patch precedenti se sono già state applicate.

## Test consigliati in Vercel Preview

1. Crea un turno da 10 minuti.
2. Verifica che l'auto aumenti di circa 0,17 ore.
3. Verifica che i componenti montati aumentino dello stesso delta.
4. Modifica il turno da 10 a 20 minuti.
5. Verifica che venga aggiunto solo il delta di altri 10 minuti, non 20 completi.
6. Cancella il turno.
7. Verifica che i minuti vengano sottratti dai contatori.
8. Prova a salvare un turno con fuel finale superiore a fuel iniziale: deve bloccarlo.

## Verifiche tecniche eseguite

- `npm ci --ignore-scripts --no-audit --no-fund` completato correttamente.
- `npx tsc --noEmit --pretty false` completato correttamente.
- `npm run build` compila correttamente la fase webpack, poi nel container resta bloccato/va in timeout durante la fase interna Next `Linting and checking validity of types ...`. Il typecheck diretto passa.

## Nota Next.js

Durante `npm ci`, npm segnala ancora che `next@15.5.7` ha una vulnerabilità nota. Non è stato aggiornato in questa patch per evitare di cambiare versione framework insieme alla logica turni.
