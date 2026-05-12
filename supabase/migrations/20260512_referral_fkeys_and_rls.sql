-- Ensure referrals table has proper FKs for PostgREST joins
-- Safe to run if they already exist (DO NOTHING on conflict)

-- Add FK if missing: referrals.referred_id → profiles.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'referrals_referred_id_fkey'
    AND table_name = 'referrals'
  ) THEN
    ALTER TABLE public.referrals
      ADD CONSTRAINT referrals_referred_id_fkey
      FOREIGN KEY (referred_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add FK if missing: referrals.referrer_id → profiles.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'referrals_referrer_id_fkey'
    AND table_name = 'referrals'
  ) THEN
    ALTER TABLE public.referrals
      ADD CONSTRAINT referrals_referrer_id_fkey
      FOREIGN KEY (referrer_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- RLS: users can read their own referrals (as referrer or referred)
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can read own referrals' AND tablename = 'referrals'
  ) THEN
    CREATE POLICY "Users can read own referrals" ON public.referrals
      FOR SELECT USING (auth.uid() = referrer_id OR auth.uid() = referred_id);
  END IF;
END $$;

-- Also ensure creator_user_attributions FK to profiles works for the join
-- (already in the creator earnings migration, but just in case)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'creator_user_attributions_user_id_fkey'
    AND table_name = 'creator_user_attributions'
  ) THEN
    ALTER TABLE public.creator_user_attributions
      ADD CONSTRAINT creator_user_attributions_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;
