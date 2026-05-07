-- When a plan/function is deleted in Supabase, remove share cards referencing it from chats
-- so the UI doesn't get stuck on "Loading…".

create or replace function public.cleanup_deleted_plan_chat_messages()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  pid text := old.id::text;
begin
  delete from public.dm_messages m
  where m.message_type = 'share'
    and (m.payload->>'kind') = 'plan'
    and (m.payload->>'plan_id') = pid;

  delete from public.group_chat_messages m
  where m.message_type = 'share'
    and (m.payload->>'kind') = 'plan'
    and (m.payload->>'plan_id') = pid;

  return old;
end;
$$;

drop trigger if exists trg_cleanup_deleted_plan_chat_messages on public.plans;
create trigger trg_cleanup_deleted_plan_chat_messages
after delete on public.plans
for each row
execute function public.cleanup_deleted_plan_chat_messages();

create or replace function public.cleanup_deleted_function_chat_messages()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  fid text := old.id::text;
begin
  delete from public.dm_messages m
  where m.message_type = 'share'
    and (m.payload->>'kind') in ('function', 'listing')
    and (m.payload->>'function_id') = fid;

  delete from public.group_chat_messages m
  where m.message_type = 'share'
    and (m.payload->>'kind') in ('function', 'listing')
    and (m.payload->>'function_id') = fid;

  return old;
end;
$$;

drop trigger if exists trg_cleanup_deleted_function_chat_messages on public.functions;
create trigger trg_cleanup_deleted_function_chat_messages
after delete on public.functions
for each row
execute function public.cleanup_deleted_function_chat_messages();

