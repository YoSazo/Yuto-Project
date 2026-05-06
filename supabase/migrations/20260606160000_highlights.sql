-- Profile highlights (Instagram-like): max 2 per user, 2 photos each.

create table if not exists public.highlights (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  slot smallint not null check (slot in (1, 2)),
  created_at timestamptz default now(),
  unique(user_id, slot)
);

create table if not exists public.highlight_photos (
  id uuid default gen_random_uuid() primary key,
  highlight_id uuid references public.highlights(id) on delete cascade not null,
  url text not null,
  sort_index smallint not null check (sort_index in (1, 2)),
  created_at timestamptz default now(),
  unique(highlight_id, sort_index)
);

alter table public.highlights enable row level security;
alter table public.highlight_photos enable row level security;

-- Anyone signed in can view highlights.
drop policy if exists "Anyone can view highlights" on public.highlights;
create policy "Anyone can view highlights"
on public.highlights for select
to authenticated
using (true);

drop policy if exists "Anyone can view highlight photos" on public.highlight_photos;
create policy "Anyone can view highlight photos"
on public.highlight_photos for select
to authenticated
using (true);

-- Only owners can create/update/delete.
drop policy if exists "Users can manage their highlights" on public.highlights;
create policy "Users can manage their highlights"
on public.highlights for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Users can manage their highlight photos" on public.highlight_photos;
create policy "Users can manage their highlight photos"
on public.highlight_photos for all
to authenticated
using (highlight_id in (select id from public.highlights where user_id = auth.uid()))
with check (highlight_id in (select id from public.highlights where user_id = auth.uid()));

create index if not exists idx_highlights_user on public.highlights(user_id);
create index if not exists idx_highlight_photos_highlight on public.highlight_photos(highlight_id);

-- Realtime
alter publication supabase_realtime add table public.highlights;
alter publication supabase_realtime add table public.highlight_photos;

