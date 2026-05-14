-- Offline transaction idempotency: prevent double-processing of BLE transfers
-- Each offline transaction has a unique ID. When syncing, we check if it was already settled.

CREATE TABLE IF NOT EXISTS public.offline_tx_log (
  tx_id text PRIMARY KEY,
  sender_id uuid NOT NULL REFERENCES public.profiles(id),
  recipient_id uuid NOT NULL REFERENCES public.profiles(id),
  amount_kes numeric NOT NULL,
  created_at timestamptz NOT NULL,
  settled_at timestamptz DEFAULT now(),
  status text DEFAULT 'settled' CHECK (status IN ('settled', 'rejected', 'expired'))
);

ALTER TABLE public.offline_tx_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own offline tx" ON public.offline_tx_log
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

-- Function: Settle an offline BLE transaction (idempotent)
-- Returns: 'settled', 'already_settled', 'insufficient_balance', 'expired'
CREATE OR REPLACE FUNCTION public.settle_offline_transfer(
  p_tx_id text,
  p_sender_id uuid,
  p_recipient_id uuid,
  p_amount_kes numeric,
  p_timestamp bigint -- unix ms
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sender_balance numeric;
  v_age_hours numeric;
BEGIN
  -- Check if already processed (idempotency)
  IF EXISTS (SELECT 1 FROM offline_tx_log WHERE tx_id = p_tx_id) THEN
    RETURN 'already_settled';
  END IF;

  -- Check age (reject if older than 24 hours)
  v_age_hours := (EXTRACT(EPOCH FROM now()) * 1000 - p_timestamp) / 3600000.0;
  IF v_age_hours > 24 THEN
    INSERT INTO offline_tx_log (tx_id, sender_id, recipient_id, amount_kes, created_at, status)
    VALUES (p_tx_id, p_sender_id, p_recipient_id, p_amount_kes, to_timestamp(p_timestamp / 1000.0), 'expired');
    RETURN 'expired';
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
  UPDATE wallets SET balance = balance + p_amount_kes WHERE user_id = p_recipient_id;

  -- If recipient has no wallet, create one
  IF NOT FOUND THEN
    INSERT INTO wallets (user_id, balance) VALUES (p_recipient_id, p_amount_kes)
    ON CONFLICT (user_id) DO UPDATE SET balance = wallets.balance + p_amount_kes;
  END IF;

  -- Log the settlement
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

GRANT EXECUTE ON FUNCTION public.settle_offline_transfer(text, uuid, uuid, numeric, bigint) TO authenticated;
