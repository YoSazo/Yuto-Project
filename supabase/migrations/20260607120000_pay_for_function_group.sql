-- One payer covers multiple function tickets (event functions only) and marks each user paid.

create or replace function public.pay_for_function_group(p_function_id uuid, p_covered_user_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_buyer uuid := auth.uid();
  v_amt int;
  v_loc text;
  v_mode text;
  v_status text;
  v_max int;
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

  select f.amount_per_person, coalesce(f.location, ''), f.mode, f.status, f.max_capacity
  into v_amt, v_loc, v_mode, v_status, v_max
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

  -- Only charge seats that are not already paid (buyer may already have a ticket when buying for friends).
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

  -- Debit payer (wallets.user_id first, then wallets.id, then profiles.balance)
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

  foreach uid in array v_ids loop
    insert into public.function_members (function_id, user_id, has_paid, paid_at, joined_at)
    values (p_function_id, uid, true, now(), now())
    on conflict (function_id, user_id)
    do update set has_paid = true, paid_at = now();
  end loop;
end;
$$;

revoke all on function public.pay_for_function_group(uuid, uuid[]) from public;
grant execute on function public.pay_for_function_group(uuid, uuid[]) to authenticated;
