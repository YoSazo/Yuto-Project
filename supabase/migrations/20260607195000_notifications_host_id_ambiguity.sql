-- PL/pgSQL had PL variables named host_id shadowing columns in SELECT … INTO … from public.functions,
-- causing ERROR 42702: column reference "host_id" is ambiguous (e.g. on joinFunction → notify_function_join).

create or replace function public.notify_function_join()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_name text;
  fn_title text;
  v_fn_host uuid;
  amt int;
  loc text;
  kind_label text;
begin
  actor_name := public._notif_actor_name(new.user_id);

  select f.title, f.host_id, f.amount_per_person, coalesce(f.location,'')
    into fn_title, v_fn_host, amt, loc
  from public.functions f
  where f.id = new.function_id;

  if loc = '__SELL__' then kind_label := 'Storefront';
  elsif loc = '__SERVICE__' then kind_label := 'Services';
  else kind_label := 'Function';
  end if;

  perform public._notif_insert(
    v_fn_host,
    new.user_id,
    'function_joined',
    actor_name || ' opened your ' || kind_label,
    actor_name || ' just joined “' || fn_title || '”. If they pay, you’ll see it instantly.',
    'function',
    new.function_id::text,
    amt
  );

  perform public._notif_friends(
    new.user_id,
    'friend_joined_function',
    actor_name || ' is going out',
    actor_name || ' just joined “' || fn_title || '”.',
    'function',
    new.function_id::text
  );

  return new;
end;
$$;

create or replace function public.notify_function_paid()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_name text;
  fn_title text;
  v_fn_host uuid;
  amt int;
begin
  if (coalesce(old.has_paid,false) = true) or (coalesce(new.has_paid,false) = false) then
    return new;
  end if;

  actor_name := public._notif_actor_name(new.user_id);
  select f.title, f.host_id, f.amount_per_person
    into fn_title, v_fn_host, amt
  from public.functions f
  where f.id = new.function_id;

  perform public._notif_insert(
    v_fn_host,
    new.user_id,
    'function_payment_received',
    actor_name || ' paid KSH ' || amt::text,
    'Payment received for “' || fn_title || '”.',
    'function',
    new.function_id::text,
    amt
  );

  perform public._notif_insert(
    new.user_id,
    v_fn_host,
    'function_ticket_ready',
    'Ticket ready',
    'You’re in for “' || fn_title || '”. Your proof is ready.',
    'function',
    new.function_id::text,
    amt
  );

  return new;
end;
$$;
