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

  -- We do NOT auto-complete the group here anymore. 
  -- The host must explicitly pay out the balance to mark the group as completed.

  return true;
end;
$function$;
