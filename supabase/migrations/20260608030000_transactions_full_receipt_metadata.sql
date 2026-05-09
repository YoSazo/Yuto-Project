-- Make every transaction row a real, audit-grade receipt.
--
-- Three problems this migration fixes:
--
-- 1) The transactions table evolved column shapes. Original columns are
--    (type [enum, NOT NULL], description) and were used by the legacy webhook
--    / withdraw / cancel-function inserts. Newer columns (kind, note) were
--    added later and are what ProfileScreen + the receipt modal read. Result:
--    top-ups / withdrawals / refunds DID land in the table, but with kind=NULL
--    and note=NULL, so wallet history shows them as a generic "Money in" line
--    with no detail. We backfill kind/note from type/description so legacy
--    rows get readable labels.
--
-- 2) RPCs like pay_for_function / pay_for_plan / pay_for_function_group don't
--    write a ledger row at all in some code paths, so paying a split via Yuto
--    Balance leaves the user with no receipt.
--
-- 3) When we DO have a row, we only know amount + kind + counterparty + note.
--    Proper receipts need: status (settled / pending / refunded / failed),
--    method (yuto_balance / mpesa_stk / mpesa_b2c / system), and structured
--    metadata (function_id, group_id, plan_id, mpesa_receipt, intasend_id, …).

-- A) Add the new canonical columns. Note: `type` already exists in production
-- as a NOT NULL enum and `description` already exists as text — confirmed via
-- information_schema dump. We do NOT redeclare them here; we only add the new
-- columns that the receipt modal needs.
alter table public.transactions
  add column if not exists status text,
  add column if not exists method text,
  add column if not exists metadata jsonb;

-- A.1) The original `type` column is an enum (NOT NULL). New code paths
-- (payForFunctionWithLedger, payForPlanWithLedger, etc.) write `kind` as a
-- free-form text value like 'function_payment_sent' which is NOT a valid enum
-- member, so they'd otherwise fail the NOT NULL constraint. Drop NOT NULL so
-- new rows can omit `type` entirely; existing rows are untouched.
alter table public.transactions alter column type drop not null;

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
-- `type` is an enum, so we must cast it explicitly to text.
update public.transactions
  set kind = type::text
  where kind is null and type is not null;

update public.transactions
  set note = description
  where note is null and description is not null;

-- C) Trigger that keeps the two shapes in sync on every future insert.
-- Old code that writes (type, description) keeps working — the trigger mirrors
-- those values into (kind, note). New code writes only (kind, note) and we
-- leave `type` null (we made it nullable above). We deliberately do NOT try to
-- coerce kind back into the type enum, because new kinds like
-- 'function_payment_sent' aren't enum members and would raise.
create or replace function public.transactions_normalize_columns()
returns trigger
language plpgsql
as $$
begin
  if NEW.kind is null and NEW.type is not null then
    NEW.kind := NEW.type::text;
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

-- ─────────────────────────────────────────────────────────────────────────────
-- F) Make the payment RPCs atomic. Previously the client called the RPC and
-- THEN wrote ledger rows in a separate request — if the network blipped
-- between those two steps the receipt was missing forever. The RPCs below
-- write the ledger inside the same transaction as the wallet debit, so a
-- successful return always means the receipt exists.
-- ─────────────────────────────────────────────────────────────────────────────

-- F.1) pay_for_function (1-arg) — the version the client actually calls.
-- Preserves the existing debit-from-profiles.balance behaviour. Adds:
--   • buyer outflow row with kind = function_payment_sent / purchase_sent /
--     booking_sent depending on functions.location
--   • host inflow row with the matching _received kind
--   • rich metadata { function_id, function_title, host_id, listing_kind,
--                     per_person_kes }
create or replace function public.pay_for_function(p_function_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user_id   uuid := auth.uid();
  v_amount    integer;
  v_balance   integer;
  v_title     text;
  v_host_id   uuid;
  v_location  text;
  v_listing   text;
  v_kind_buy  text;
  v_kind_host text;
  v_verb      text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select amount_per_person, title, host_id, coalesce(location, '')
  into v_amount, v_title, v_host_id, v_location
  from public.functions
  where id = p_function_id;

  if not found then
    raise exception 'Function not found';
  end if;

  select balance into v_balance
  from public.profiles
  where id = v_user_id;

  if v_balance is null or v_balance < v_amount then
    raise exception 'Insufficient Yuto Balance. You need KSH % but only have KSH %.', v_amount, coalesce(v_balance, 0);
  end if;

  update public.profiles
  set balance = balance - v_amount
  where id = v_user_id;

  insert into public.function_members (function_id, user_id, has_paid, paid_at)
  values (p_function_id, v_user_id, true, now())
  on conflict (function_id, user_id)
  do update set has_paid = true, paid_at = now();

  -- Determine listing kind for prettier history labels.
  if v_location = '__SELL__' then
    v_listing := 'sell'; v_kind_buy := 'purchase_sent'; v_kind_host := 'purchase_received'; v_verb := 'Bought';
  elsif v_location = '__SERVICE__' then
    v_listing := 'service'; v_kind_buy := 'booking_sent'; v_kind_host := 'booking_received'; v_verb := 'Booked';
  else
    v_listing := 'function'; v_kind_buy := 'function_payment_sent'; v_kind_host := 'function_payment_received'; v_verb := 'Paid for';
  end if;

  -- Buyer outflow.
  insert into public.transactions
    (user_id, amount, kind, note, method, status, counterparty_id, metadata)
  values
    (v_user_id, -v_amount, v_kind_buy, v_verb || ': ' || coalesce(v_title, 'function'),
     'yuto_balance', 'settled', v_host_id,
     jsonb_build_object(
       'function_id', p_function_id,
       'function_title', v_title,
       'host_id', v_host_id,
       'listing_kind', v_listing,
       'per_person_kes', v_amount
     ));

  -- Host inflow (informational ledger row — payout itself is deferred).
  if v_host_id is not null and v_host_id <> v_user_id then
    insert into public.transactions
      (user_id, amount, kind, note, method, status, counterparty_id, metadata)
    values
      (v_host_id, v_amount, v_kind_host,
       (case when v_listing = 'sell' then 'Sale: '
             when v_listing = 'service' then 'Booking: '
             else 'Ticket sold: ' end) || coalesce(v_title, 'function'),
       'yuto_balance', 'settled', v_user_id,
       jsonb_build_object(
         'function_id', p_function_id,
         'function_title', v_title,
         'buyer_id', v_user_id,
         'listing_kind', v_listing,
         'per_person_kes', v_amount
       ));
  end if;
end;
$function$;

-- F.2) pay_for_function_group — group ticket purchase. Preserves existing
-- wallet→profiles fallback debit. Adds:
--   • buyer outflow row covering the whole group purchase
--   • one informational "ticket gifted" row per covered friend (amount = 0)
--   • host inflow row for the total revenue
create or replace function public.pay_for_function_group(p_function_id uuid, p_covered_user_ids uuid[])
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_buyer uuid := auth.uid();
  v_amt int;
  v_loc text;
  v_mode text;
  v_status text;
  v_max int;
  v_title text;
  v_host_id uuid;
  v_ids uuid[];
  v_cnt int;
  v_total int;
  v_wallet_id uuid;
  v_bal numeric;
  v_updated int;
  uid uuid;
  v_existing int;
  v_new int;
  v_pay_cnt int;
begin
  if v_buyer is null then
    raise exception 'Not authenticated';
  end if;

  if p_covered_user_ids is null or coalesce(array_length(p_covered_user_ids, 1), 0) = 0 then
    raise exception 'No participants';
  end if;

  select f.amount_per_person, coalesce(f.location, ''), f.mode, f.status, f.max_capacity, f.title, f.host_id
  into v_amt, v_loc, v_mode, v_status, v_max, v_title, v_host_id
  from public.functions f
  where f.id = p_function_id;

  if not found then
    raise exception 'Function not found';
  end if;

  if v_status is distinct from 'open' then
    raise exception 'Function is not open';
  end if;

  if v_mode is distinct from 'pay' then
    raise exception 'Not a paid function';
  end if;

  if v_loc in ('__SELL__', '__SERVICE__') then
    raise exception 'Group checkout is only for event functions';
  end if;

  select coalesce(array_agg(distinct x order by x), array[]::uuid[])
  into v_ids
  from unnest(p_covered_user_ids || array[v_buyer]::uuid[]) as t(x);

  v_cnt := coalesce(array_length(v_ids, 1), 0);
  if v_cnt < 1 then
    raise exception 'Invalid participant list';
  end if;

  if not (v_buyer = any (v_ids)) then
    raise exception 'Buyer must be included';
  end if;

  select coalesce(count(*)::int, 0) into v_pay_cnt
  from unnest(v_ids) u(uid)
  where not exists (
    select 1 from public.function_members fm
    where fm.function_id = p_function_id and fm.user_id = u.uid and fm.has_paid = true
  );

  if v_pay_cnt < 1 then
    raise exception 'No unpaid seats in this checkout';
  end if;

  v_total := v_amt * v_pay_cnt;

  if v_max is not null then
    select count(*)::int into v_existing from public.function_members where function_id = p_function_id;
    select count(*)::int into v_new
    from unnest(v_ids) u(uid)
    where not exists (
      select 1 from public.function_members fm
      where fm.function_id = p_function_id and fm.user_id = u.uid
    );
    if v_existing + v_new > v_max then
      raise exception 'Would exceed event capacity';
    end if;
  end if;

  -- Debit payer (wallets.user_id → wallets.id → profiles.balance fallback).
  select w.id, w.balance::numeric into v_wallet_id, v_bal
  from public.wallets w
  where w.user_id = v_buyer
  limit 1;

  if v_wallet_id is not null then
    if coalesce(v_bal, 0) < v_total then
      raise exception 'Insufficient Yuto balance';
    end if;
    update public.wallets w
    set balance = w.balance - v_total
    where w.id = v_wallet_id and w.balance::numeric >= v_total;
    get diagnostics v_updated = row_count;
    if v_updated <> 1 then
      raise exception 'Insufficient Yuto balance';
    end if;
  else
    select w.id, w.balance::numeric into v_wallet_id, v_bal
    from public.wallets w
    where w.id = v_buyer
    limit 1;

    if v_wallet_id is not null then
      if coalesce(v_bal, 0) < v_total then
        raise exception 'Insufficient Yuto balance';
      end if;
      update public.wallets w
      set balance = w.balance - v_total
      where w.id = v_wallet_id and w.balance::numeric >= v_total;
      get diagnostics v_updated = row_count;
      if v_updated <> 1 then
        raise exception 'Insufficient Yuto balance';
      end if;
    else
      if (select coalesce(p.balance, 0)::numeric from public.profiles p where p.id = v_buyer) < v_total then
        raise exception 'Insufficient Yuto balance';
      end if;
      update public.profiles p
      set balance = p.balance - v_total
      where p.id = v_buyer and coalesce(p.balance, 0)::numeric >= v_total;
      get diagnostics v_updated = row_count;
      if v_updated <> 1 then
        raise exception 'Insufficient Yuto balance';
      end if;
    end if;
  end if;

  -- Mark every covered participant as paid.
  foreach uid in array v_ids loop
    insert into public.function_members (function_id, user_id, has_paid, paid_at, joined_at)
    values (p_function_id, uid, true, now(), now())
    on conflict (function_id, user_id)
    do update set has_paid = true, paid_at = now();
  end loop;

  -- Buyer outflow (single row covering the whole group purchase).
  insert into public.transactions
    (user_id, amount, kind, note, method, status, counterparty_id, metadata)
  values
    (v_buyer, -v_total, 'function_group_payment_sent',
     'Bought ' || v_pay_cnt || ' ticket' || (case when v_pay_cnt = 1 then '' else 's' end) || ' for ' || coalesce(v_title, 'function'),
     'yuto_balance', 'settled', v_host_id,
     jsonb_build_object(
       'function_id', p_function_id,
       'function_title', v_title,
       'host_id', v_host_id,
       'per_person_kes', v_amt,
       'ticket_count', v_pay_cnt,
       'covered_user_ids', to_jsonb(v_ids),
       'total_kes', v_total
     ));

  -- Per-friend "ticket gifted" rows for everyone except the buyer.
  insert into public.transactions
    (user_id, amount, kind, note, method, status, counterparty_id, metadata)
  select
    uid_x, 0, 'function_ticket_gifted',
    'Ticket to ' || coalesce(v_title, 'function') || ' bought for you',
    'yuto_balance', 'settled', v_buyer,
    jsonb_build_object(
      'function_id', p_function_id,
      'function_title', v_title,
      'host_id', v_host_id,
      'per_person_kes', v_amt
    )
  from unnest(v_ids) as t(uid_x)
  where uid_x <> v_buyer;

  -- Host inflow for the total revenue.
  if v_host_id is not null and v_host_id <> v_buyer then
    insert into public.transactions
      (user_id, amount, kind, note, method, status, counterparty_id, metadata)
    values
      (v_host_id, v_total, 'function_payment_received',
       v_pay_cnt || ' ticket' || (case when v_pay_cnt = 1 then '' else 's' end) || ' sold: ' || coalesce(v_title, 'function'),
       'yuto_balance', 'settled', v_buyer,
       jsonb_build_object(
         'function_id', p_function_id,
         'function_title', v_title,
         'buyer_id', v_buyer,
         'per_person_kes', v_amt,
         'ticket_count', v_pay_cnt,
         'total_kes', v_total
       ));
  end if;
end;
$function$;

-- F.3) pay_for_plan — split payment via Yuto Balance. Preserves existing
-- wallet debit + groups.collected_balance accumulation. Adds:
--   • payer outflow row (kind = split_payment_sent)
--   • group owner inflow row (kind = split_payment_received)
create or replace function public.pay_for_plan(p_group_id uuid, p_amount numeric)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_balance     numeric;
  v_user_id     uuid := auth.uid();
  v_owner_id    uuid;
  v_group_name  text;
  v_plan_id     uuid;
  v_plan_title  text;
  v_payer_name  text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select coalesce(display_name, username, 'Someone') into v_payer_name
  from public.profiles where id = v_user_id;

  select balance into v_balance
  from public.wallets
  where user_id = v_user_id
  for update;

  if v_balance is null then
    raise exception 'No Yuto Balance wallet found. Please top up first.';
  end if;

  if v_balance < p_amount then
    raise exception 'Insufficient Yuto Balance (have %, need %)', v_balance, p_amount;
  end if;

  update public.wallets
  set balance = balance - p_amount, updated_at = now()
  where user_id = v_user_id;

  update public.groups
  set collected_balance = coalesce(collected_balance, 0) + p_amount
  where id = p_group_id;

  update public.group_members
  set has_paid = true, paid_at = now()
  where group_id = p_group_id and user_id = v_user_id;

  -- Pull group + plan context for richer receipts.
  select g.owner_id, g.name, g.plan_id
  into v_owner_id, v_group_name, v_plan_id
  from public.groups g
  where g.id = p_group_id;

  if v_plan_id is not null then
    select p.title into v_plan_title from public.plans p where p.id = v_plan_id;
  end if;

  -- Payer outflow.
  insert into public.transactions
    (user_id, amount, kind, note, method, status, counterparty_id, metadata)
  values
    (v_user_id, -p_amount, 'split_payment_sent',
     coalesce('Paid split: ' || nullif(v_plan_title, ''), 'Paid split: ' || coalesce(v_group_name, 'Split')),
     'yuto_balance', 'settled', v_owner_id,
     jsonb_build_object(
       'group_id', p_group_id,
       'group_name', v_group_name,
       'plan_id', v_plan_id,
       'plan_title', v_plan_title,
       'per_person_kes', p_amount
     ));

  -- Owner inflow (informational; collected_balance already reflects it).
  if v_owner_id is not null and v_owner_id <> v_user_id then
    insert into public.transactions
      (user_id, amount, kind, note, method, status, counterparty_id, metadata)
    values
      (v_owner_id, p_amount, 'split_payment_received',
       coalesce(v_payer_name || ' paid for: ' || nullif(v_plan_title, ''), v_payer_name || ' paid: ' || coalesce(v_group_name, 'Split')),
       'yuto_balance', 'settled', v_user_id,
       jsonb_build_object(
         'group_id', p_group_id,
         'group_name', v_group_name,
         'plan_id', v_plan_id,
         'plan_title', v_plan_title,
         'per_person_kes', p_amount
       ));
  end if;

  -- Update group status to 'completed' if everyone has paid.
  -- (Matches logic in api/webhook.ts)
  if not exists (
    select 1 from public.group_members
    where group_id = p_group_id and has_paid = false
  ) then
    update public.groups
    set status = 'completed'
    where id = p_group_id;
  end if;

  return true;
end;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- G) Wallet plumbing RPCs — same migration so their ledger rows are always
--    receipt-grade (no client second-guess, no silent best-effort drops).
-- ─────────────────────────────────────────────────────────────────────────────

-- G.1) create_wallet_offer — lock sender funds, create offer, one sender row.
create or replace function public.create_wallet_offer(
  p_amount_kes numeric,
  p_note text default null,
  p_dm_conversation_id uuid default null,
  p_group_chat_id uuid default null,
  p_recipient_user_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_sender uuid := auth.uid();
  v_amount numeric := coalesce(p_amount_kes, 0);
  v_offer_id uuid;
  v_balance numeric := null;
begin
  if v_sender is null then
    raise exception 'Not authenticated';
  end if;
  if v_amount <= 0 then
    raise exception 'Amount must be positive';
  end if;
  if (p_dm_conversation_id is null and p_group_chat_id is null)
     or (p_dm_conversation_id is not null and p_group_chat_id is not null) then
    raise exception 'Must provide exactly one context (dm or group chat)';
  end if;
  if p_dm_conversation_id is not null then
    if p_recipient_user_id is null then
      raise exception 'Recipient is required for DM send';
    end if;
    if not exists (
      select 1 from public.dm_conversations c
      where c.id = p_dm_conversation_id and (v_sender = c.user_low or v_sender = c.user_high)
    ) then
      raise exception 'Not a participant in this DM';
    end if;
    if not exists (
      select 1 from public.dm_conversations c
      where c.id = p_dm_conversation_id
        and (
          (c.user_low = v_sender and c.user_high = p_recipient_user_id)
          or (c.user_high = v_sender and c.user_low = p_recipient_user_id)
        )
    ) then
      raise exception 'Recipient is not in this DM';
    end if;
  else
    if not exists (
      select 1 from public.group_chat_members m
      where m.group_id = p_group_chat_id and m.user_id = v_sender
    ) then
      raise exception 'Not a member of this group chat';
    end if;
  end if;

  begin
    select balance into v_balance from public.wallets where user_id = v_sender for update;
    if v_balance is null then v_balance := 0; end if;
    if v_balance < v_amount then
      raise exception 'Insufficient balance' using errcode = 'P0001';
    end if;
    update public.wallets set balance = balance - v_amount where user_id = v_sender;
  exception when undefined_table then
    select coalesce(balance, 0) into v_balance from public.profiles where id = v_sender for update;
    if v_balance < v_amount then
      raise exception 'Insufficient balance' using errcode = 'P0001';
    end if;
    update public.profiles
    set balance = coalesce(balance, 0) - v_amount
    where id = v_sender;
  end;

  insert into public.wallet_offers(
    sender_id, recipient_user_id, dm_conversation_id, group_chat_id, amount_kes, note, status
  )
  values (
    v_sender, p_recipient_user_id, p_dm_conversation_id, p_group_chat_id, v_amount, p_note, 'pending'
  )
  returning id into v_offer_id;

  insert into public.transactions
    (user_id, amount, kind, note, method, status, counterparty_id, metadata)
  values
    (v_sender, -v_amount, 'wallet_offer_sent', coalesce(p_note, 'Wallet offer'),
     'yuto_balance', 'pending', p_recipient_user_id,
     jsonb_build_object(
       'offer_id', v_offer_id,
       'context', (case when p_dm_conversation_id is not null then 'dm' else 'group' end),
       'dm_conversation_id', p_dm_conversation_id,
       'group_chat_id', p_group_chat_id
     ));

  return v_offer_id;
end;
$function$;

-- G.2) initiate_withdrawal (profiles) — used when balance lives on profiles.
create or replace function public.initiate_withdrawal(p_amount integer)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_tx_id uuid := gen_random_uuid();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if (select balance from public.profiles where id = v_user_id) < p_amount then
    raise exception 'Insufficient balance';
  end if;

  update public.profiles set balance = balance - p_amount where id = v_user_id;

  insert into public.transactions
    (id, user_id, amount, kind, note, method, status, metadata)
  values
    (v_tx_id, v_user_id, -p_amount, 'withdrawal',
     'Withdrawal to M-PESA (pending)',
     'mpesa_b2c', 'pending',
     jsonb_build_object('withdrawal_source', 'profiles'));

  return v_tx_id;
end;
$function$;

-- G.3) initiate_withdrawal (wallets)
create or replace function public.initiate_withdrawal(p_amount numeric)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_balance numeric;
  v_transaction_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select balance into v_balance from public.wallets where user_id = v_user_id for update;

  if v_balance is null or v_balance < p_amount then
    raise exception 'Insufficient balance for withdrawal.';
  end if;

  update public.wallets
  set balance = balance - p_amount, updated_at = now()
  where user_id = v_user_id;

  insert into public.transactions
    (user_id, amount, kind, note, method, status, metadata)
  values
    (v_user_id, -p_amount, 'withdrawal', 'Withdrawal to M-PESA (processing)', 'mpesa_b2c', 'pending',
     jsonb_build_object('withdrawal_source', 'wallets'))
  returning id into v_transaction_id;

  return v_transaction_id;
end;
$function$;

-- G.4) process_topup — idempotent on reference_id; canonical top-up row.
create or replace function public.process_topup(
  p_user_id uuid,
  p_amount numeric,
  p_reference_id text
)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if exists (select 1 from public.transactions where reference_id = p_reference_id) then
    return true;
  end if;

  update public.wallets
  set balance = balance + p_amount, updated_at = now()
  where user_id = p_user_id;

  insert into public.transactions
    (user_id, amount, kind, note, method, status, reference_id, metadata)
  values
    (p_user_id, p_amount, 'topup', 'M-PESA top-up', 'mpesa_stk', 'settled', p_reference_id,
     jsonb_build_object('source', 'process_topup'));

  return true;
end;
$function$;

-- G.5) refund_failed_withdrawal — refund to the same balance store the pending
-- withdrawal debited (profiles vs wallets). Marks the row refunded for receipts.
create or replace function public.refund_failed_withdrawal(p_transaction_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_amt numeric;
  v_user_id uuid;
  v_src text;
begin
  select abs(amount::numeric), user_id,
         coalesce(metadata->>'withdrawal_source', '')
  into v_amt, v_user_id, v_src
  from public.transactions
  where id = p_transaction_id;

  if not found then
    raise exception 'Transaction not found';
  end if;

  if v_src = 'wallets' then
    update public.wallets
    set balance = balance + v_amt, updated_at = now()
    where user_id = v_user_id;
    if not found then
      -- Row missing: fall back so user is not stranded.
      update public.profiles
      set balance = coalesce(balance, 0) + round(v_amt)::integer
      where id = v_user_id;
    end if;
  else
    update public.profiles
    set balance = coalesce(balance, 0) + round(v_amt)::integer
    where id = v_user_id;
  end if;

  update public.transactions
  set
    kind = coalesce(kind, 'withdrawal'),
    note = 'Withdrawal failed — refunded to balance',
    status = 'refunded',
    metadata = coalesce(metadata, '{}'::jsonb)
      || jsonb_build_object('refund_reason', 'withdrawal_failed')
  where id = p_transaction_id;
end;
$function$;

-- G.6) refund_payout_balance — IntaSend payout failure returns funds to group pool.
create or replace function public.refund_payout_balance(
  p_user_id uuid,
  p_amount integer,
  p_group_id uuid
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  update public.groups
  set collected_balance = collected_balance + p_amount
  where id = p_group_id;

  insert into public.transactions
    (user_id, amount, kind, note, method, status, reference_id, metadata)
  values
    (p_user_id, p_amount, 'payout_refund', 'Payout refund (IntaSend failed)', 'system', 'settled',
     p_group_id::text,
     jsonb_build_object('group_id', p_group_id, 'refund_reason', 'intasend_failed'));
end;
$function$;

-- G.7) topup_balance (current user, profiles only — dev / legacy path)
create or replace function public.topup_balance(p_amount integer)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if p_amount <= 0 then
    raise exception 'Top-up amount must be greater than zero.';
  end if;

  update public.profiles set balance = balance + p_amount where id = v_uid;

  insert into public.transactions
    (user_id, amount, kind, note, method, status, metadata)
  values
    (v_uid, p_amount, 'balance_credit', 'Balance credit', 'system', 'settled',
     jsonb_build_object('source', 'topup_balance_self'));
end;
$function$;

-- G.8) topup_balance (explicit user — admin / server path)
create or replace function public.topup_balance(p_user_id uuid, p_amount integer)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if p_user_id is null then
    raise exception 'User required';
  end if;
  if p_amount <= 0 then
    raise exception 'Amount must be positive';
  end if;

  update public.profiles set balance = balance + p_amount where id = p_user_id;

  insert into public.transactions
    (user_id, amount, kind, note, method, status, metadata)
  values
    (p_user_id, p_amount, 'topup', 'M-PESA top-up', 'system', 'settled',
     jsonb_build_object('source', 'topup_balance_rpc'));
end;
$function$;

-- G.9) transfer_yuto_balance — peer transfer; two canonical rows in one txn.
create or replace function public.transfer_yuto_balance(
  p_to_user_id uuid,
  p_amount_kes integer,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_from uuid := auth.uid();
  v_amount numeric := coalesce(p_amount_kes, 0);
  v_from_wallet_id uuid;
  v_to_wallet_id uuid;
  v_from_bal numeric;
begin
  if v_from is null then
    raise exception 'Not authenticated';
  end if;
  if p_to_user_id is null then
    raise exception 'Missing recipient';
  end if;
  if p_to_user_id = v_from then
    raise exception 'Cannot send to yourself';
  end if;
  if v_amount <= 0 then
    raise exception 'Amount must be positive';
  end if;

  select w.id, w.balance::numeric
  into v_from_wallet_id, v_from_bal
  from public.wallets w
  where w.user_id = v_from
  limit 1
  for update;

  if v_from_wallet_id is null then
    select w.id, w.balance::numeric
    into v_from_wallet_id, v_from_bal
    from public.wallets w
    where w.id = v_from
    limit 1
    for update;
  end if;

  if v_from_wallet_id is not null then
    if coalesce(v_from_bal, 0) < v_amount then
      raise exception 'Insufficient Yuto balance';
    end if;
    update public.wallets w
    set balance = w.balance - v_amount
    where w.id = v_from_wallet_id and w.balance::numeric >= v_amount;
    if not found then
      raise exception 'Insufficient Yuto balance';
    end if;
  else
    if (select coalesce(p.balance, 0)::numeric from public.profiles p where p.id = v_from) < v_amount then
      raise exception 'Insufficient Yuto balance';
    end if;
    update public.profiles p
    set balance = p.balance - v_amount
    where p.id = v_from and coalesce(p.balance, 0)::numeric >= v_amount;
    if not found then
      raise exception 'Insufficient Yuto balance';
    end if;
  end if;

  select w.id into v_to_wallet_id
  from public.wallets w
  where w.user_id = p_to_user_id
  limit 1
  for update;

  if v_to_wallet_id is null then
    select w.id into v_to_wallet_id
    from public.wallets w
    where w.id = p_to_user_id
    limit 1
    for update;
  end if;

  if v_to_wallet_id is not null then
    update public.wallets w
    set balance = w.balance + v_amount
    where w.id = v_to_wallet_id;
  else
    begin
      insert into public.wallets (user_id, balance)
      values (p_to_user_id, v_amount)
      returning id into v_to_wallet_id;
    exception when undefined_table then
      update public.profiles p
      set balance = coalesce(p.balance, 0) + v_amount
      where p.id = p_to_user_id;
    end;
  end if;

  insert into public.transactions
    (user_id, amount, kind, note, method, status, counterparty_id, metadata)
  values
    (v_from, -v_amount, 'transfer_sent', coalesce(p_note, 'Yuto Balance transfer'),
     'yuto_balance', 'settled', p_to_user_id,
     jsonb_build_object('peer_user_id', p_to_user_id)),
    (p_to_user_id, v_amount, 'transfer_received', coalesce(p_note, 'Yuto Balance transfer'),
     'yuto_balance', 'settled', v_from,
     jsonb_build_object('peer_user_id', v_from));

  insert into public.notifications(
    user_id, actor_id, type, title, body, reference_kind, reference_id, amount_kes, cta_label, cta_action
  )
  values (
    p_to_user_id,
    v_from,
    'wallet_transfer_received',
    'Yuto Balance received',
    coalesce(p_note, 'You received money.'),
    'wallet_transfer',
    v_from::text,
    p_amount_kes,
    'View wallet',
    '/profile'
  );
end;
$function$;
