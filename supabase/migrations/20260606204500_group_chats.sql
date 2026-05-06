-- Group chats (distinct from wallet "yuto" groups)

create table if not exists group_chats (
  id uuid default gen_random_uuid() primary key,
  created_by uuid references profiles(id) on delete cascade not null,
  title text default 'Group chat',
  created_at timestamptz default now()
);

create table if not exists group_chat_members (
  group_id uuid references group_chats(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  joined_at timestamptz default now(),
  primary key (group_id, user_id)
);

create index if not exists group_chat_members_user on group_chat_members(user_id);

create table if not exists group_chat_messages (
  id uuid default gen_random_uuid() primary key,
  group_id uuid references group_chats(id) on delete cascade not null,
  sender_id uuid references profiles(id) on delete cascade not null,
  content text not null,
  created_at timestamptz default now()
);

create index if not exists group_chat_messages_group_created on group_chat_messages(group_id, created_at);

alter table group_chats enable row level security;
alter table group_chat_members enable row level security;
alter table group_chat_messages enable row level security;

-- Can read chats you're a member of
create policy "Members can read their group chats" on group_chats
  for select using (
    id in (select group_id from group_chat_members where user_id = auth.uid())
  );

-- Creators must see the row before members exist (RETURNING + member-insert EXISTS subquery runs SELECT with RLS)
create policy "Creators can read their group chats" on group_chats
  for select using (auth.uid() = created_by);

create policy "Users can create group chats" on group_chats
  for insert with check (auth.uid() = created_by);

-- Only read your own membership rows (avoid self-referential SELECT policy → infinite recursion 42P17)
create policy "Members can read own membership row" on group_chat_members
  for select using (user_id = auth.uid());

create policy "Creator can add group members" on group_chat_members
  for insert with check (
    exists (
      select 1 from group_chats g
      where g.id = group_chat_members.group_id and g.created_by = auth.uid()
    )
  );

create policy "Users can leave a group chat" on group_chat_members
  for delete using (auth.uid() = user_id);

-- Messages
create policy "Members can read group chat messages" on group_chat_messages
  for select using (
    group_id in (select group_id from group_chat_members where user_id = auth.uid())
  );

create policy "Members can send group chat messages" on group_chat_messages
  for insert with check (
    auth.uid() = sender_id
    and group_id in (select group_id from group_chat_members where user_id = auth.uid())
  );

alter publication supabase_realtime add table group_chat_messages;
