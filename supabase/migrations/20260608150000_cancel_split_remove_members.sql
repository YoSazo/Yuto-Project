create or replace function public.cancel_split_group(p_group_id uuid)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user_id     uuid := auth.uid();
  v_host_id     uuid;
  v_status      text;
  v_group_name  text;
  v_per_person  numeric;
  v_member      record;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Get group info and verify host
  select created_by, status, name, per_person
  into v_host_id, v_status, v_group_name, v_per_person
  from public.groups
  where id = p_group_id;

  if v_host_id is null then
    raise exception 'Group not found';
  end if;

  if v_host_id <> v_user_id then
    raise exception 'Only the host can cancel the split';
  end if;

  if v_status = 'completed' or v_status = 'funded' then
    raise exception 'Cannot cancel a completed split';
  end if;

  -- Loop through paid members and refund them
  for v_member in 
    select user_id from public.group_members 
    where group_id = p_group_id and has_paid = true
  loop
    -- Credit wallet
    update public.wallets
    set balance = balance + v_per_person, updated_at = now()
    where user_id = v_member.user_id;

    -- Create refund transaction
    insert into public.transactions
      (user_id, amount, kind, note, method, status, metadata)
    values
      (v_member.user_id, v_per_person, 'cancellation_refund',
       'Refund: ' || coalesce(v_group_name, 'Split') || ' cancelled',
       'yuto_balance', 'settled',
       jsonb_build_object(
         'group_id', p_group_id,
         'group_name', v_group_name,
         'refund_reason', 'host_cancelled'
       ));
  end loop;

  -- Update group status
  update public.groups
  set status = 'cancelled', collected_balance = 0
  where id = p_group_id;

  -- Remove all members except the host so it deletes from their My Yutos page
  delete from public.group_members
  where group_id = p_group_id and user_id <> v_host_id;

  return true;
end;
$function$;
