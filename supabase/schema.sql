-- Yuto App Database Schema
-- Run this in your Supabase SQL Editor (https://supabase.com → SQL Editor)
--
-- ALSO DO THIS IN THE DASHBOARD:
--   1. Auth → Settings → Email → DISABLE "Confirm email"
--   2. Auth → Settings → Email → DISABLE "Enable email confirmations"
--      (This lets username+password sign-up work without email verification)

-- ─── Tables ──────────────────────────────────────────

create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique not null,
  display_name text not null,
  avatar_url text,
  created_at timestamptz default now()
);

create table if not exists friendships (
  id uuid default gen_random_uuid() primary key,
  requester_id uuid references profiles(id) on delete cascade not null,
  addressee_id uuid references profiles(id) on delete cascade not null,
  status text check (status in ('pending', 'accepted', 'declined')) default 'pending',
  created_at timestamptz default now(),
  unique(requester_id, addressee_id)
);

create table if not exists groups (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  total_amount integer not null default 0,
  per_person integer not null default 0,
  created_by uuid references profiles(id) on delete cascade not null,
  status text check (status in ('active', 'completed')) default 'active',
  group_type text check (group_type in ('single', 'multi')) default 'single',
  created_at timestamptz default now()
);

create table if not exists group_members (
  id uuid default gen_random_uuid() primary key,
  group_id uuid references groups(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  has_joined boolean default false,
  has_paid boolean default false,
  joined_at timestamptz,
  paid_at timestamptz,
  ride_amount integer default null,
  unique(group_id, user_id)
);

-- ─── Enable RLS ──────────────────────────────────────

alter table profiles enable row level security;
alter table friendships enable row level security;
alter table groups enable row level security;
alter table group_members enable row level security;

-- ─── Functions ───────────────────────────────────────

-- Auto-create profile when a user signs up
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    new.raw_user_meta_data->>'username',
    coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'username')
  );
  return new;
end;
$$ language plpgsql security definer;

-- Helper: returns group IDs for the logged-in user (bypasses RLS for policy use)
create or replace function auth_user_group_ids()
returns setof uuid
language sql
security definer
stable
as $$
  select group_id from group_members where user_id = auth.uid()
$$;

-- ─── Triggers ────────────────────────────────────────

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ─── RLS Policies ────────────────────────────────────

-- Profiles: anyone logged in can search, users update their own
create policy "Anyone can view profiles" on profiles
  for select using (true);
create policy "Users can update own profile" on profiles
  for update using (auth.uid() = id);

-- Friendships: users see their own, can send requests, addressee can respond
create policy "Users can view own friendships" on friendships
  for select using (requester_id = auth.uid() or addressee_id = auth.uid());
create policy "Users can send friend requests" on friendships
  for insert with check (requester_id = auth.uid());
create policy "Addressee can update friendship" on friendships
  for update using (addressee_id = auth.uid());
create policy "Either party can delete friendship" on friendships
  for delete using (requester_id = auth.uid() or addressee_id = auth.uid());

-- Groups: members can view, anyone can create
create policy "Members can view their groups" on groups
  for select using (id in (select auth_user_group_ids()));
create policy "Users can create groups" on groups
  for insert with check (created_by = auth.uid());
create policy "Members can update group totals" on groups
  for update using (
    created_by = auth.uid()
    or id in (select auth_user_group_ids())
  );

-- Group members: members can view co-members, auth users can add, users update own
create policy "Members can view group members" on group_members
  for select using (group_id in (select auth_user_group_ids()));
create policy "Auth users can add members" on group_members
  for insert with check (auth.uid() is not null);
create policy "Users can update own membership" on group_members
  for update using (user_id = auth.uid());

-- ─── Realtime ────────────────────────────────────────

alter publication supabase_realtime add table group_members;
alter publication supabase_realtime add table friendships;
