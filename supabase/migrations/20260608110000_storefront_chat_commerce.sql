-- Storefront: listing lifecycle, DM listing charges (trust vs held), safety primitives.

-- ─── functions.listing_status (sell/service listings only; events ignore) ───
alter table public.functions
  add column if not exists listing_status text default 'active';

update public.functions
  set listing_status = 'active'
  where listing_status is null
    and location in ('__SELL__', '__SERVICE__');

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'functions_listing_status_check'
  ) then
    alter table public.functions
      add constraint functions_listing_status_check
      check (listing_status is null or listing_status in ('active', 'sold', 'paused'));
  end if;
end $$;

-- ─── DM charge rows (chat commerce) ───
create table if not exists public.listing_dm_charges (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.dm_conversations(id) on delete cascade,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  amount_kes integer not null check (amount_kes > 0),
  release_mode text not null check (release_mode in ('trust', 'held')),
  function_id uuid references public.functions(id) on delete set null,
  note text,
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'released', 'cancelled')),
  buyer_tx_id uuid references public.transactions(id) on delete set null,
  seller_tx_id uuid references public.transactions(id) on delete set null,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  released_at timestamptz
);

create index if not exists listing_dm_charges_conversation_idx
  on public.listing_dm_charges(conversation_id, created_at desc);

alter table public.listing_dm_charges enable row level security;

create policy "Participants read listing_dm_charges"
  on public.listing_dm_charges for select
  using (
    auth.uid() = seller_id or auth.uid() = buyer_id
  );

-- Writes only via SECURITY DEFINER RPCs (no direct insert policy).

-- ─── dm_messages: allow charge bubbles ───
alter table public.dm_messages drop constraint if exists dm_messages_type_check;
alter table public.dm_messages
  add constraint dm_messages_type_check
  check (message_type in ('text', 'share', 'charge'));

-- ─── Blocks & reports (minimal) ───
create table if not exists public.user_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

alter table public.user_blocks enable row level security;

create policy "Users manage own blocks"
  on public.user_blocks for all
  using (auth.uid() = blocker_id)
  with check (auth.uid() = blocker_id);

create table if not exists public.user_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_user_id uuid references public.profiles(id) on delete set null,
  reason text not null,
  context text,
  created_at timestamptz not null default now()
);

alter table public.user_reports enable row level security;

create policy "Users insert own reports"
  on public.user_reports for insert
  with check (auth.uid() = reporter_id);

create policy "Users read own reports"
  on public.user_reports for select
  using (auth.uid() = reporter_id);

-- ─── RPC: seller creates a charge (client then inserts dm message type charge) ───
create or replace function public.create_listing_dm_charge(
  p_conversation_id uuid,
  p_buyer_id uuid,
  p_amount_kes integer,
  p_release_mode text,
  p_function_id uuid,
  p_note text
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_seller uuid := auth.uid();
  v_low uuid;
  v_high uuid;
  v_id uuid;
begin
  if v_seller is null then
    raise exception 'Not authenticated';
  end if;
  if p_buyer_id is null or p_buyer_id = v_seller then
    raise exception 'Invalid buyer';
  end if;
  if p_amount_kes is null or p_amount_kes <= 0 then
    raise exception 'Invalid amount';
  end if;
  if p_release_mode not in ('trust', 'held') then
    raise exception 'Invalid release mode';
  end if;

  select user_low, user_high into v_low, v_high
  from public.dm_conversations
  where id = p_conversation_id;

  if not found then
    raise exception 'Conversation not found';
  end if;

  if not (
    (v_seller = v_low and p_buyer_id = v_high)
    or (v_seller = v_high and p_buyer_id = v_low)
  ) then
    raise exception 'Not a participant in this conversation';
  end if;

  if p_function_id is not null then
    if not exists (
      select 1 from public.functions f
      where f.id = p_function_id
        and f.host_id = v_seller
        and f.location in ('__SELL__', '__SERVICE__')
    ) then
      raise exception 'Listing not found or not yours';
    end if;
  end if;

  insert into public.listing_dm_charges (
    conversation_id, seller_id, buyer_id, amount_kes, release_mode, function_id, note, status
  )
  values (
    p_conversation_id, v_seller, p_buyer_id, p_amount_kes, p_release_mode,
    p_function_id, nullif(trim(coalesce(p_note, '')), ''), 'pending'
  )
  returning id into v_id;

  return v_id;
end;
$fn$;

-- ─── Wallet helpers (mirror transfer_yuto_balance debit/credit paths) ───
create or replace function public.pay_listing_dm_charge(p_charge_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_buyer uuid := auth.uid();
  v_charge record;
  v_amt numeric;
  v_from_wallet_id uuid;
  v_to_wallet_id uuid;
  v_from_bal numeric;
  v_fn_title text;
  v_buy_tx_id uuid;
  v_sell_tx_id uuid;
begin
  if v_buyer is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_charge
  from public.listing_dm_charges
  where id = p_charge_id
  for update;

  if not found then
    raise exception 'Charge not found';
  end if;

  if v_charge.buyer_id <> v_buyer then
    raise exception 'Only the buyer can pay';
  end if;

  if v_charge.status <> 'pending' then
    raise exception 'This charge is no longer payable';
  end if;

  v_amt := v_charge.amount_kes::numeric;

  -- Debit buyer (same paths as transfer_yuto_balance)
  select w.id, w.balance::numeric
    into v_from_wallet_id, v_from_bal
  from public.wallets w
  where w.user_id = v_buyer
  limit 1
  for update;

  if v_from_wallet_id is null then
    select w.id, w.balance::numeric
      into v_from_wallet_id, v_from_bal
    from public.wallets w
    where w.id = v_buyer
    limit 1
    for update;
  end if;

  if v_from_wallet_id is not null then
    if coalesce(v_from_bal, 0) < v_amt then
      raise exception 'Insufficient Yuto balance';
    end if;
    update public.wallets w
    set balance = w.balance - v_amt
    where w.id = v_from_wallet_id and w.balance::numeric >= v_amt;
    if not found then
      raise exception 'Insufficient Yuto balance';
    end if;
  else
    if (select coalesce(p.balance, 0)::numeric from public.profiles p where p.id = v_buyer) < v_amt then
      raise exception 'Insufficient Yuto balance';
    end if;
    update public.profiles p
    set balance = p.balance - v_amt
    where p.id = v_buyer and coalesce(p.balance, 0)::numeric >= v_amt;
    if not found then
      raise exception 'Insufficient Yuto balance';
    end if;
  end if;

  if v_charge.function_id is not null then
    select title into v_fn_title from public.functions where id = v_charge.function_id;
  end if;

  if v_charge.release_mode = 'trust' then
    -- Credit seller immediately
    select w.id into v_to_wallet_id
    from public.wallets w
    where w.user_id = v_charge.seller_id
    limit 1
    for update;

    if v_to_wallet_id is null then
      select w.id into v_to_wallet_id
      from public.wallets w
      where w.id = v_charge.seller_id
      limit 1
      for update;
    end if;

    if v_to_wallet_id is not null then
      update public.wallets w set balance = w.balance + v_amt where w.id = v_to_wallet_id;
    else
      begin
        insert into public.wallets (user_id, balance)
        values (v_charge.seller_id, v_amt)
        returning id into v_to_wallet_id;
      exception when undefined_table then
        update public.profiles p
        set balance = coalesce(p.balance, 0) + v_amt::integer
        where p.id = v_charge.seller_id;
      end;
    end if;

    insert into public.transactions
      (user_id, amount, kind, note, method, status, counterparty_id, metadata)
    values
      (v_buyer, -v_charge.amount_kes,
       case when v_charge.function_id is not null and exists (
         select 1 from public.functions f where f.id = v_charge.function_id and f.location = '__SERVICE__'
       ) then 'booking_sent' else 'purchase_sent' end,
       coalesce('Paid ' || coalesce(v_fn_title, 'listing'), 'Listing payment'),
       'yuto_balance', 'settled', v_charge.seller_id,
       jsonb_build_object(
         'listing_charge_id', v_charge.id,
         'release_mode', 'trust',
         'function_id', v_charge.function_id
       ))
    returning id into v_buy_tx_id;

    insert into public.transactions
      (user_id, amount, kind, note, method, status, counterparty_id, metadata)
    values
      (v_charge.seller_id, v_charge.amount_kes,
       case when v_charge.function_id is not null and exists (
         select 1 from public.functions f where f.id = v_charge.function_id and f.location = '__SERVICE__'
       ) then 'booking_received' else 'purchase_received' end,
       coalesce('Sale: ' || coalesce(v_fn_title, 'listing'), 'Listing sale'),
       'yuto_balance', 'settled', v_buyer,
       jsonb_build_object(
         'listing_charge_id', v_charge.id,
         'release_mode', 'trust',
         'function_id', v_charge.function_id
       ))
    returning id into v_sell_tx_id;

    update public.listing_dm_charges
    set status = 'released',
        paid_at = now(),
        released_at = now(),
        buyer_tx_id = v_buy_tx_id,
        seller_tx_id = v_sell_tx_id
    where id = v_charge.id;

  else
    -- held: buyer debited; seller credited only on release
    insert into public.transactions
      (user_id, amount, kind, note, method, status, counterparty_id, metadata)
    values
      (v_buyer, -v_charge.amount_kes, 'listing_escrow_out',
       coalesce('Held for: ' || coalesce(v_fn_title, 'handoff'), 'Payment held until handoff'),
       'yuto_balance', 'settled', v_charge.seller_id,
       jsonb_build_object(
         'listing_charge_id', v_charge.id,
         'release_mode', 'held',
         'function_id', v_charge.function_id
       ))
    returning id into v_buy_tx_id;

    insert into public.transactions
      (user_id, amount, kind, note, method, status, counterparty_id, metadata)
    values
      (v_charge.seller_id, v_charge.amount_kes, 'listing_escrow_in',
       coalesce('Pending — ' || coalesce(v_fn_title, 'sale'), 'Funds release when buyer confirms'),
       'yuto_balance', 'pending', v_buyer,
       jsonb_build_object(
         'listing_charge_id', v_charge.id,
         'release_mode', 'held',
         'function_id', v_charge.function_id
       ))
    returning id into v_sell_tx_id;

    update public.listing_dm_charges
    set status = 'paid',
        paid_at = now(),
        buyer_tx_id = v_buy_tx_id,
        seller_tx_id = v_sell_tx_id
    where id = v_charge.id;
  end if;
end;
$fn$;

create or replace function public.release_listing_dm_charge(p_charge_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_uid uuid := auth.uid();
  v_charge record;
  v_amt numeric;
  v_to_wallet_id uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_charge
  from public.listing_dm_charges
  where id = p_charge_id
  for update;

  if not found then
    raise exception 'Charge not found';
  end if;

  if v_charge.release_mode <> 'held' then
    raise exception 'Nothing to release';
  end if;

  if v_charge.status <> 'paid' then
    raise exception 'Not in escrow';
  end if;

  -- Buyer confirms receipt, or seller taps after meetup — allow either participant
  if v_uid <> v_charge.buyer_id and v_uid <> v_charge.seller_id then
    raise exception 'Not allowed';
  end if;

  v_amt := v_charge.amount_kes::numeric;

  select w.id into v_to_wallet_id
  from public.wallets w
  where w.user_id = v_charge.seller_id
  limit 1
  for update;

  if v_to_wallet_id is null then
    select w.id into v_to_wallet_id
    from public.wallets w
    where w.id = v_charge.seller_id
    limit 1
    for update;
  end if;

  if v_to_wallet_id is not null then
    update public.wallets w set balance = w.balance + v_amt where w.id = v_to_wallet_id;
  else
    begin
      insert into public.wallets (user_id, balance)
      values (v_charge.seller_id, v_amt);
    exception when undefined_table then
      update public.profiles p
      set balance = coalesce(p.balance, 0) + v_amt::integer
      where p.id = v_charge.seller_id;
    end;
  end if;

  update public.transactions
  set status = 'settled',
      note = coalesce(note, '') || ' · Released',
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('released_at', now())
  where id = v_charge.seller_tx_id;

  update public.listing_dm_charges
  set status = 'released',
      released_at = now()
  where id = v_charge.id;
end;
$fn$;

create or replace function public.cancel_listing_dm_charge(p_charge_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_seller uuid := auth.uid();
  v_charge record;
begin
  if v_seller is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_charge
  from public.listing_dm_charges
  where id = p_charge_id
  for update;

  if not found then
    raise exception 'Charge not found';
  end if;

  if v_charge.seller_id <> v_seller then
    raise exception 'Only the seller can cancel';
  end if;

  if v_charge.status <> 'pending' then
    raise exception 'Cannot cancel';
  end if;

  update public.listing_dm_charges
  set status = 'cancelled'
  where id = p_charge_id;
end;
$fn$;

create or replace function public.update_function_listing_status(
  p_function_id uuid,
  p_listing_status text
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $fn$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_listing_status not in ('active', 'sold', 'paused') then
    raise exception 'Invalid status';
  end if;

  update public.functions f
  set listing_status = p_listing_status
  where f.id = p_function_id
    and f.host_id = auth.uid()
    and f.location in ('__SELL__', '__SERVICE__');

  if not found then
    raise exception 'Listing not found';
  end if;
end;
$fn$;

grant execute on function public.create_listing_dm_charge(uuid, uuid, integer, text, uuid, text) to authenticated;
grant execute on function public.pay_listing_dm_charge(uuid) to authenticated;
grant execute on function public.release_listing_dm_charge(uuid) to authenticated;
grant execute on function public.cancel_listing_dm_charge(uuid) to authenticated;
grant execute on function public.update_function_listing_status(uuid, text) to authenticated;
