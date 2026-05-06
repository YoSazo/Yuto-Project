-- Group chat share attachments (same payload shapes as dm_messages.share)

alter table group_chat_messages
  add column if not exists message_type text not null default 'text',
  add column if not exists payload jsonb;

alter table group_chat_messages
  drop constraint if exists group_chat_messages_type_check;

alter table group_chat_messages
  add constraint group_chat_messages_type_check
  check (message_type in ('text', 'share'));
