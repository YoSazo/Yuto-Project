-- Add the tables our unified inbox + Money Inbox subscribe to so the realtime
-- channel actually fires on inserts/updates.
--
-- - plan_messages: lets the unified inbox (Personal tab) reorder + flip the
--   unread dot on a plan thread when a new message arrives, without waiting
--   for a manual refresh.
-- - group_members: powers Money Inbox's live "You owe" / "Owed to you" rows
--   when has_paid flips after a wallet payment.
-- - transactions: live "Recent activity" feed in Money Inbox.
--
-- Idempotent guard so this re-runs cleanly on environments where one of these
-- happens to already be published.

do $$
begin
  begin
    alter publication supabase_realtime add table public.plan_messages;
  exception when duplicate_object then null;
  end;

  begin
    alter publication supabase_realtime add table public.group_members;
  exception when duplicate_object then null;
  end;

  begin
    alter publication supabase_realtime add table public.transactions;
  exception when duplicate_object then null;
  end;
end$$;
