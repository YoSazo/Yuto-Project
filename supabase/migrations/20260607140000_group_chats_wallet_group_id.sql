-- Link wallet groups (groups) to companion group chats (group_chats)

alter table group_chats
add column if not exists wallet_group_id uuid references groups(id) on delete cascade;

create unique index if not exists idx_group_chats_wallet_group_id_unique
on group_chats(wallet_group_id)
where wallet_group_id is not null;

