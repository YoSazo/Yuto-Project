-- Paid attendee group chat per function (events only).

create table if not exists function_attendee_chats (
  function_id uuid primary key references functions(id) on delete cascade,
  group_id uuid unique not null references group_chats(id) on delete cascade,
  created_at timestamptz default now()
);

alter table function_attendee_chats enable row level security;

create policy "Paid members can read function attendee chat links" on function_attendee_chats
  for select using (
    exists (
      select 1 from functions f
      where f.id = function_attendee_chats.function_id
        and (
          f.host_id = auth.uid()
          or exists (
            select 1 from function_members fm
            where fm.function_id = f.id and fm.user_id = auth.uid() and fm.has_paid = true
          )
        )
    )
  );

-- Security definer RPC: create the attendee chat lazily and add the caller.
create or replace function ensure_function_attendee_chat(p_function_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  host uuid;
  f_title text;
  gid uuid;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;

  select host_id, title into host, f_title
  from functions
  where id = p_function_id;

  if host is null then
    raise exception 'function_not_found';
  end if;

  -- Only host or paid attendee can enter.
  if uid <> host and not exists (
    select 1 from function_members
    where function_id = p_function_id and user_id = uid and has_paid = true
  ) then
    raise exception 'not_paid_attendee';
  end if;

  select group_id into gid
  from function_attendee_chats
  where function_id = p_function_id;

  if gid is null then
    insert into group_chats(created_by, title)
    values (host, coalesce(nullif(trim(f_title), ''), 'Function') || ' • Attendees')
    returning id into gid;

    insert into function_attendee_chats(function_id, group_id)
    values (p_function_id, gid);

    insert into group_chat_members(group_id, user_id)
    values (gid, host)
    on conflict do nothing;
  end if;

  insert into group_chat_members(group_id, user_id)
  values (gid, uid)
  on conflict do nothing;

  return gid;
end;
$$;

grant execute on function ensure_function_attendee_chat(uuid) to authenticated;

