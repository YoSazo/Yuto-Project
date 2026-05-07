-- Align create_wallet_offer / accept_wallet_offer balance logic with transfer_yuto_balance:
-- Prefer wallets (user_id, then id); if no wallet row, use profiles.balance.
-- Fixes false "Insufficient balance" when spendable balance lives on profiles but wallets row is missing or zero.

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
  v_from_wallet_id uuid;
  v_from_bal numeric;
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
    if not exists (
      select 1 from public.dm_conversations c
      where c.id = p_dm_conversation_id and (v_sender = c.user_low or v_sender = c.user_high)
    ) then
      raise exception 'Not a participant in this DM';
    end if;
    if not exists (
      select 1 from public.dm_conversations c
      where c.id = p_dm_conversation_id
        and ((c.user_low = v_sender and c.user_high = p_recipient_user_id) or (c.user_high = v_sender and c.user_low = p_recipient_user_id))
    ) then
      raise exception 'Recipient is not in this DM';
    end if;
  else
    if not exists (select 1 from public.group_chat_members m where m.group_id = p_group_chat_id and m.user_id = v_sender) then
      raise exception 'Not a member of this group chat';
    end if;
  end if;

  -- Debit sender (same rules as transfer_yuto_balance)
  begin
    select w.id, w.balance::numeric
      into v_from_wallet_id, v_from_bal
    from public.wallets w
    where w.user_id = v_sender
    limit 1
    for update;

    if v_from_wallet_id is null then
      select w.id, w.balance::numeric
        into v_from_wallet_id, v_from_bal
      from public.wallets w
      where w.id = v_sender
      limit 1
      for update;
    end if;

    if v_from_wallet_id is not null then
      if coalesce(v_from_bal, 0) < v_amount then
        raise exception 'Insufficient balance' using errcode = 'P0001';
      end if;
      update public.wallets w
      set balance = w.balance - v_amount
      where w.id = v_from_wallet_id and w.balance::numeric >= v_amount;
      if not found then
        raise exception 'Insufficient balance' using errcode = 'P0001';
      end if;
    else
      if (select coalesce(p.balance, 0)::numeric from public.profiles p where p.id = v_sender for update) < v_amount then
        raise exception 'Insufficient balance' using errcode = 'P0001';
      end if;
      update public.profiles p
      set balance = p.balance - v_amount
      where p.id = v_sender and coalesce(p.balance, 0)::numeric >= v_amount;
      if not found then
        raise exception 'Insufficient balance' using errcode = 'P0001';
      end if;
    end if;
  exception
    when undefined_table then
      if (select coalesce(p.balance, 0)::numeric from public.profiles p where p.id = v_sender for update) < v_amount then
        raise exception 'Insufficient balance' using errcode = 'P0001';
      end if;
      update public.profiles p
      set balance = p.balance - v_amount
      where p.id = v_sender and coalesce(p.balance, 0)::numeric >= v_amount;
      if not found then
        raise exception 'Insufficient balance' using errcode = 'P0001';
      end if;
  end;

  insert into public.wallet_offers(sender_id, recipient_user_id, dm_conversation_id, group_chat_id, amount_kes, note, status)
  values (v_sender, p_recipient_user_id, p_dm_conversation_id, p_group_chat_id, v_amount, p_note, 'pending')
  returning id into v_offer_id;

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

  -- Credit receiver (wallets preferred; fallback to profiles.balance)
  begin
    insert into public.wallets(user_id, balance)
    values (v_user, 0)
    on conflict (user_id) do nothing;

    update public.wallets w
    set balance = coalesce(w.balance, 0) + v_offer.amount_kes
    where w.user_id = v_user;
  exception when undefined_table then
    update public.profiles p
    set balance = coalesce(p.balance, 0) + v_offer.amount_kes
    where p.id = v_user;
  end;

  begin
    insert into public.transactions(user_id, amount, kind, created_at, note, counterparty_id)
    values (v_user, v_offer.amount_kes, 'wallet_offer_received', now(), v_offer.note, v_offer.sender_id);
  exception when undefined_table or undefined_column then
    null;
  end;
end;
$$;
