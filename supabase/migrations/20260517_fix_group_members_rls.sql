-- Fix group_members RLS policies that were causing:
-- 1. Infinite recursion (realtime not working)
-- 2. "more than one row returned by a subquery" on join/update

-- 1. Replace recursive SELECT policy with simple authenticated access
DROP POLICY IF EXISTS "Members can view group members" ON group_members;
DROP POLICY IF EXISTS "Authenticated users can view group members" ON group_members;

CREATE POLICY "Authenticated users can view group members" ON group_members
  FOR SELECT
  TO authenticated
  USING (true);

-- 2. Fix the UPDATE policy WITH CHECK that had a self-referencing bug
-- (group_members_1.group_id = group_members_1.group_id was always true)
DROP POLICY IF EXISTS "Users can update own join status" ON group_members;

CREATE POLICY "Users can update own join status" ON group_members
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3. Fix auth_user_group_ids() to use SECURITY INVOKER (not DEFINER)
-- SECURITY DEFINER + USING(true) was returning ALL users' groups
CREATE OR REPLACE FUNCTION auth_user_group_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT group_id FROM group_members WHERE user_id = auth.uid();
$$;
