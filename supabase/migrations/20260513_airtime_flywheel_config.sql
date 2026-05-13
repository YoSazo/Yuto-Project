-- ============================================================
-- YUTO AIRTIME FLYWHEEL — Economic Model Config
-- Replaces the old creator_config fee structure
-- ============================================================

-- New platform config table (replaces creator_config for fee logic)
CREATE TABLE IF NOT EXISTS public.platform_config (
  key text PRIMARY KEY,
  value numeric NOT NULL,
  description text
);

-- Seed the Airtime Flywheel parameters
INSERT INTO public.platform_config (key, value, description) VALUES
  -- Acquisition
  ('min_topup_for_referrer_bonus', 200, 'Minimum first top-up to trigger referral bonus'),
  ('referrer_bonus', 50, 'KES paid to referrer on first qualifying top-up'),
  ('new_user_bonus', 10, 'KES credited to new user on signup'),
  
  -- In-app (free)
  ('p2p_fee', 0, 'Fee for peer-to-peer transfers'),
  ('split_fee', 0, 'Fee for split payments'),
  
  -- Withdrawal
  ('withdrawal_fee_flat', 40, 'Flat fee charged to user on withdrawal'),
  ('rewards_airtime_pct_of_fee', 1.0, '100% of withdrawal fee goes to transfer credits (KES 40)'),
  ('min_airtime_send', 20, 'Minimum transfer credit balance before it can be used for remote P2P'),
  
  -- Top-up
  ('topup_fee_pct', 0.01, '1% fee on top-ups (e.g. KES 2 on KES 200)'),
  ('topup_fee_rebate_as_airtime', 1, '1 = rebate top-up fee as airtime, 0 = keep as revenue'),
  
  -- Host payouts
  ('payout_to_till_fee', 0, 'Fee for payout to Till number'),
  ('payout_to_paybill_fee', 0, 'Fee for payout to Paybill'),
  ('payout_to_phone_fee', 25, 'Fee for payout to M-PESA phone (covers B2C cost)'),
  
  -- Revenue commissions (unchanged)
  ('drop_commission_pct', 0.05, '5% commission on drops/functions'),
  ('function_commission_pct', 0.05, '5% commission on function tickets'),
  ('merchant_fee_pct', 0.015, '1.5% merchant fee on marketplace sales'),
  
  -- Creator commissions (kept from old model)
  ('creator_tier1_split', 0.70, 'Direct creator gets 70% of commission pool'),
  ('creator_tier2_split', 0.30, 'Recruiter gets 30% of commission pool')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, description = EXCLUDED.description;

-- RLS
ALTER TABLE public.platform_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read platform config" ON public.platform_config FOR SELECT USING (true);
CREATE POLICY "Dev can manage platform config" ON public.platform_config FOR ALL USING (auth.uid() = 'f5f5da38-c839-4ce4-94fc-10f3854674e0');

-- Transfer credits ledger — accumulated credits for free remote P2P transfers
-- When users are far apart (no Bluetooth), these credits cover the transfer channel cost
CREATE TABLE IF NOT EXISTS public.transfer_credits (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  balance_kes numeric DEFAULT 0 NOT NULL,
  total_earned_kes numeric DEFAULT 0 NOT NULL,
  total_used_kes numeric DEFAULT 0 NOT NULL,
  last_used_at timestamptz
);

ALTER TABLE public.transfer_credits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own credits" ON public.transfer_credits FOR SELECT USING (auth.uid() = user_id);

-- Function: Credit transfer credits to user
-- Called after withdrawal (100% of fee) or top-up (1% rebate)
CREATE OR REPLACE FUNCTION public.credit_transfer_credits(
  p_user_id uuid,
  p_amount numeric,
  p_source text -- 'withdrawal' or 'topup_rebate'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO transfer_credits (user_id, balance_kes, total_earned_kes)
  VALUES (p_user_id, p_amount, p_amount)
  ON CONFLICT (user_id) DO UPDATE SET
    balance_kes = transfer_credits.balance_kes + p_amount,
    total_earned_kes = transfer_credits.total_earned_kes + p_amount;
END;
$$;

-- Function: Deduct transfer credits when used for remote P2P
CREATE OR REPLACE FUNCTION public.use_transfer_credits(
  p_user_id uuid,
  p_amount numeric
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_balance numeric;
BEGIN
  SELECT balance_kes INTO v_balance FROM transfer_credits WHERE user_id = p_user_id FOR UPDATE;
  IF v_balance IS NULL OR v_balance < p_amount THEN
    RETURN false;
  END IF;
  UPDATE transfer_credits SET
    balance_kes = balance_kes - p_amount,
    total_used_kes = total_used_kes + p_amount,
    last_used_at = now()
  WHERE user_id = p_user_id;
  RETURN true;
END;
$$;

-- Keep old function names as aliases for backward compat during migration
CREATE OR REPLACE FUNCTION public.credit_airtime_reward(
  p_user_id uuid,
  p_amount numeric,
  p_source text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM credit_transfer_credits(p_user_id, p_amount, p_source);
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_airtime_sent(
  p_user_id uuid,
  p_amount numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM use_transfer_credits(p_user_id, p_amount);
END;
$$;
