alter table public.highlights
add column if not exists commerce_payload jsonb;

