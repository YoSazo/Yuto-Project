-- Function Q&A threads: users can ask questions on any public function.

create table if not exists function_messages (
  id uuid default gen_random_uuid() primary key,
  function_id uuid references functions(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  content text not null,
  created_at timestamptz default now()
);

alter table function_messages enable row level security;

create policy "Users can read function messages" on function_messages
  for select using (
    function_id in (
      select id from functions
      where is_public = true
        or host_id = auth.uid()
        or id in (select function_id from function_members where user_id = auth.uid())
    )
  );

create policy "Users can send function messages" on function_messages
  for insert with check (
    auth.uid() = user_id
    and function_id in (
      select id from functions
      where is_public = true
        or host_id = auth.uid()
        or id in (select function_id from function_members where user_id = auth.uid())
    )
  );

create index if not exists idx_function_messages_function_created on function_messages(function_id, created_at);

alter publication supabase_realtime add table function_messages;