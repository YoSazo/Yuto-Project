-- Per-user read pointers for group chats (unread badges)
create table if not exists group_chat_reads (
  group_id uuid references group_chats(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  last_read_at timestamptz default now() not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  primary key (group_id, user_id)
);

create index if not exists group_chat_reads_user on group_chat_reads(user_id, updated_at desc);

alter table group_chat_reads enable row level security;

create policy "Users can read their group read state" on group_chat_reads
  for select using (auth.uid() = user_id);

create policy "Users can insert their group read state" on group_chat_reads
  for insert with check (
    auth.uid() = user_id
    and group_id in (select group_id from group_chat_members where user_id = auth.uid())
  );

create policy "Users can update their group read state" on group_chat_reads
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Member list for inbox UI (avatars); RLS on group_chat_members only exposes own row.
create or replace function public.group_chat_member_ids(p_group_id uuid)
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(user_id order by joined_at nulls last, user_id), '{}'::uuid[])
  from group_chat_members gcm
  where gcm.group_id = p_group_id
    and exists (
      select 1 from group_chat_members me
      where me.group_id = p_group_id and me.user_id = auth.uid()
    );
$$;

grant execute on function public.group_chat_member_ids(uuid) to authenticated;
