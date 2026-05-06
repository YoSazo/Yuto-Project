-- Rename group chat title (members only). Avoids permissive UPDATE on group_chats for clients.

create or replace function public.set_group_chat_title(p_group_id uuid, p_title text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trim text := trim(coalesce(p_title, ''));
  v_final text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if not exists (
    select 1 from group_chat_members gcm
    where gcm.group_id = p_group_id and gcm.user_id = auth.uid()
  ) then
    raise exception 'not a member' using errcode = '42501';
  end if;

  if v_trim = '' then
    v_final := 'Group chat';
  elsif lower(v_trim) = 'group chat' then
    v_final := 'Group chat';
  else
    v_final := left(v_trim, 80);
  end if;

  update group_chats set title = v_final where id = p_group_id;
end;
$$;

grant execute on function public.set_group_chat_title(uuid, text) to authenticated;

-- Live title updates in the chat header
alter publication supabase_realtime add table group_chats;
