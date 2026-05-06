-- DM message attachments (share cards)

alter table dm_messages
  add column if not exists message_type text not null default 'text',
  add column if not exists payload jsonb;

-- Backfill: existing messages stay as text
update dm_messages
set message_type = 'text'
where message_type is null;

-- Basic constraint (leave flexible for future kinds)
alter table dm_messages
  drop constraint if exists dm_messages_type_check;

alter table dm_messages
  add constraint dm_messages_type_check
  check (message_type in ('text', 'share'));

