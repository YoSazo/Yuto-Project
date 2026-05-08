-- Fix: production transactions table was created earlier than
-- 20260607192000_transactions_table.sql with just (id, user_id, amount,
-- created_at). The `if not exists` clause in that migration silently no-oped
-- on the missing columns, so ProfileScreen's history query and the wallet
-- transfer / wallet offer RPCs all fail with:
--   column "transactions.note" does not exist
--
-- This patches the live shape additively + idempotently.

alter table public.transactions
  add column if not exists note text,
  add column if not exists counterparty_id uuid references public.profiles(id) on delete set null,
  add column if not exists kind text;

create index if not exists transactions_user_created_idx
  on public.transactions(user_id, created_at desc);

-- Re-enable RLS + own-row select policy in case the legacy table predates them.
alter table public.transactions enable row level security;

drop policy if exists "transactions_select_own" on public.transactions;
create policy "transactions_select_own"
on public.transactions
for select
to authenticated
using (auth.uid() = user_id);
