-- Wallet offers should behave like pending promises:
-- creating an offer does not debit the sender; accepting the offer atomically
-- debits the sender and credits the accepter. If the sender no longer has
-- enough balance at accept time, the accept fails and the offer stays pending.

alter table public.wallet_offers
add column if not exists debit_reserved boolean not null default false;

-- Pending offers created before this migration already debited the sender.
-- Mark those as reserved so accepting them credits the receiver without
-- charging the sender a second time.
update public.wallet_offers o
set debit_reserved = true
where o.status = 'pending'
  and o.debit_reserved = false
  and exists (
    select 1
    from public.transactions t
    where t.user_id = o.sender_id
      and t.kind = 'wallet_offer_sent'
      and t.amount = -o.amount_kes
      and (
        t.metadata ->> 'offer_id' = o.id::text
        or (
          t.metadata is null
          and t.created_at >= o.created_at - interval '2 minutes'
          and t.created_at <= o.created_at + interval '2 minutes'
        )
      )
  );

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
as $function$
declare
  v_sender uuid := auth.uid();
  v_amount numeric := round(coalesce(p_amount_kes, 0));
  v_offer_id uuid;
begin
  if v_sender is null then
    raise exception 'Not authenticated';
  end if;

  if v_amount <= 0 then
    raise exception 'Amount must be positive';
  end if;

  if (p_dm_conversation_id is null and p_group_chat_id is null)
     or (p_dm_conversation_id is not null and p_group_chat_id is not null) then
    raise exception 'Choose either a DM or group chat context';
  end if;

  if p_dm_conversation_id is not null then
    if p_recipient_user_id is null then
      raise exception 'Recipient is required for DM offers';
    end if;
    if p_recipient_user_id = v_sender then
      raise exception 'Cannot send money to yourself';
    end if;
    if not exists (
      select 1
      from public.dm_conversations c
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
      select 1
      from public.group_chat_members m
      where m.group_id = p_group_chat_id and m.user_id = v_sender
    ) then
      raise exception 'Not a member of this group chat';
    end if;
  end if;

  insert into public.wallet_offers(
    sender_id, recipient_user_id, dm_conversation_id, group_chat_id, amount_kes, note, status, debit_reserved
  )
  values (
    v_sender, p_recipient_user_id, p_dm_conversation_id, p_group_chat_id, v_amount, p_note, 'pending', false
  )
  returning id into v_offer_id;

  return v_offer_id;
end;
$function$;

create or replace function public.accept_wallet_offer(p_offer_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user uuid := auth.uid();
  v_offer record;
  v_from_wallet_id uuid;
  v_from_bal numeric;
  v_to_wallet_id uuid;
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
    if not exists (
      select 1
      from public.group_chat_members m
      where m.group_id = v_offer.group_chat_id and m.user_id = v_user
    ) then
      raise exception 'Not a member of this group chat';
    end if;
  end if;

  -- Debit sender at accept time unless this offer was already reserved under
  -- the old immediate-debit behavior.
  if not coalesce(v_offer.debit_reserved, false) then
    begin
      select w.id, w.balance::numeric
      into v_from_wallet_id, v_from_bal
      from public.wallets w
      where w.user_id = v_offer.sender_id
      for update;

      if v_from_wallet_id is null then
        select w.id, w.balance::numeric
        into v_from_wallet_id, v_from_bal
        from public.wallets w
        where w.id = v_offer.sender_id
        for update;
      end if;

      if v_from_wallet_id is not null then
        if coalesce(v_from_bal, 0) < v_offer.amount_kes then
          raise exception 'Sender has insufficient Yuto Balance (have %, need %)', coalesce(v_from_bal, 0), v_offer.amount_kes;
        end if;

        update public.wallets w
        set balance = w.balance - v_offer.amount_kes,
            updated_at = now()
        where w.id = v_from_wallet_id and w.balance::numeric >= v_offer.amount_kes;

        if not found then
          raise exception 'Sender has insufficient Yuto Balance';
        end if;
      else
        if (select coalesce(p.balance, 0)::numeric from public.profiles p where p.id = v_offer.sender_id for update) < v_offer.amount_kes then
          raise exception 'Sender has insufficient Yuto Balance';
        end if;

        update public.profiles p
        set balance = coalesce(p.balance, 0) - v_offer.amount_kes
        where p.id = v_offer.sender_id and coalesce(p.balance, 0)::numeric >= v_offer.amount_kes;

        if not found then
          raise exception 'Sender has insufficient Yuto Balance';
        end if;
      end if;
    exception
      when undefined_table then
        if (select coalesce(p.balance, 0)::numeric from public.profiles p where p.id = v_offer.sender_id for update) < v_offer.amount_kes then
          raise exception 'Sender has insufficient Yuto Balance';
        end if;

        update public.profiles p
        set balance = coalesce(p.balance, 0) - v_offer.amount_kes
        where p.id = v_offer.sender_id and coalesce(p.balance, 0)::numeric >= v_offer.amount_kes;
    end;
  end;

  update public.wallet_offers
  set status = 'accepted', accepted_by = v_user, accepted_at = now()
  where id = p_offer_id;

  -- Credit receiver.
  begin
    select w.id
    into v_to_wallet_id
    from public.wallets w
    where w.user_id = v_user;

    if v_to_wallet_id is null then
      select w.id
      into v_to_wallet_id
      from public.wallets w
      where w.id = v_user;
    end if;

    if v_to_wallet_id is not null then
      update public.wallets w
      set balance = coalesce(w.balance, 0) + v_offer.amount_kes,
          updated_at = now()
      where w.id = v_to_wallet_id;
    else
      insert into public.wallets(user_id, balance)
      values (v_user, v_offer.amount_kes);
    end if;
  exception
    when undefined_table then
      update public.profiles p
      set balance = coalesce(p.balance, 0) + v_offer.amount_kes
      where p.id = v_user;
  end;

  begin
    insert into public.transactions
      (user_id, amount, kind, note, method, status, counterparty_id, metadata)
    values
      (v_offer.sender_id, -v_offer.amount_kes, 'wallet_offer_sent',
       coalesce(v_offer.note, 'Wallet offer accepted'), 'yuto_balance', 'settled', v_user,
       jsonb_build_object('offer_id', p_offer_id, 'accepted_by', v_user)),
      (v_user, v_offer.amount_kes, 'wallet_offer_received',
       coalesce(v_offer.note, 'Wallet offer received'), 'yuto_balance', 'settled', v_offer.sender_id,
       jsonb_build_object('offer_id', p_offer_id, 'sender_id', v_offer.sender_id));
  exception when undefined_table or undefined_column then
    null;
  end;
end;
$function$;

revoke all on function public.create_wallet_offer(numeric, text, uuid, uuid, uuid) from public;
grant execute on function public.create_wallet_offer(numeric, text, uuid, uuid, uuid) to authenticated;

revoke all on function public.accept_wallet_offer(uuid) from public;
grant execute on function public.accept_wallet_offer(uuid) to authenticated;
