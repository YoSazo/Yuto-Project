-- Regulatory & Operational Infrastructure
-- KYC tiers, ToS acceptance tracking, support tickets, fraud alerts

-- ═══════════════════════════════════════════════════════════════
-- 1. KYC Verification Tiers
-- ═══════════════════════════════════════════════════════════════
-- Tier 0 (unverified): username only → max 5,000 KES/day, max 2,000 per tx
-- Tier 1 (phone verified): phone_verified_at set → max 50,000 KES/day, max 50,000 per tx  
-- Tier 2 (ID verified): national_id submitted → max 150,000 KES/day, max 50,000 per tx
-- Future Tier 3: full KYC with selfie → unlimited

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS kyc_tier integer DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS national_id_number text DEFAULT NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS national_id_verified_at timestamptz DEFAULT NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tos_accepted_at timestamptz DEFAULT NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tos_version text DEFAULT NULL;

-- Helper: get user's KYC tier (computed from verification state)
CREATE OR REPLACE FUNCTION public.get_effective_kyc_tier(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tier integer;
  v_phone_verified timestamptz;
  v_id_verified timestamptz;
BEGIN
  SELECT kyc_tier, phone_verified_at, national_id_verified_at
  INTO v_tier, v_phone_verified, v_id_verified
  FROM profiles WHERE id = p_user_id;

  -- Auto-compute tier from verification state
  IF v_id_verified IS NOT NULL THEN
    RETURN 2;
  ELSIF v_phone_verified IS NOT NULL THEN
    RETURN 1;
  ELSE
    RETURN 0;
  END IF;
END;
$$;

-- Helper: get daily limit for a KYC tier
CREATE OR REPLACE FUNCTION public.get_daily_limit_for_tier(p_tier integer)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_tier >= 2 THEN 150000
    WHEN p_tier = 1 THEN 50000
    ELSE 5000
  END::numeric;
$$;

-- Helper: get per-transaction limit for a KYC tier
CREATE OR REPLACE FUNCTION public.get_tx_limit_for_tier(p_tier integer)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_tier >= 1 THEN 50000
    ELSE 2000
  END::numeric;
$$;

GRANT EXECUTE ON FUNCTION public.get_effective_kyc_tier(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_daily_limit_for_tier(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_tx_limit_for_tier(integer) TO authenticated;

-- ═══════════════════════════════════════════════════════════════
-- 2. Terms of Service Acceptance Tracking
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.tos_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tos_version text NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  device_info text
);

CREATE INDEX IF NOT EXISTS idx_tos_acceptances_user ON tos_acceptances(user_id, accepted_at DESC);

ALTER TABLE tos_acceptances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own tos acceptances" ON tos_acceptances
  FOR SELECT USING (auth.uid() = user_id);

-- RPC: accept ToS (called from client on signup or when new version is published)
CREATE OR REPLACE FUNCTION public.accept_tos(
  p_version text,
  p_ip_address text DEFAULT NULL,
  p_device_info text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO tos_acceptances (user_id, tos_version, ip_address, device_info)
  VALUES (v_user, p_version, p_ip_address, p_device_info);

  UPDATE profiles SET tos_accepted_at = now(), tos_version = p_version
  WHERE id = v_user;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_tos(text, text, text) TO authenticated;

-- ═══════════════════════════════════════════════════════════════
-- 3. Support Tickets
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('payment_issue', 'account_access', 'dispute', 'bug_report', 'feature_request', 'other')),
  subject text NOT NULL,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority text DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  transaction_id text,
  admin_notes text,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_user ON support_tickets(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status) WHERE status IN ('open', 'in_progress');

ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own tickets" ON support_tickets
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users create own tickets" ON support_tickets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RPC: create support ticket
CREATE OR REPLACE FUNCTION public.create_support_ticket(
  p_category text,
  p_subject text,
  p_description text,
  p_transaction_id text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_ticket_id uuid;
  v_priority text := 'normal';
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Auto-escalate priority for payment issues
  IF p_category = 'payment_issue' THEN
    v_priority := 'high';
  END IF;

  INSERT INTO support_tickets (user_id, category, subject, description, transaction_id, priority)
  VALUES (v_user, p_category, p_subject, p_description, p_transaction_id, v_priority)
  RETURNING id INTO v_ticket_id;

  -- Log audit event
  PERFORM log_audit_event(v_user, 'support_ticket_created', jsonb_build_object(
    'ticket_id', v_ticket_id,
    'category', p_category,
    'subject', p_subject
  ));

  RETURN v_ticket_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_support_ticket(text, text, text, text) TO authenticated;

-- ═══════════════════════════════════════════════════════════════
-- 4. Fraud Alerts
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.fraud_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id),
  alert_type text NOT NULL CHECK (alert_type IN (
    'daily_limit_hit', 'rapid_transfers', 'new_device_large_send',
    'multiple_failed_pins', 'suspicious_pattern', 'large_withdrawal'
  )),
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  metadata jsonb DEFAULT '{}',
  acknowledged boolean DEFAULT false,
  acknowledged_by text,
  acknowledged_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fraud_alerts_user ON fraud_alerts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fraud_alerts_unacked ON fraud_alerts(acknowledged) WHERE acknowledged = false;

ALTER TABLE fraud_alerts ENABLE ROW LEVEL SECURITY;
-- No user-facing SELECT — admin only (via service role)

-- RPC: log a fraud alert (called from transfer RPCs when limits are hit)
CREATE OR REPLACE FUNCTION public.log_fraud_alert(
  p_user_id uuid,
  p_alert_type text,
  p_severity text DEFAULT 'medium',
  p_metadata jsonb DEFAULT '{}'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO fraud_alerts (user_id, alert_type, severity, metadata)
  VALUES (p_user_id, p_alert_type, p_severity, p_metadata);
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- 5. Update transfer_yuto_balance with KYC-tiered limits + fraud alerts
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.transfer_yuto_balance(
  p_to_user_id uuid,
  p_amount_kes integer,
  p_note text default null
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from uuid := auth.uid();
  v_amount numeric := coalesce(p_amount_kes, 0);
  v_from_wallet_id uuid;
  v_to_wallet_id uuid;
  v_from_bal numeric;
  v_daily_total numeric;
  v_kyc_tier integer;
  v_daily_limit numeric;
  v_tx_limit numeric;
BEGIN
  IF v_from IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_to_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing recipient';
  END IF;
  IF p_to_user_id = v_from THEN
    RAISE EXCEPTION 'Cannot send to yourself';
  END IF;
  IF v_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  -- Wallet lock enforcement
  IF EXISTS (SELECT 1 FROM wallets WHERE user_id = v_from AND locked_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Wallet is locked';
  END IF;

  -- KYC-tiered limits
  v_kyc_tier := get_effective_kyc_tier(v_from);
  v_tx_limit := get_tx_limit_for_tier(v_kyc_tier);
  v_daily_limit := get_daily_limit_for_tier(v_kyc_tier);

  IF v_amount > v_tx_limit THEN
    RAISE EXCEPTION 'Amount exceeds your transaction limit (KSH %). Verify your identity to increase limits.', v_tx_limit;
  END IF;

  -- Daily cumulative limit (KYC-tiered)
  SELECT COALESCE(SUM(ABS(amount)), 0) INTO v_daily_total
  FROM transactions
  WHERE user_id = v_from
    AND kind = 'transfer_sent'
    AND created_at > now() - interval '24 hours';

  IF v_daily_total + v_amount > v_daily_limit THEN
    -- Log fraud alert
    PERFORM log_fraud_alert(v_from, 'daily_limit_hit', 'high', jsonb_build_object(
      'attempted_amount', v_amount,
      'daily_total', v_daily_total,
      'daily_limit', v_daily_limit,
      'kyc_tier', v_kyc_tier
    ));
    RAISE EXCEPTION 'Daily transfer limit exceeded (KSH %). Verify your identity to increase limits.', v_daily_limit;
  END IF;

  -- Lock sender wallet row
  SELECT w.id, w.balance::numeric
    INTO v_from_wallet_id, v_from_bal
  FROM public.wallets w
  WHERE w.user_id = v_from
  LIMIT 1
  FOR UPDATE;

  IF v_from_wallet_id IS NULL THEN
    SELECT w.id, w.balance::numeric
      INTO v_from_wallet_id, v_from_bal
    FROM public.wallets w
    WHERE w.id = v_from
    LIMIT 1
    FOR UPDATE;
  END IF;

  IF v_from_wallet_id IS NOT NULL THEN
    IF coalesce(v_from_bal, 0) < v_amount THEN
      RAISE EXCEPTION 'Insufficient Yuto balance';
    END IF;
    UPDATE public.wallets w
    SET balance = w.balance - v_amount
    WHERE w.id = v_from_wallet_id AND w.balance::numeric >= v_amount;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Insufficient Yuto balance';
    END IF;
  ELSE
    IF (SELECT coalesce(p.balance, 0)::numeric FROM public.profiles p WHERE p.id = v_from) < v_amount THEN
      RAISE EXCEPTION 'Insufficient Yuto balance';
    END IF;
    UPDATE public.profiles p
    SET balance = p.balance - v_amount
    WHERE p.id = v_from AND coalesce(p.balance, 0)::numeric >= v_amount;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Insufficient Yuto balance';
    END IF;
  END IF;

  -- Credit recipient
  SELECT w.id INTO v_to_wallet_id
  FROM public.wallets w
  WHERE w.user_id = p_to_user_id
  LIMIT 1
  FOR UPDATE;

  IF v_to_wallet_id IS NULL THEN
    SELECT w.id INTO v_to_wallet_id
    FROM public.wallets w
    WHERE w.id = p_to_user_id
    LIMIT 1
    FOR UPDATE;
  END IF;

  IF v_to_wallet_id IS NOT NULL THEN
    UPDATE public.wallets w
    SET balance = w.balance + v_amount
    WHERE w.id = v_to_wallet_id;
  ELSE
    BEGIN
      INSERT INTO public.wallets (user_id, balance)
      VALUES (p_to_user_id, v_amount)
      RETURNING id INTO v_to_wallet_id;
    EXCEPTION WHEN undefined_table THEN
      UPDATE public.profiles p
      SET balance = coalesce(p.balance, 0) + v_amount
      WHERE p.id = p_to_user_id;
    END;
  END IF;

  -- Transaction records
  BEGIN
    INSERT INTO public.transactions (user_id, amount, kind, created_at, note, counterparty_id, status, method)
    VALUES (v_from, -v_amount, 'transfer_sent', now(), p_note, p_to_user_id, 'settled', 'p2p');
    INSERT INTO public.transactions (user_id, amount, kind, created_at, note, counterparty_id, status, method)
    VALUES (p_to_user_id, v_amount, 'transfer_received', now(), p_note, v_from, 'settled', 'p2p');
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    NULL;
  END;

  -- In-app notification for recipient
  INSERT INTO public.notifications(user_id, actor_id, type, title, body, reference_kind, reference_id, amount_kes, cta_label, cta_action)
  VALUES (
    p_to_user_id, v_from, 'wallet_transfer_received', 'Yuto Balance received',
    coalesce(p_note, 'You received money.'), 'wallet_transfer', v_from::text,
    p_amount_kes, 'View wallet', '/profile'
  );

  -- Audit log
  PERFORM log_audit_event(v_from, 'transfer_sent', jsonb_build_object(
    'amount_kes', v_amount, 'recipient_id', p_to_user_id, 'method', 'p2p'
  ));
END;
$$;

REVOKE ALL ON FUNCTION public.transfer_yuto_balance(uuid, integer, text) FROM public;
GRANT EXECUTE ON FUNCTION public.transfer_yuto_balance(uuid, integer, text) TO authenticated;

-- ═══════════════════════════════════════════════════════════════
-- 6. Update settle_offline_transfer with KYC-tiered limits + fraud alerts
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.settle_offline_transfer(
  p_tx_id text,
  p_sender_id uuid,
  p_recipient_id uuid,
  p_amount_kes numeric,
  p_timestamp bigint,
  p_hmac text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sender_balance numeric;
  v_age_hours numeric;
  v_caller uuid;
  v_daily_total numeric;
  v_kyc_tier integer;
  v_daily_limit numeric;
  v_tx_limit numeric;
BEGIN
  v_caller := auth.uid();
  IF v_caller IS NULL OR v_caller != p_sender_id THEN
    RETURN 'unauthorized';
  END IF;

  -- Wallet lock enforcement
  IF EXISTS (SELECT 1 FROM wallets WHERE user_id = p_sender_id AND locked_at IS NOT NULL) THEN
    RETURN 'wallet_locked';
  END IF;

  -- KYC-tiered limits
  v_kyc_tier := get_effective_kyc_tier(p_sender_id);
  v_tx_limit := get_tx_limit_for_tier(v_kyc_tier);
  v_daily_limit := get_daily_limit_for_tier(v_kyc_tier);

  IF p_amount_kes < 1 OR p_amount_kes > v_tx_limit THEN
    RETURN 'invalid_amount';
  END IF;

  -- HMAC signature required
  IF p_hmac IS NULL OR length(trim(p_hmac)) = 0 THEN
    RETURN 'invalid_signature';
  END IF;

  -- Idempotency check
  IF EXISTS (SELECT 1 FROM offline_tx_log WHERE tx_id = p_tx_id) THEN
    RETURN 'already_settled';
  END IF;

  -- Expiry: 1 hour
  v_age_hours := (EXTRACT(EPOCH FROM now()) * 1000 - p_timestamp) / 3600000.0;
  IF v_age_hours > 1 THEN
    INSERT INTO offline_tx_log (tx_id, sender_id, recipient_id, amount_kes, created_at, status)
    VALUES (p_tx_id, p_sender_id, p_recipient_id, p_amount_kes, to_timestamp(p_timestamp / 1000.0), 'expired');
    RETURN 'expired';
  END IF;

  -- Daily cumulative limit (KYC-tiered)
  SELECT COALESCE(SUM(amount_kes), 0) INTO v_daily_total
  FROM offline_tx_log
  WHERE sender_id = p_sender_id
    AND status = 'settled'
    AND settled_at > now() - interval '24 hours';

  IF v_daily_total + p_amount_kes > v_daily_limit THEN
    PERFORM log_fraud_alert(p_sender_id, 'daily_limit_hit', 'high', jsonb_build_object(
      'attempted_amount', p_amount_kes,
      'daily_total', v_daily_total,
      'daily_limit', v_daily_limit,
      'kyc_tier', v_kyc_tier,
      'method', 'offline_ble'
    ));
    RETURN 'daily_limit_exceeded';
  END IF;

  -- Check sender balance
  SELECT balance INTO v_sender_balance FROM wallets WHERE user_id = p_sender_id FOR UPDATE;
  IF v_sender_balance IS NULL OR v_sender_balance < p_amount_kes THEN
    INSERT INTO offline_tx_log (tx_id, sender_id, recipient_id, amount_kes, created_at, status)
    VALUES (p_tx_id, p_sender_id, p_recipient_id, p_amount_kes, to_timestamp(p_timestamp / 1000.0), 'rejected');
    RETURN 'insufficient_balance';
  END IF;

  -- Execute transfer
  UPDATE wallets SET balance = balance - p_amount_kes WHERE user_id = p_sender_id;
  INSERT INTO wallets (user_id, balance) VALUES (p_recipient_id, p_amount_kes)
  ON CONFLICT (user_id) DO UPDATE SET balance = wallets.balance + p_amount_kes;

  -- Log settlement
  INSERT INTO offline_tx_log (tx_id, sender_id, recipient_id, amount_kes, created_at, status)
  VALUES (p_tx_id, p_sender_id, p_recipient_id, p_amount_kes, to_timestamp(p_timestamp / 1000.0), 'settled');

  -- Transaction records
  INSERT INTO transactions (user_id, amount, kind, note, method, status, counterparty_id, metadata)
  VALUES
    (p_sender_id, -p_amount_kes, 'transfer_sent', 'Bluetooth P2P (offline)', 'bluetooth', 'settled', p_recipient_id, jsonb_build_object('offline_tx_id', p_tx_id)),
    (p_recipient_id, p_amount_kes, 'transfer_received', 'Bluetooth P2P (offline)', 'bluetooth', 'settled', p_sender_id, jsonb_build_object('offline_tx_id', p_tx_id));

  -- Audit log
  PERFORM log_audit_event(p_sender_id, 'transfer_sent', jsonb_build_object(
    'amount_kes', p_amount_kes, 'recipient_id', p_recipient_id, 'method', 'offline_ble', 'tx_id', p_tx_id
  ));

  RETURN 'settled';
END;
$$;

GRANT EXECUTE ON FUNCTION public.settle_offline_transfer(text, uuid, uuid, numeric, bigint, text) TO authenticated;

-- ═══════════════════════════════════════════════════════════════
-- 7. Admin query helpers (for future admin dashboard, uses service role)
-- ═══════════════════════════════════════════════════════════════

-- Get user overview (admin use via service role)
CREATE OR REPLACE FUNCTION public.admin_get_user_overview(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'profile', (SELECT row_to_json(p.*) FROM profiles p WHERE p.id = p_user_id),
    'wallet', (SELECT row_to_json(w.*) FROM wallets w WHERE w.user_id = p_user_id),
    'kyc_tier', get_effective_kyc_tier(p_user_id),
    'recent_transactions', (SELECT jsonb_agg(row_to_json(t.*)) FROM (
      SELECT * FROM transactions WHERE user_id = p_user_id ORDER BY created_at DESC LIMIT 20
    ) t),
    'recent_audit_events', (SELECT jsonb_agg(row_to_json(a.*)) FROM (
      SELECT * FROM audit_events WHERE user_id = p_user_id ORDER BY created_at DESC LIMIT 20
    ) a),
    'open_disputes', (SELECT jsonb_agg(row_to_json(d.*)) FROM (
      SELECT * FROM disputes WHERE (disputer_id = p_user_id OR counterparty_id = p_user_id) AND status = 'open'
    ) d),
    'open_tickets', (SELECT jsonb_agg(row_to_json(s.*)) FROM (
      SELECT * FROM support_tickets WHERE user_id = p_user_id AND status IN ('open', 'in_progress')
    ) s),
    'fraud_alerts', (SELECT jsonb_agg(row_to_json(f.*)) FROM (
      SELECT * FROM fraud_alerts WHERE user_id = p_user_id ORDER BY created_at DESC LIMIT 10
    ) f)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- Note: admin_get_user_overview is NOT granted to authenticated — only callable via service role
