-- Faster highlight loading: store thumbnail + optional video poster.

alter table public.highlight_photos
  add column if not exists thumb_url text,
  add column if not exists poster_url text;

