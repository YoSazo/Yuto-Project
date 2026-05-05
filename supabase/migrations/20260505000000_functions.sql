-- Functions feature: public event listings with pay-to-join membership tracking.

create table if not exists functions (
  id uuid default gen_random_uuid() primary key,
  host_id uuid references profiles(id) on delete cascade not null,
  title text not null,
  description text,
  date timestamptz,
  location text,
  amount_per_person integer not null,
  max_capacity integer default null,
  mode text check (mode in ('pay', 'pledge')) default 'pay',
  goal_count integer default null,
  deadline timestamptz default null,
  status text check (status in ('open', 'funded', 'cancelled')) default 'open',
  is_public boolean default true,
  created_at timestamptz default now()
);

create table if not exists function_members (
  id uuid default gen_random_uuid() primary key,
  function_id uuid references functions(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  has_paid boolean default false,
  paid_at timestamptz,
  payment_invoice_id text,
  payment_api_ref text,
  joined_at timestamptz default now(),
  unique(function_id, user_id)
);

alter table functions enable row level security;
alter table function_members enable row level security;

create policy "Public functions can be viewed" on functions
  for select using (
    is_public = true
    or host_id = auth.uid()
    or id in (select function_id from function_members where user_id = auth.uid())
  );

create policy "Users can create functions" on functions
  for insert with check (host_id = auth.uid());

create policy "Hosts can update functions" on functions
  for update using (host_id = auth.uid());

create policy "Hosts can delete functions" on functions
  for delete using (host_id = auth.uid());

create policy "Anyone can view function members" on function_members
  for select using (true);

create policy "Users can join functions" on function_members
  for insert with check (user_id = auth.uid());

create policy "Users can leave functions" on function_members
  for delete using (user_id = auth.uid());

create index if not exists idx_functions_host on functions(host_id);
create index if not exists idx_function_members_function on function_members(function_id);

alter publication supabase_realtime add table functions;
alter publication supabase_realtime add table function_members;