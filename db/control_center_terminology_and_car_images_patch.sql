-- Patch 9C.4 - Terminologia Control Center e immagini personalizzate mezzi
-- Aggiunge il campo immagine alle schede mezzo senza alterare le policy RLS esistenti.

alter table public.cars
  add column if not exists image_url text;

comment on column public.cars.image_url is 'URL pubblico dell’immagine personalizzata usata nelle schede mezzo.';
