# P2.2.2 — Pilota predefinito per dispositivo

## Cosa cambia
- Ogni dispositivo connesso può avere un `default_driver_id` opzionale.
- I nuovi turni creati da una `connected_session` ereditano automaticamente il pilota predefinito, se presente.
- Il pilota resta modificabile manualmente sul singolo turno.
- La pagina **Mezzi connessi** permette di impostare/modificare il pilota predefinito anche sui device esistenti.
- Durante la creazione di un nuovo device è possibile scegliere subito il pilota predefinito.

## Database
La migration `20260824162820_p2_default_driver_for_connected_device.sql` è già applicata sul progetto Supabase live.
**Non eseguire SQL manualmente.**

## File applicativo
Sovrascrivere:
- `app/connected-devices/page.tsx`

Poi commit + push e verifica build Vercel.
