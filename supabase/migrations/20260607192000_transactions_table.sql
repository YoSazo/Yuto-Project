-- Wallet history table (used by ProfileScreen)

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric not null,
  created_at timestamptz not null default now(),
  note text,
  counterparty_id uuid references public.profiles(id) on delete set null,
  kind text
);

create index if not exists transactions_user_created_idx on public.transactions(user_id, created_at desc);

alter table public.transactions enable row level security;

drop policy if exists "transactions_select_own" on public.transactions;
create policy "transactions_select_own"
on public.transactions
for select
to authenticated
using (auth.uid() = user_id);

