-- Server-side read receipts for plan + function chats.
--
-- Until now, plan/function "seen" state lived in localStorage (see
-- src/pages/home/threadStorage.ts). That meant unread state was per-device:
-- read a thread on your phone, the laptop still showed it as unread.
--
-- This mirrors the existing dm_reads / group_chat_reads pattern so unread
-- truth is the same on every device, and the bottom-nav red dot stops lying.

create table if not exists public.plan_reads (
  plan_id uuid references public.plans(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  last_read_at timestamptz default now() not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  primary key (plan_id, user_id)
);

create index if not exists plan_reads_user_idx on public.plan_reads(user_id, updated_at desc);

alter table public.plan_reads enable row level security;

drop policy if exists "Users can read their plan read state" on public.plan_reads;
create policy "Users can read their plan read state" on public.plan_reads
  for select using (auth.uid() = user_id);

drop policy if exists "Users can upsert their plan read state" on public.plan_reads;
create policy "Users can upsert their plan read state" on public.plan_reads
  for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update their plan read state" on public.plan_reads;
create policy "Users can update their plan read state" on public.plan_reads
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.function_reads (
  function_id uuid references public.functions(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  last_read_at timestamptz default now() not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  primary key (function_id, user_id)
);

create index if not exists function_reads_user_idx on public.function_reads(user_id, updated_at desc);

alter table public.function_reads enable row level security;

drop policy if exists "Users can read their function read state" on public.function_reads;
create policy "Users can read their function read state" on public.function_reads
  for select using (auth.uid() = user_id);

drop policy if exists "Users can upsert their function read state" on public.function_reads;
create policy "Users can upsert their function read state" on public.function_reads
  for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update their function read state" on public.function_reads;
create policy "Users can update their function read state" on public.function_reads
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Realtime so cross-device unread state flips instantly without a refresh.
do $$
begin
  begin
    alter publication supabase_realtime add table public.plan_reads;
  exception when duplicate_object then null;
  end;

  begin
    alter publication supabase_realtime add table public.function_reads;
  exception when duplicate_object then null;
  end;
end$$;
