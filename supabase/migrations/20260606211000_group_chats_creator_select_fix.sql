-- Fix: group create failed silently because creators could not SELECT the new row
-- until membership rows existed (RETURNING + RLS subquery on group_chat_members insert).

drop policy if exists "Creators can read their group chats" on group_chats;

create policy "Creators can read their group chats" on group_chats
  for select using (auth.uid() = created_by);
