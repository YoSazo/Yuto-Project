-- Template: New Supabase RPC
-- Copy this, rename, fill in logic.
-- Save to supabase/migrations/YYYYMMDD_feat_description.sql

DROP FUNCTION IF EXISTS public.my_new_function(uuid);

CREATE OR REPLACE FUNCTION public.my_new_function(p_param uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Your logic here
  -- Always use FOR UPDATE when reading rows you'll modify
  -- Always check balance >= amount before debiting
  -- Always insert transaction records for money movements

END;
$$;
