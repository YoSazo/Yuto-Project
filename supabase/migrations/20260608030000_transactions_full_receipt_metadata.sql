-- Make every transaction row a real, audit-grade receipt.
--
-- Three problems this migration fixes:
--
-- 1) The transactions table only has (kind, note, counterparty_id) but our API
--    code (api/webhook.ts, api/withdraw.ts, api/cancel-function.ts) was written
--    against an earlier shape with (type, description). On the live DB those
--    columns either silently no-op the insert, or the rows live in legacy
--    columns nobody reads anymore. Either way: top-ups, withdrawals, refunds,
--    and referral bonuses are MISSING from wallet history.
--
-- 2) RPCs like pay_for_function / pay_for_plan / pay_for_function_group don't
--    write a ledger row at all in some code paths, so paying a split via Yuto
--    Balance leaves the user with no receipt.
--
-- 3) When we DO have a row, we only know amount + kind + counterparty + note.
--    Proper receipts need: status (settled / pending / refunded / failed),
--    method (yuto_balance / mpesa_stk / mpesa_b2c / system), and structured
--    metadata (function_id, group_id, plan_id, mpesa_receipt, intasend_id, …).

-- A) Make sure both column shapes coexist so legacy and new inserts both work.
alter table public.transactions
  add column if not exists type text,
  add column if not exists description text,
  add column if not exists status text,
  add column if not exists method text,
  add column if not exists metadata jsonb;

-- Sensible defaults so existing logic that doesn't set these still produces
-- well-formed receipts.
update public.transactions
  set status = 'settled'
  where status is null;

update public.transactions
  set method = 'yuto_balance'
  where method is null and (kind is null or kind not in ('topup', 'topup_completed', 'withdraw', 'withdrawal', 'referral_bonus', 'cancellation_refund'));

update public.transactions
  set method = 'mpesa_stk'
  where method is null and kind in ('topup', 'topup_completed');

update public.transactions
  set method = 'mpesa_b2c'
  where method is null and kind in ('withdraw', 'withdrawal');

update public.transactions
  set method = 'system'
  where method is null and kind in ('referral_bonus', 'cancellation_refund');

-- B) Backfill rows that landed in the legacy (type, description) shape into
-- the canonical (kind, note) shape so they show up in the unified history.
update public.transactions
  set kind = coalesce(kind, type)
  where kind is null and type is not null;

update public.transactions
  set note = coalesce(note, description)
  where note is null and description is not null;

-- C) Trigger that keeps the two shapes in sync on every future insert,
-- regardless of which columns the writer used. This means we don't have to
-- redeploy api/* code in lockstep — old code keeps working, new code can use
-- the canonical columns, and the receipt always has data to show.
create or replace function public.transactions_normalize_columns()
returns trigger
language plpgsql
as $$
begin
  if NEW.kind is null and NEW.type is not null then
    NEW.kind := NEW.type;
  end if;
  if NEW.type is null and NEW.kind is not null then
    NEW.type := NEW.kind;
  end if;
  if NEW.note is null and NEW.description is not null then
    NEW.note := NEW.description;
  end if;
  if NEW.description is null and NEW.note is not null then
    NEW.description := NEW.note;
  end if;
  if NEW.status is null then
    NEW.status := 'settled';
  end if;
  if NEW.method is null then
    NEW.method := case
      when NEW.kind in ('topup', 'topup_completed') then 'mpesa_stk'
      when NEW.kind in ('withdraw', 'withdrawal') then 'mpesa_b2c'
      when NEW.kind in ('referral_bonus', 'cancellation_refund') then 'system'
      else 'yuto_balance'
    end;
  end if;
  if NEW.metadata is null then
    NEW.metadata := '{}'::jsonb;
  end if;
  return NEW;
end;
$$;

drop trigger if exists transactions_normalize_columns_trg on public.transactions;
create trigger transactions_normalize_columns_trg
before insert or update on public.transactions
for each row
execute function public.transactions_normalize_columns();

-- D) Useful indexes for the receipt + history surfaces.
create index if not exists transactions_user_kind_idx
  on public.transactions(user_id, kind, created_at desc);

create index if not exists transactions_metadata_gin_idx
  on public.transactions using gin (metadata);

-- E) Realtime so the wallet history modal updates the moment a new row lands
-- (e.g. when an STK push completes via the webhook).
do $$
begin
  begin
    alter publication supabase_realtime add table public.transactions;
  exception when duplicate_object then null;
  end;
end$$;
