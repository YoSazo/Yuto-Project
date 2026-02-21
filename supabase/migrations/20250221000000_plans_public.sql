-- Make all plans public (anyone can view)
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard → SQL Editor

drop policy if exists "Friends can view plans" on plans;
create policy "Anyone can view plans" on plans
  for select using (true);

drop policy if exists "Friends can view plan updates" on plan_updates;
create policy "Anyone can view plan updates" on plan_updates
  for select using (true);

-- Realtime for plans (if not already added)
alter publication supabase_realtime add table plans;
alter publication supabase_realtime add table plan_members;
