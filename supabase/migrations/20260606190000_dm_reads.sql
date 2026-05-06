-- DM read receipts (per-user, per-conversation)

create table if not exists dm_reads (
  conversation_id uuid references dm_conversations(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  last_read_at timestamptz default now() not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  primary key (conversation_id, user_id)
);

create index if not exists dm_reads_user on dm_reads(user_id, updated_at desc);

alter table dm_reads enable row level security;

create policy "Users can read their dm read state" on dm_reads
  for select using (auth.uid() = user_id);

create policy "Users can upsert their dm read state" on dm_reads
  for insert with check (auth.uid() = user_id);

create policy "Users can update their dm read state" on dm_reads
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter publication supabase_realtime add table dm_reads;

