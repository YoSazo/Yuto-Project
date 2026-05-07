alter table public.function_members
add column if not exists buyer_confirmed_at timestamptz;

create index if not exists idx_function_members_buyer_confirmed_at
on public.function_members (buyer_confirmed_at);

