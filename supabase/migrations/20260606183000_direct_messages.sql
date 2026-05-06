-- Direct Messages (1:1)

create table if not exists dm_conversations (
  id uuid default gen_random_uuid() primary key,
  user_low uuid references profiles(id) on delete cascade not null,
  user_high uuid references profiles(id) on delete cascade not null,
  created_at timestamptz default now(),
  constraint dm_conversations_distinct_users check (user_low <> user_high)
);

create unique index if not exists dm_conversations_unique_pair on dm_conversations(user_low, user_high);
create index if not exists dm_conversations_user_low on dm_conversations(user_low, created_at desc);
create index if not exists dm_conversations_user_high on dm_conversations(user_high, created_at desc);

create table if not exists dm_messages (
  id uuid default gen_random_uuid() primary key,
  conversation_id uuid references dm_conversations(id) on delete cascade not null,
  sender_id uuid references profiles(id) on delete cascade not null,
  content text not null,
  created_at timestamptz default now()
);

create index if not exists dm_messages_conversation_created on dm_messages(conversation_id, created_at);

alter table dm_conversations enable row level security;
alter table dm_messages enable row level security;

create policy "Users can read their dm conversations" on dm_conversations
  for select using (auth.uid() = user_low or auth.uid() = user_high);

create policy "Users can create dm conversations they belong to" on dm_conversations
  for insert with check (auth.uid() = user_low or auth.uid() = user_high);

create policy "Users can read dm messages for their conversations" on dm_messages
  for select using (
    conversation_id in (
      select id from dm_conversations where auth.uid() = user_low or auth.uid() = user_high
    )
  );

create policy "Users can send dm messages for their conversations" on dm_messages
  for insert with check (
    auth.uid() = sender_id
    and conversation_id in (
      select id from dm_conversations where auth.uid() = user_low or auth.uid() = user_high
    )
  );

alter publication supabase_realtime add table dm_conversations;
alter publication supabase_realtime add table dm_messages;

