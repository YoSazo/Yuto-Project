-- Plan notifications: join activity + updates + “locked in” moment.

-- 6) Plan member joined → notify creator + friends feed
create or replace function public.notify_plan_join()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_name text;
  plan_title text;
  creator uuid;
  amt int;
begin
  actor_name := public._notif_actor_name(new.user_id);

  select p.title, p.creator_id, coalesce(p.amount, 0)::int
  into plan_title, creator, amt
  from public.plans p
  where p.id = new.plan_id;

  perform public._notif_insert(
    creator,
    new.user_id,
    'plan_joined',
    actor_name || ' joined your plan',
    'Plan: “' || coalesce(plan_title,'Plan') || '”. Tap to see who’s in and what’s next.',
    'plan',
    new.plan_id::text,
    amt
  );

  perform public._notif_friends(
    new.user_id,
    'friend_joined_plan',
    actor_name || ' joined a plan',
    'Plan: “' || coalesce(plan_title,'Plan') || '”.',
    'plan',
    new.plan_id::text
  );

  return new;
end;
$$;

drop trigger if exists trg_notify_plan_join on public.plan_members;
create trigger trg_notify_plan_join
after insert on public.plan_members
for each row
execute function public.notify_plan_join();

-- 7) Plan update posted → notify all members + friends feed
create or replace function public.notify_plan_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_name text;
  plan_title text;
  uid uuid;
begin
  actor_name := public._notif_actor_name(new.creator_id);

  select p.title into plan_title
  from public.plans p
  where p.id = new.plan_id;

  -- Notify all members + creator (excluding actor handled in _notif_insert)
  for uid in
    select distinct pm.user_id
    from public.plan_members pm
    where pm.plan_id = new.plan_id
    union
    select p.creator_id
    from public.plans p
    where p.id = new.plan_id
  loop
    perform public._notif_insert(
      uid,
      new.creator_id,
      'plan_update',
      actor_name || ' posted an update',
      'Plan: “' || coalesce(plan_title,'Plan') || '” — ' || left(coalesce(new.content,''), 140),
      'plan',
      new.plan_id::text,
      null
    );
  end loop;

  -- Friends feed: actor is active
  perform public._notif_friends(
    new.creator_id,
    'friend_plan_update',
    actor_name || ' updated a plan',
    'Plan: “' || coalesce(plan_title,'Plan') || '” — ' || left(coalesce(new.content,''), 140),
    'plan',
    new.plan_id::text
  );

  return new;
end;
$$;

drop trigger if exists trg_notify_plan_update on public.plan_updates;
create trigger trg_notify_plan_update
after insert on public.plan_updates
for each row
execute function public.notify_plan_update();

-- 8) Plan locked in (status->completed, yuto_group_id set) → notify members (big moment)
create or replace function public.notify_plan_locked_in()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_name text;
  plan_title text;
  uid uuid;
  gid text;
begin
  if (coalesce(old.status,'') = 'completed') or (coalesce(new.status,'') <> 'completed') then
    return new;
  end if;

  actor_name := public._notif_actor_name(new.creator_id);
  plan_title := coalesce(new.title, 'Plan');
  gid := coalesce(new.yuto_group_id::text, null);

  for uid in
    select distinct pm.user_id
    from public.plan_members pm
    where pm.plan_id = new.id
    union
    select new.creator_id
  loop
    perform public._notif_insert(
      uid,
      new.creator_id,
      'plan_locked_in',
      'Plan locked in',
      actor_name || ' locked in “' || plan_title || '”. Tap to pay your share and join the split.',
      case when gid is null then 'plan' else 'group' end,
      case when gid is null then new.id::text else gid end,
      coalesce(new.amount, null)
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_notify_plan_locked_in on public.plans;
create trigger trg_notify_plan_locked_in
after update of status on public.plans
for each row
execute function public.notify_plan_locked_in();

