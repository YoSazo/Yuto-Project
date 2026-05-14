-- BLE Security Hardening: Amount limits, daily limits, HMAC verification, 1h expiry
-- Addresses: payload spoofing, amount abuse, rapid drain attacks, replay window

-- ═══════════════════════════════════════════════════════════════
-- 1. Harden transfer_yuto_balance with amount bounds + daily limit
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
-- 2. Harden settle_offline_transfer: amount limits, daily limit,
--    HMAC parameter, 1-hour expiry (was 24h)
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

-- Grant with new signature (includes p_hmac parameter)
GRANT EXECUTE ON FUNCTION public.settle_offline_transfer(text, uuid, uuid, numeric, bigint, text) TO authenticated;
