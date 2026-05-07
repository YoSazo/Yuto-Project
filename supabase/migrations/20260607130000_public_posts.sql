-- Public feed posts: text + optional photo/video + optional tag payload (plan/function/sell/service).

create table if not exists public_posts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  content_text text not null,
  media_url text,
  media_type text check (media_type in ('image', 'video')) ,
  media_thumb_url text,
  tag_payload jsonb,
  created_at timestamptz default now()
);

alter table public_posts enable row level security;

-- Anyone can read public posts
drop policy if exists "Public can view public posts" on public_posts;
create policy "Public can view public posts"
  on public_posts
  for select
  using (true);

-- Only authenticated users can create posts (and only for themselves)
drop policy if exists "Users can create public posts" on public_posts;
create policy "Users can create public posts"
  on public_posts
  for insert
  with check (auth.uid() = user_id);

create index if not exists idx_public_posts_created_at on public_posts(created_at desc);

