-- ============================================================
-- YUTO CREATOR EARNINGS SYSTEM
-- 2-tier commission on top-ups and withdrawals
-- ============================================================

-- Global config table (The Switch)
CREATE TABLE IF NOT EXISTS public.creator_config (
  key text PRIMARY KEY,
  value numeric NOT NULL
);

-- Seed defaults
INSERT INTO public.creator_config (key, value) VALUES
  ('fee_pct', 0.05),           -- 5% platform fee on top-ups and withdrawals
  ('gateway_in_pct', 0.01),    -- 1% IntaSend/M-PESA fee on collections
  ('gateway_out_flat', 50),    -- KSH 50 flat B2C fee
  ('creator_multiplier', 1.0), -- 100% of net margin goes to creators (launch phase)
  ('tier1_split', 0.70),       -- Creator B (direct referrer) gets 70%
  ('tier2_split', 0.30),       -- Creator A (referrer's referrer) gets 30%
  ('flat_referral_bonus', 10), -- KSH 10 for any user referring a friend who tops up
  ('max_flat_referrals', 1000) -- Global cap on flat referral payouts
ON CONFLICT (key) DO NOTHING;

-- Creator status table — tracks who is a creator (granted by dev)
CREATE TABLE IF NOT EXISTS public.creators (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  granted_by uuid REFERENCES public.profiles(id),
  granted_at timestamptz DEFAULT now(),
  -- Who recruited this creator (for tier-2 earnings)
  recruited_by uuid REFERENCES public.profiles(id),
  status text DEFAULT 'active' CHECK (status IN ('active', 'paused', 'revoked')),
  -- Stats (denormalized for fast reads)
  total_users_brought integer DEFAULT 0,
  total_earned_kes numeric DEFAULT 0
);

-- Creator earnings ledger — every commission payout
CREATE TABLE IF NOT EXISTS public.creator_earnings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_id uuid NOT NULL REFERENCES public.profiles(id),
  -- Who triggered this earning
  triggered_by_user_id uuid REFERENCES public.profiles(id),
  -- What triggered it
  trigger_type text NOT NULL CHECK (trigger_type IN ('topup', 'withdrawal')),
  trigger_amount numeric NOT NULL,
  -- Commission math
  platform_revenue numeric NOT NULL,
  gateway_cost numeric NOT NULL,
  net_margin numeric NOT NULL,
  commission_pct numeric NOT NULL, -- 0.70 or 0.30
  earning_kes numeric NOT NULL,
  -- Tier info
  tier integer NOT NULL CHECK (tier IN (1, 2)), -- 1 = direct referrer, 2 = referrer's referrer
  created_at timestamptz DEFAULT now()
);

-- Track which creator brought which user (separate from flat referrals)
-- A user can only have ONE creator attribution (the first creator link wins)
CREATE TABLE IF NOT EXISTS public.creator_user_attributions (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES public.profiles(id),
  attributed_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE public.creator_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read config" ON public.creator_config FOR SELECT USING (true);
CREATE POLICY "Dev can manage config" ON public.creator_config FOR ALL USING (auth.uid() = 'f5f5da38-c839-4ce4-94fc-10f3854674e0');

ALTER TABLE public.creators ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read creators" ON public.creators FOR SELECT USING (true);
CREATE POLICY "Dev can manage creators" ON public.creators FOR ALL USING (auth.uid() = 'f5f5da38-c839-4ce4-94fc-10f3854674e0');

ALTER TABLE public.creator_earnings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Creators can read own earnings" ON public.creator_earnings FOR SELECT USING (auth.uid() = creator_id);
CREATE POLICY "Service role inserts" ON public.creator_earnings FOR INSERT WITH CHECK (true); -- service role only in practice

ALTER TABLE public.creator_user_attributions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own attribution" ON public.creator_user_attributions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Creators can read their attributions" ON public.creator_user_attributions FOR SELECT USING (auth.uid() = creator_id);

-- Function: Process creator commission on top-up or withdrawal
-- Called from webhook.ts (service role) after a successful top-up/withdrawal
CREATE OR REPLACE FUNCTION public.process_creator_commission(
  p_user_id uuid,
  p_trigger_type text, -- 'topup' or 'withdrawal'
  p_amount numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_fee_pct numeric;
  v_gateway_cost numeric;
  v_creator_multiplier numeric;
  v_tier1_split numeric;
  v_tier2_split numeric;
  v_platform_revenue numeric;
  v_net_margin numeric;
  v_total_commission numeric;
  v_attribution record;
  v_creator record;
  v_tier2_creator_id uuid;
  v_tier1_earning numeric;
  v_tier2_earning numeric;
BEGIN
  -- Load config
  SELECT value INTO v_fee_pct FROM creator_config WHERE key = 'fee_pct';
  SELECT value INTO v_creator_multiplier FROM creator_config WHERE key = 'creator_multiplier';
  SELECT value INTO v_tier1_split FROM creator_config WHERE key = 'tier1_split';
  SELECT value INTO v_tier2_split FROM creator_config WHERE key = 'tier2_split';

  -- Calculate revenue
  v_platform_revenue := p_amount * COALESCE(v_fee_pct, 0.05);

  -- Calculate gateway cost
  IF p_trigger_type = 'topup' THEN
    v_gateway_cost := p_amount * (SELECT COALESCE(value, 0.01) FROM creator_config WHERE key = 'gateway_in_pct');
  ELSE
    v_gateway_cost := (SELECT COALESCE(value, 50) FROM creator_config WHERE key = 'gateway_out_flat');
  END IF;

  -- Net margin
  v_net_margin := v_platform_revenue - v_gateway_cost;

  -- Safety: skip if no margin
  IF v_net_margin <= 0 THEN RETURN; END IF;

  -- Find creator attribution for this user
  SELECT * INTO v_attribution FROM creator_user_attributions WHERE user_id = p_user_id;
  IF v_attribution IS NULL THEN RETURN; END IF; -- User not attributed to any creator

  -- Check creator is active
  SELECT * INTO v_creator FROM creators WHERE user_id = v_attribution.creator_id AND status = 'active';
  IF v_creator IS NULL THEN RETURN; END IF;

  -- Calculate commissions
  v_total_commission := v_net_margin * COALESCE(v_creator_multiplier, 1.0);
  v_tier1_earning := v_total_commission * COALESCE(v_tier1_split, 0.70);

  -- Pay Tier 1 (direct creator)
  INSERT INTO wallets (user_id, balance) VALUES (v_creator.user_id, v_tier1_earning)
    ON CONFLICT (user_id) DO UPDATE SET balance = wallets.balance + v_tier1_earning;

  INSERT INTO creator_earnings (creator_id, triggered_by_user_id, trigger_type, trigger_amount, platform_revenue, gateway_cost, net_margin, commission_pct, earning_kes, tier)
  VALUES (v_creator.user_id, p_user_id, p_trigger_type, p_amount, v_platform_revenue, v_gateway_cost, v_net_margin, v_tier1_split, v_tier1_earning, 1);

  INSERT INTO transactions (user_id, amount, kind, note, method, status, counterparty_id, metadata)
  VALUES (v_creator.user_id, v_tier1_earning, 'creator_commission', 'Creator earnings: ' || p_trigger_type, 'system', 'settled', p_user_id, jsonb_build_object('trigger_type', p_trigger_type, 'trigger_amount', p_amount, 'tier', 1));

  -- Update creator stats
  UPDATE creators SET total_earned_kes = total_earned_kes + v_tier1_earning WHERE user_id = v_creator.user_id;

  -- Pay Tier 2 (creator's recruiter) if exists
  v_tier2_creator_id := v_creator.recruited_by;
  IF v_tier2_creator_id IS NOT NULL THEN
    -- Check tier-2 creator is active
    IF EXISTS (SELECT 1 FROM creators WHERE user_id = v_tier2_creator_id AND status = 'active') THEN
      v_tier2_earning := v_total_commission * COALESCE(v_tier2_split, 0.30);

      INSERT INTO wallets (user_id, balance) VALUES (v_tier2_creator_id, v_tier2_earning)
        ON CONFLICT (user_id) DO UPDATE SET balance = wallets.balance + v_tier2_earning;

      INSERT INTO creator_earnings (creator_id, triggered_by_user_id, trigger_type, trigger_amount, platform_revenue, gateway_cost, net_margin, commission_pct, earning_kes, tier)
      VALUES (v_tier2_creator_id, p_user_id, p_trigger_type, p_amount, v_platform_revenue, v_gateway_cost, v_net_margin, v_tier2_split, v_tier2_earning, 2);

      INSERT INTO transactions (user_id, amount, kind, note, method, status, counterparty_id, metadata)
      VALUES (v_tier2_creator_id, v_tier2_earning, 'creator_commission', 'Tier-2 earnings: ' || p_trigger_type, 'system', 'settled', p_user_id, jsonb_build_object('trigger_type', p_trigger_type, 'trigger_amount', p_amount, 'tier', 2));

      UPDATE creators SET total_earned_kes = total_earned_kes + v_tier2_earning WHERE user_id = v_tier2_creator_id;
    END IF;
  END IF;
END;
$$;

-- Function: Grant creator status (dev only)
CREATE OR REPLACE FUNCTION public.grant_creator_status(
  p_target_user_id uuid,
  p_recruited_by uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF auth.uid() != 'f5f5da38-c839-4ce4-94fc-10f3854674e0' THEN
    RAISE EXCEPTION 'Only dev can grant creator status';
  END IF;

  INSERT INTO creators (user_id, granted_by, recruited_by)
  VALUES (p_target_user_id, auth.uid(), p_recruited_by)
  ON CONFLICT (user_id) DO UPDATE SET status = 'active', recruited_by = COALESCE(p_recruited_by, creators.recruited_by);
END;
$$;

-- Function: Attribute a new user to a creator
-- Called during signup when the referral link belongs to a creator
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

  -- Increment creator's user count
  UPDATE creators SET total_users_brought = total_users_brought + 1 WHERE user_id = p_creator_id;
END;
$$;
