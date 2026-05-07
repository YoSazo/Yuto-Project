-- Allow senders to delete their own messages and
-- auto-clean split share messages when a split (group) is deleted.

-- 1) RLS: DM message delete (sender only)
drop policy if exists "Senders can delete their dm messages" on public.dm_messages;
create policy "Senders can delete their dm messages"
on public.dm_messages
for delete
to authenticated
using (auth.uid() = sender_id);

-- 2) RLS: Group chat message delete (sender only)
drop policy if exists "Senders can delete their group chat messages" on public.group_chat_messages;
create policy "Senders can delete their group chat messages"
on public.group_chat_messages
for delete
to authenticated
using (
  auth.uid() = sender_id
  and group_id in (select group_id from public.group_chat_members where user_id = auth.uid())
);

-- 3) Cleanup: when a split (groups row) is deleted, remove any share cards for it,
-- plus the auto "Split created: ..." text row nearby by the same sender.
create or replace function public.cleanup_split_chat_messages()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  gid text := old.id::text;
  creator uuid := old.created_by;
begin
  -- DM share cards
  delete from public.dm_messages m
  where m.message_type = 'share'
    and (m.payload->>'kind') = 'group'
    and (m.payload->>'group_id') = gid;

  -- Group chat share cards
  delete from public.group_chat_messages m
  where m.message_type = 'share'
    and (m.payload->>'kind') = 'group'
    and (m.payload->>'group_id') = gid;

  -- Best-effort: remove the adjacent "Split created: ..." message from the creator.
  -- We keep the window narrow to avoid deleting legitimate chat content.
  delete from public.dm_messages m
  where m.sender_id = creator
    and m.message_type = 'text'
    and m.created_at >= old.created_at - interval '5 minutes'
    and m.created_at <= old.created_at + interval '5 minutes'
    and m.content ilike 'Split created:%';

  delete from public.group_chat_messages m
  where m.sender_id = creator
    and (m.message_type is null or m.message_type = 'text')
    and m.created_at >= old.created_at - interval '5 minutes'
    and m.created_at <= old.created_at + interval '5 minutes'
    and m.content ilike 'Split created:%';

  return old;
end;
$$;

drop trigger if exists trg_cleanup_split_chat_messages on public.groups;
create trigger trg_cleanup_split_chat_messages
after delete on public.groups
for each row
execute function public.cleanup_split_chat_messages();

