-- Fix: `per_person` ambiguous in PL/pgSQL notifications triggers.
-- In PL/pgSQL, an unqualified identifier can refer to either a variable or a column.
-- We qualify the column as `g.per_person` when selecting from `groups`.

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
  select g.name, g.created_by, g.per_person
  into g_name, creator, per_person
  from public.groups g
  where g.id = new.group_id;

  actor_name := public._notif_actor_name(creator);

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

  select g.name, g.created_by, g.per_person
  into g_name, creator, per_person
  from public.groups g
  where g.id = new.group_id;

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

