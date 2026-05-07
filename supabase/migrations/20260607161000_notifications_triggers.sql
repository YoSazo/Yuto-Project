-- Auto-write in-app notifications from key events.
-- Triggers run server-side, so they work for webhooks + normal app actions.

create or replace function public._notif_actor_name(p_actor uuid)
returns text
language sql
stable
as $$
  select coalesce(nullif(trim(display_name), ''), nullif(trim(username), ''), 'Someone')
  from public.profiles
  where id = p_actor
$$;

create or replace function public._notif_insert(
  p_user_id uuid,
  p_actor_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_reference_kind text,
  p_reference_id text,
  p_amount_kes integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null then
    return;
  end if;
  -- don't notify yourself
  if p_actor_id is not null and p_user_id = p_actor_id then
    return;
  end if;

  insert into public.notifications(
    user_id, actor_id, type, title, body,
    reference_kind, reference_id, amount_kes,
    is_read
  )
  values(
    p_user_id, p_actor_id, p_type, p_title, p_body,
    p_reference_kind, p_reference_id, p_amount_kes,
    false
  );
end;
$$;

-- Notify friends helper (accepted friendships)
create or replace function public._notif_friends(
  p_actor_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_reference_kind text,
  p_reference_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  fid uuid;
begin
  if p_actor_id is null then return; end if;

  for fid in
    select case
      when f.requester_id = p_actor_id then f.addressee_id
      else f.requester_id
    end
    from public.friendships f
    where (f.requester_id = p_actor_id or f.addressee_id = p_actor_id)
      and f.status = 'accepted'
  loop
    perform public._notif_insert(fid, p_actor_id, p_type, p_title, p_body, p_reference_kind, p_reference_id, null);
  end loop;
end;
$$;

-- 1) Function join (member row inserted) → friends + host (verbose)
create or replace function public.notify_function_join()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_name text;
  fn_title text;
  host_id uuid;
  amt int;
  loc text;
  kind_label text;
begin
  actor_name := public._notif_actor_name(new.user_id);

  select title, host_id, amount_per_person, coalesce(location,'')
  into fn_title, host_id, amt, loc
  from public.functions
  where id = new.function_id;

  if loc = '__SELL__' then kind_label := 'Storefront'; 
  elsif loc = '__SERVICE__' then kind_label := 'Services';
  else kind_label := 'Function';
  end if;

  -- host: someone joined (or started checkout) — feels live
  perform public._notif_insert(
    host_id,
    new.user_id,
    'function_joined',
    actor_name || ' opened your ' || kind_label,
    actor_name || ' just joined “' || fn_title || '”. If they pay, you’ll see it instantly.',
    'function',
    new.function_id::text,
    amt
  );

  -- friends feed: actor joined something
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

drop trigger if exists trg_notify_function_join on public.function_members;
create trigger trg_notify_function_join
after insert on public.function_members
for each row
execute function public.notify_function_join();

-- 2) Function payment (has_paid flips true) → host + buyer
create or replace function public.notify_function_paid()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_name text;
  fn_title text;
  host_id uuid;
  amt int;
begin
  if (coalesce(old.has_paid,false) = true) or (coalesce(new.has_paid,false) = false) then
    return new;
  end if;

  actor_name := public._notif_actor_name(new.user_id);
  select title, host_id, amount_per_person into fn_title, host_id, amt
  from public.functions where id = new.function_id;

  perform public._notif_insert(
    host_id,
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
    host_id,
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

drop trigger if exists trg_notify_function_paid on public.function_members;
create trigger trg_notify_function_paid
after update of has_paid on public.function_members
for each row
execute function public.notify_function_paid();

-- 3) Split: member added to group_members → notify invitee + creator’s friends (live)
create or replace function public.notify_split_member_added()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_name text;
  g_name text;
  creator uuid;
  per_person int;
begin
  select name, created_by, per_person into g_name, creator, per_person
  from public.groups
  where id = new.group_id;

  actor_name := public._notif_actor_name(creator);

  -- invitee
  perform public._notif_insert(
    new.user_id,
    creator,
    'split_invited',
    actor_name || ' added you to a split',
    'Split: “' || coalesce(g_name,'Split') || '”. Your share is KSH ' || coalesce(per_person,0)::text || '. Tap to pay inside the split.',
    'group',
    new.group_id::text,
    per_person
  );

  -- creator friends feed
  perform public._notif_friends(
    creator,
    'friend_created_split',
    actor_name || ' made a split',
    'Split: “' || coalesce(g_name,'Split') || '” · KSH ' || coalesce(per_person,0)::text || ' each.',
    'group',
    new.group_id::text
  );

  return new;
end;
$$;

drop trigger if exists trg_notify_split_member_added on public.group_members;
create trigger trg_notify_split_member_added
after insert on public.group_members
for each row
execute function public.notify_split_member_added();

-- 4) Split: member paid (has_paid flips true) → notify creator + payer
create or replace function public.notify_split_paid()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_name text;
  g_name text;
  creator uuid;
  per_person int;
begin
  if (coalesce(old.has_paid,false) = true) or (coalesce(new.has_paid,false) = false) then
    return new;
  end if;

  select name, created_by, per_person into g_name, creator, per_person
  from public.groups
  where id = new.group_id;

  actor_name := public._notif_actor_name(new.user_id);

  perform public._notif_insert(
    creator,
    new.user_id,
    'split_payment_received',
    actor_name || ' paid their share',
    'Split: “' || coalesce(g_name,'Split') || '” · KSH ' || coalesce(per_person,0)::text || '.',
    'group',
    new.group_id::text,
    per_person
  );

  perform public._notif_insert(
    new.user_id,
    creator,
    'split_payment_sent',
    'Payment sent',
    'You paid KSH ' || coalesce(per_person,0)::text || ' into “' || coalesce(g_name,'Split') || '”.',
    'group',
    new.group_id::text,
    per_person
  );

  return new;
end;
$$;

drop trigger if exists trg_notify_split_paid on public.group_members;
create trigger trg_notify_split_paid
after update of has_paid on public.group_members
for each row
execute function public.notify_split_paid();

-- 5) Public post mentions: tagged_user_ids → notify each mentioned user
create or replace function public.notify_post_mentions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_name text;
  uid text;
  arr jsonb;
begin
  actor_name := public._notif_actor_name(new.user_id);
  arr := coalesce((new.tag_payload->'tagged_user_ids'), '[]'::jsonb);

  if jsonb_typeof(arr) <> 'array' then
    return new;
  end if;

  for uid in
    select value::text from jsonb_array_elements_text(arr)
  loop
    perform public._notif_insert(
      uid::uuid,
      new.user_id,
      'mention',
      actor_name || ' mentioned you',
      left(coalesce(new.content_text,''), 120),
      'post',
      new.id::text,
      null
    );
  end loop;

  -- friends feed: actor posted something (verbose “live”)
  perform public._notif_friends(
    new.user_id,
    'friend_posted',
    actor_name || ' posted',
    left(coalesce(new.content_text,''), 140),
    'post',
    new.id::text
  );

  return new;
end;
$$;

drop trigger if exists trg_notify_post_mentions on public.public_posts;
create trigger trg_notify_post_mentions
after insert on public.public_posts
for each row
execute function public.notify_post_mentions();

