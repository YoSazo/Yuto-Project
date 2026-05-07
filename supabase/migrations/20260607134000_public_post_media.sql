-- Multi-media attachments for public posts (max 5 enforced in app).

create table if not exists public_post_media (
  id uuid default gen_random_uuid() primary key,
  post_id uuid references public_posts(id) on delete cascade not null,
  idx int not null,
  media_url text not null,
  media_type text check (media_type in ('image', 'video')) not null,
  media_thumb_url text,
  created_at timestamptz default now()
);

create index if not exists idx_public_post_media_post_id on public_post_media(post_id);
create index if not exists idx_public_post_media_post_idx on public_post_media(post_id, idx);

alter table public_post_media enable row level security;

-- Public read
drop policy if exists "Public can view public post media" on public_post_media;
create policy "Public can view public post media"
  on public_post_media
  for select
  using (true);

-- Only the post owner can attach media to their post
drop policy if exists "Users can insert media for own post" on public_post_media;
create policy "Users can insert media for own post"
  on public_post_media
  for insert
  with check (
    exists (
      select 1 from public_posts p
      where p.id = post_id and p.user_id = auth.uid()
    )
  );

-- Only the post owner can delete their media
drop policy if exists "Users can delete media for own post" on public_post_media;
create policy "Users can delete media for own post"
  on public_post_media
  for delete
  using (
    exists (
      select 1 from public_posts p
      where p.id = post_id and p.user_id = auth.uid()
    )
  );

