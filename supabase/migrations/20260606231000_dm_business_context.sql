-- Tag specific DM conversations as business (sell/service) threads.

create table if not exists dm_conversation_context (
  id uuid default gen_random_uuid() primary key,
  conversation_id uuid references dm_conversations(id) on delete cascade not null,
  provider_id uuid references profiles(id) on delete cascade not null,
  buyer_id uuid references profiles(id) on delete cascade not null,
  function_id uuid references functions(id) on delete cascade not null,
  listing_kind text not null check (listing_kind in ('sell', 'service')),
  listing_title text not null,
  created_at timestamptz default now(),
  unique(conversation_id, function_id)
);

alter table dm_conversation_context enable row level security;

create policy "Participants can read dm conversation context" on dm_conversation_context
  for select using (auth.uid() = provider_id or auth.uid() = buyer_id);

create policy "Participants can insert dm conversation context" on dm_conversation_context
  for insert with check (
    (auth.uid() = provider_id or auth.uid() = buyer_id)
    and exists (
      select 1 from dm_conversations c
      where c.id = dm_conversation_context.conversation_id
        and (auth.uid() = c.user_low or auth.uid() = c.user_high)
    )
  );

create index if not exists idx_dm_conversation_context_provider_created on dm_conversation_context(provider_id, created_at desc);
create index if not exists idx_dm_conversation_context_buyer_created on dm_conversation_context(buyer_id, created_at desc);

