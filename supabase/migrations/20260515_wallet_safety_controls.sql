-- Wallet Safety Controls: PIN gate, wallet lock/freeze, disputes, audit logging
-- Adds: profiles.pin_hash, wallets.locked_at, disputes table, audit_events table
-- RPCs: log_audit_event, lock_wallet, unlock_wallet, create_dispute, resolve_dispute
-- Modifies: transfer_yuto_balance (lock check), settle_offline_transfer (lock check)

-- Ensure pgcrypto extension is available (for crypt() in unlock_wallet)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ═══════════════════════════════════════════════════════════════
-- 1. Schema Changes — New Columns
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS pin_hash text DEFAULT NULL;
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS locked_at timestamptz DEFAULT NULL;

-- ═══════════════════════════════════════════════════════════════
-- 2. New Tables
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id text NOT NULL,
  disputer_id uuid NOT NULL REFERENCES profiles(id),
  counterparty_id uuid NOT NULL REFERENCES profiles(id),
  reason text NOT NULL CHECK (reason IN ('wrong_person', 'wrong_amount', 'didnt_receive_item', 'unauthorized')),
  note text,
  amount_kes numeric NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'denied')),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE TABLE IF NOT EXISTS audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id),
  event_type text NOT NULL,
  metadata jsonb DEFAULT '{}',
  ip_address text,
  device_info text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════
-- 3. Indexes
-- ═══════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_audit_events_user_created
  ON audit_events (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_disputes_disputer
  ON disputes (disputer_id);

CREATE INDEX IF NOT EXISTS idx_disputes_counterparty
  ON disputes (counterparty_id);

-- ═══════════════════════════════════════════════════════════════
-- 4. RLS Policies
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own disputes"
  ON disputes FOR SELECT
  USING (auth.uid() = disputer_id OR auth.uid() = counterparty_id);

ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own audit events"
  ON audit_events FOR SELECT
  USING (auth.uid() = user_id);

-- No INSERT policy for authenticated role — only SECURITY DEFINER functions can insert

-- ═══════════════════════════════════════════════════════════════
-- 5. RPC Functions
-- ═══════════════════════════════════════════════════════════════

-- 5.1 log_audit_event
CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_user_id uuid,
  p_event_type text,
  p_metadata jsonb DEFAULT '{}',
  p_ip_address text DEFAULT NULL,
  p_device_info text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO audit_events (user_id, event_type, metadata, ip_address, device_info)
  VALUES (p_user_id, p_event_type, p_metadata, p_ip_address, p_device_info);
END;
$$;

-- 5.2 lock_wallet
CREATE OR REPLACE FUNCTION public.lock_wallet()
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

  UPDATE wallets SET locked_at = now() WHERE user_id = v_user;

  PERFORM log_audit_event(v_user, 'wallet_locked', '{}');
END;
$$;

-- 5.3 unlock_wallet
CREATE OR REPLACE FUNCTION public.unlock_wallet(p_pin text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_pin_hash text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT pin_hash INTO v_pin_hash FROM profiles WHERE id = v_user;

  IF v_pin_hash IS NULL THEN
    RETURN 'no_pin_set';
  END IF;

  IF crypt(p_pin, v_pin_hash) = v_pin_hash THEN
    UPDATE wallets SET locked_at = NULL WHERE user_id = v_user;
    PERFORM log_audit_event(v_user, 'wallet_unlocked', '{}');
    RETURN 'unlocked';
  ELSE
    RETURN 'invalid_pin';
  END IF;
END;
$$;

-- 5.4 create_dispute
CREATE OR REPLACE FUNCTION public.create_dispute(
  p_transaction_id text,
  p_reason text,
  p_note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_tx record;
  v_dispute_id uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Find the transaction and validate ownership
  SELECT * INTO v_tx FROM transactions
  WHERE id::text = p_transaction_id AND user_id = v_user
  LIMIT 1;

  IF v_tx IS NULL THEN
    RAISE EXCEPTION 'Transaction not found';
  END IF;

  -- Validate 7-day dispute window
  IF v_tx.created_at < now() - interval '7 days' THEN
    RAISE EXCEPTION 'Dispute window expired (7 days)';
  END IF;

  -- Insert dispute record
  INSERT INTO disputes (transaction_id, disputer_id, counterparty_id, reason, note, amount_kes)
  VALUES (p_transaction_id, v_user, v_tx.counterparty_id, p_reason, p_note, ABS(v_tx.amount))
  RETURNING id INTO v_dispute_id;

  -- Notify counterparty
  INSERT INTO notifications (user_id, actor_id, type, title, body, reference_kind, reference_id)
  VALUES (
    v_tx.counterparty_id, v_user, 'dispute_opened',
    'Refund requested',
    (SELECT display_name FROM profiles WHERE id = v_user) || ' requested a refund of KSH ' || ABS(v_tx.amount),
    'dispute', v_dispute_id::text
  );

  -- Log audit event
  PERFORM log_audit_event(v_user, 'dispute_opened', jsonb_build_object(
    'dispute_id', v_dispute_id,
    'transaction_id', p_transaction_id,
    'amount_kes', ABS(v_tx.amount)
  ));

  RETURN v_dispute_id;
END;
$$;

-- 5.5 resolve_dispute
CREATE OR REPLACE FUNCTION public.resolve_dispute(
  p_dispute_id uuid,
  p_action text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_dispute record;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Only the counterparty can resolve an open dispute
  SELECT * INTO v_dispute FROM disputes
  WHERE id = p_dispute_id AND counterparty_id = v_user AND status = 'open';

  IF v_dispute IS NULL THEN
    RAISE EXCEPTION 'Dispute not found or not authorized';
  END IF;

  IF p_action = 'approve' THEN
    -- Execute reverse transfer atomically
    UPDATE wallets SET balance = balance - v_dispute.amount_kes WHERE user_id = v_user;
    UPDATE wallets SET balance = balance + v_dispute.amount_kes WHERE user_id = v_dispute.disputer_id;

    -- Update dispute status
    UPDATE disputes SET status = 'resolved', resolved_at = now() WHERE id = p_dispute_id;

    -- Transaction records for the reversal
    INSERT INTO transactions (user_id, amount, kind, note, status, counterparty_id, metadata)
    VALUES
      (v_user, -v_dispute.amount_kes, 'dispute_refund_sent', 'Dispute refund', 'settled', v_dispute.disputer_id, jsonb_build_object('dispute_id', p_dispute_id)),
      (v_dispute.disputer_id, v_dispute.amount_kes, 'dispute_refund_received', 'Dispute refund', 'settled', v_user, jsonb_build_object('dispute_id', p_dispute_id));

    -- Log audit event
    PERFORM log_audit_event(v_user, 'dispute_resolved', jsonb_build_object(
      'dispute_id', p_dispute_id,
      'action', 'approve',
      'amount_kes', v_dispute.amount_kes
    ));

    RETURN 'resolved';

  ELSIF p_action = 'deny' THEN
    -- Update dispute status
    UPDATE disputes SET status = 'denied', resolved_at = now() WHERE id = p_dispute_id;

    -- Notify disputer
    INSERT INTO notifications (user_id, actor_id, type, title, body, reference_kind, reference_id)
    VALUES (
      v_dispute.disputer_id, v_user, 'dispute_denied',
      'Refund denied',
      'Your refund request was denied.',
      'dispute', p_dispute_id::text
    );

    -- Log audit event
    PERFORM log_audit_event(v_user, 'dispute_resolved', jsonb_build_object(
      'dispute_id', p_dispute_id,
      'action', 'deny'
    ));

    RETURN 'denied';

  ELSE
    RAISE EXCEPTION 'Invalid action. Use approve or deny.';
  END IF;
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- 6. Modify transfer_yuto_balance — add wallet lock check
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

  -- Amount bounds (security hardening)
  IF v_amount < 1 THEN
    RAISE EXCEPTION 'Amount below minimum (1 KES)';
  END IF;
  IF v_amount > 50000 THEN
    RAISE EXCEPTION 'Amount exceeds maximum (50,000 KES)';
  END IF;

  -- Daily cumulative limit (150,000 KES rolling 24h)
  SELECT COALESCE(SUM(ABS(amount)), 0) INTO v_daily_total
  FROM transactions
  WHERE user_id = v_from
    AND kind = 'transfer_sent'
    AND created_at > now() - interval '24 hours';

  IF v_daily_total + v_amount > 150000 THEN
    RAISE EXCEPTION 'Daily transfer limit exceeded (150,000 KES)';
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
    VALUES (v_from, -v_amount, 'transfer_sent', now(), p_note, p_to_user_id, 'settled', 'bluetooth');
    INSERT INTO public.transactions (user_id, amount, kind, created_at, note, counterparty_id, status, method)
    VALUES (p_to_user_id, v_amount, 'transfer_received', now(), p_note, v_from, 'settled', 'bluetooth');
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
END;
$$;

REVOKE ALL ON FUNCTION public.transfer_yuto_balance(uuid, integer, text) FROM public;
GRANT EXECUTE ON FUNCTION public.transfer_yuto_balance(uuid, integer, text) TO authenticated;

-- ═══════════════════════════════════════════════════════════════
-- 7. Modify settle_offline_transfer — add wallet lock check
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
BEGIN
  -- Auth check: only the sender can settle their own transactions
  v_caller := auth.uid();
  IF v_caller IS NULL OR v_caller != p_sender_id THEN
    RETURN 'unauthorized';
  END IF;

  -- Wallet lock enforcement
  IF EXISTS (SELECT 1 FROM wallets WHERE user_id = p_sender_id AND locked_at IS NOT NULL) THEN
    RETURN 'wallet_locked';
  END IF;

  -- Amount bounds (security hardening)
  IF p_amount_kes < 1 OR p_amount_kes > 50000 THEN
    RETURN 'invalid_amount';
  END IF;

  -- HMAC signature required (security hardening)
  IF p_hmac IS NULL OR length(trim(p_hmac)) = 0 THEN
    RETURN 'invalid_signature';
  END IF;

  -- Idempotency check
  IF EXISTS (SELECT 1 FROM offline_tx_log WHERE tx_id = p_tx_id) THEN
    RETURN 'already_settled';
  END IF;

  -- Expiry: 1 hour (reduced from 24h for security)
  v_age_hours := (EXTRACT(EPOCH FROM now()) * 1000 - p_timestamp) / 3600000.0;
  IF v_age_hours > 1 THEN
    INSERT INTO offline_tx_log (tx_id, sender_id, recipient_id, amount_kes, created_at, status)
    VALUES (p_tx_id, p_sender_id, p_recipient_id, p_amount_kes, to_timestamp(p_timestamp / 1000.0), 'expired');
    RETURN 'expired';
  END IF;

  -- Daily cumulative limit (150,000 KES rolling 24h)
  SELECT COALESCE(SUM(amount_kes), 0) INTO v_daily_total
  FROM offline_tx_log
  WHERE sender_id = p_sender_id
    AND status = 'settled'
    AND settled_at > now() - interval '24 hours';

  IF v_daily_total + p_amount_kes > 150000 THEN
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

  RETURN 'settled';
END;
$$;

-- Grant with signature (includes p_hmac parameter)
GRANT EXECUTE ON FUNCTION public.settle_offline_transfer(text, uuid, uuid, numeric, bigint, text) TO authenticated;

-- ═══════════════════════════════════════════════════════════════
-- 8. Grant execute on new functions to authenticated role
-- ═══════════════════════════════════════════════════════════════

GRANT EXECUTE ON FUNCTION public.log_audit_event(uuid, text, jsonb, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lock_wallet() TO authenticated;
GRANT EXECUTE ON FUNCTION public.unlock_wallet(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_dispute(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_dispute(uuid, text) TO authenticated;
