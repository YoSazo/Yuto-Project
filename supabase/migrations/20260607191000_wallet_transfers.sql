-- Transfer Yuto balance between users (wallet-to-wallet)

create or replace function public.transfer_yuto_balance(
  p_to_user_id uuid,
  p_amount_kes integer,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
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

  -- Lock sender wallet row (prefer wallets.user_id, then wallets.id)
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
    -- Legacy fallback (profiles.balance)
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

  -- Credit recipient (prefer wallets.user_id, then wallets.id, then create wallets row)
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
      -- If wallets table doesn't exist in this environment, fall back to profiles.balance
      update public.profiles p
      set balance = coalesce(p.balance, 0) + v_amount
      where p.id = p_to_user_id;
    end;
  end if;

  -- Best-effort transaction rows (if table exists)
  begin
    insert into public.transactions (user_id, amount, kind, created_at, note, counterparty_id)
    values (v_from, -v_amount, 'transfer_sent', now(), p_note, p_to_user_id);
    insert into public.transactions (user_id, amount, kind, created_at, note, counterparty_id)
    values (p_to_user_id, v_amount, 'transfer_received', now(), p_note, v_from);
  exception when undefined_table or undefined_column then
    null;
  end;

  -- In-app notification for recipient
  insert into public.notifications(user_id, actor_id, type, title, body, reference_kind, reference_id, amount_kes, cta_label, cta_action)
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
$$;

revoke all on function public.transfer_yuto_balance(uuid, integer, text) from public;
grant execute on function public.transfer_yuto_balance(uuid, integer, text) to authenticated;

