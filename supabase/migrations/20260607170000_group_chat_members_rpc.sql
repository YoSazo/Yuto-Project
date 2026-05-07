-- Fetch group chat member profiles safely without recursive RLS

create or replace function public.get_group_chat_member_profiles(p_group_id uuid)
returns table (
  id uuid,
  username text,
  display_name text,
  avatar_url text
)
language sql
security definer
set search_path = public
as $$
  select
    p.id,
    p.username,
    p.display_name,
    p.avatar_url
  from public.group_chat_members m
  join public.profiles p on p.id = m.user_id
  where m.group_id = p_group_id
    and exists (
      select 1 from public.group_chat_members me
      where me.group_id = p_group_id and me.user_id = auth.uid()
    )
  order by coalesce(nullif(p.display_name, ''), p.username) asc;
$$;

revoke all on function public.get_group_chat_member_profiles(uuid) from public;
grant execute on function public.get_group_chat_member_profiles(uuid) to authenticated;

