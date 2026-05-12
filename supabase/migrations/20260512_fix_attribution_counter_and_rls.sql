-- Fix 1: attribute_user_to_creator — only increment counter on actual insert
CREATE OR REPLACE FUNCTION public.attribute_user_to_creator(
  p_new_user_id uuid,
  p_creator_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only attribute if the referrer is actually a creator
  IF NOT EXISTS (SELECT 1 FROM creators WHERE user_id = p_creator_id AND status = 'active') THEN
    RETURN;
  END IF;

  -- Only attribute once (first creator wins)
  INSERT INTO creator_user_attributions (user_id, creator_id)
  VALUES (p_new_user_id, p_creator_id)
  ON CONFLICT (user_id) DO NOTHING;

  -- Increment creator's user count ONLY if we actually inserted
  IF FOUND THEN
    UPDATE creators SET total_users_brought = total_users_brought + 1 WHERE user_id = p_creator_id;
  END IF;
END;
$$;

-- Fix 2: Tighten creator_earnings INSERT policy
-- Drop the permissive one and replace with a deny-all (SECURITY DEFINER RPCs bypass RLS)
DROP POLICY IF EXISTS "Service role inserts" ON public.creator_earnings;
CREATE POLICY "No direct inserts" ON public.creator_earnings FOR INSERT WITH CHECK (false);

-- Fix 3: Ensure referrals table FKs exist for PostgREST joins
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'referrals_referred_id_fkey' AND table_name = 'referrals'
  ) THEN
    ALTER TABLE public.referrals
      ADD CONSTRAINT referrals_referred_id_fkey
      FOREIGN KEY (referred_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'referrals_referrer_id_fkey' AND table_name = 'referrals'
  ) THEN
    ALTER TABLE public.referrals
      ADD CONSTRAINT referrals_referrer_id_fkey
      FOREIGN KEY (referrer_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Fix 4: RLS on referrals
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own referrals" ON public.referrals;
CREATE POLICY "Users can read own referrals" ON public.referrals
  FOR SELECT USING (auth.uid() = referrer_id OR auth.uid() = referred_id);
