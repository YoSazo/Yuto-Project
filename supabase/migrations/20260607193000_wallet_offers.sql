-- Wallet "Send" offers for chat (+ Send tab)
-- DM: recipient_user_id is set; only that user can accept.
-- Group chat: recipient_user_id is null; first eligible member to accept gets it.

create table if not exists public.wallet_offers (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_user_id uuid references public.profiles(id) on delete set null,
  dm_conversation_id uuid references public.dm_conversations(id) on delete cascade,
  group_chat_id uuid references public.group_chats(id) on delete cascade,
  amount_kes numeric not null,
  note text,
  status text not null default 'pending', -- pending | accepted | cancelled
  accepted_by uuid references public.profiles(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  constraint wallet_offers_context check (
    (dm_conversation_id is not null and group_chat_id is null)
    or (dm_conversation_id is null and group_chat_id is not null)
  )
);

create index if not exists wallet_offers_sender_created_idx on public.wallet_offers(sender_id, created_at desc);
create index if not exists wallet_offers_dm_idx on public.wallet_offers(dm_conversation_id, created_at desc);
create index if not exists wallet_offers_group_idx on public.wallet_offers(group_chat_id, created_at desc);

alter table public.wallet_offers enable row level security;

-- Only participants can read offers for their DM; only members can read offers for a group chat.
drop policy if exists "wallet_offers_select_participants" on public.wallet_offers;
create policy "wallet_offers_select_participants"
on public.wallet_offers
for select
to authenticated
using (
  sender_id = auth.uid()
  or recipient_user_id = auth.uid()
  or (
    dm_conversation_id is not null
    and dm_conversation_id in (
      select id from public.dm_conversations c where auth.uid() = c.user_low or auth.uid() = c.user_high
    )
  )
  or (
    group_chat_id is not null
    and group_chat_id in (select group_id from public.group_chat_members where user_id = auth.uid())
  )
);

-- Sender can cancel their own pending offers (no direct delete; we update status in RPC).
drop policy if exists "wallet_offers_update_sender" on public.wallet_offers;
create policy "wallet_offers_update_sender"
on public.wallet_offers
for update
to authenticated
using (sender_id = auth.uid())
with check (sender_id = auth.uid());

-- Realtime updates for accept status flips.
alter publication supabase_realtime add table public.wallet_offers;

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
set search_path = public
as $$
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
  if (p_dm_conversation_id is null and p_group_chat_id is null) or (p_dm_conversation_id is not null and p_group_chat_id is not null) then
    raise exception 'Must provide exactly one context (dm or group chat)';
  end if;
  if p_dm_conversation_id is not null then
    if p_recipient_user_id is null then
      raise exception 'Recipient is required for DM send';
    end if;
    -- Ensure sender belongs to the DM conversation.
    if not exists (
      select 1 from public.dm_conversations c
      where c.id = p_dm_conversation_id and (v_sender = c.user_low or v_sender = c.user_high)
    ) then
      raise exception 'Not a participant in this DM';
    end if;
    -- Recipient must be the other participant.
    if not exists (
      select 1 from public.dm_conversations c
      where c.id = p_dm_conversation_id
        and ((c.user_low = v_sender and c.user_high = p_recipient_user_id) or (c.user_high = v_sender and c.user_low = p_recipient_user_id))
    ) then
      raise exception 'Recipient is not in this DM';
    end if;
  else
    -- Ensure sender is in the group chat.
    if not exists (select 1 from public.group_chat_members m where m.group_id = p_group_chat_id and m.user_id = v_sender) then
      raise exception 'Not a member of this group chat';
    end if;
  end if;

  -- Deduct (lock) funds from sender (wallets table if present, else profiles.balance).
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
    update public.profiles set balance = coalesce(balance, 0) - v_amount where id = v_sender;
  end;

  insert into public.wallet_offers(sender_id, recipient_user_id, dm_conversation_id, group_chat_id, amount_kes, note, status)
  values (v_sender, p_recipient_user_id, p_dm_conversation_id, p_group_chat_id, v_amount, p_note, 'pending')
  returning id into v_offer_id;

  -- Best-effort transaction history row for sender.
  begin
    insert into public.transactions(user_id, amount, kind, created_at, note)
    values (v_sender, -v_amount, 'wallet_offer_sent', now(), p_note);
  exception when undefined_table or undefined_column then
    null;
  end;

  return v_offer_id;
end;
$$;

create or replace function public.accept_wallet_offer(p_offer_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_offer record;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  select *
  into v_offer
  from public.wallet_offers
  where id = p_offer_id
  for update;

  if not found then
    raise exception 'Offer not found';
  end if;
  if v_offer.status <> 'pending' then
    raise exception 'Offer already claimed';
  end if;
  if v_offer.sender_id = v_user then
    raise exception 'Sender cannot accept their own offer';
  end if;

  if v_offer.dm_conversation_id is not null then
    if v_offer.recipient_user_id is distinct from v_user then
      raise exception 'Not allowed to accept this offer';
    end if;
  else
    if not exists (select 1 from public.group_chat_members m where m.group_id = v_offer.group_chat_id and m.user_id = v_user) then
      raise exception 'Not a member of this group chat';
    end if;
  end if;

  update public.wallet_offers
  set status = 'accepted', accepted_by = v_user, accepted_at = now()
  where id = p_offer_id;

  -- Credit receiver.
  begin
    insert into public.wallets(user_id, balance) values (v_user, 0) on conflict (user_id) do nothing;
    update public.wallets set balance = balance + v_offer.amount_kes where user_id = v_user;
  exception when undefined_table then
    update public.profiles set balance = coalesce(balance, 0) + v_offer.amount_kes where id = v_user;
  end;

  -- Best-effort transaction history row for receiver.
  begin
    insert into public.transactions(user_id, amount, kind, created_at, note, counterparty_id)
    values (v_user, v_offer.amount_kes, 'wallet_offer_received', now(), v_offer.note, v_offer.sender_id);
  exception when undefined_table or undefined_column then
    null;
  end;
end;
$$;

