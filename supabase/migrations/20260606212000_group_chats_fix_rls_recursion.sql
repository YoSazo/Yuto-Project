-- Fix PG 42P17: infinite recursion on group_chat_members.
-- The previous SELECT policy referenced group_chat_members inside its own USING clause.

drop policy if exists "Members can read group membership" on group_chat_members;
drop policy if exists "Members can read own membership row" on group_chat_members;

create policy "Members can read own membership row" on group_chat_members
  for select using (user_id = auth.uid());
