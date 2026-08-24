# P2.2.2 Driver Display Hotfix

Corregge la discrepanza tra Timeline Turni e "Ultimi turni tecnici".

## Modifica
La card "Ultimi turni tecnici" ora legge il pilota direttamente da `event_car_turns.driver_id` e risolve il nome dall'elenco piloti del team, invece di cercarlo soltanto in `event_car_drivers`.

## File da sovrascrivere
- `app/calendar/[eventId]/car/[eventCarId]/page.tsx`

Nessuna modifica SQL / Supabase richiesta.
