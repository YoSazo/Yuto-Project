-- ============================================================
-- YUTO MONEY SECURITY FIXES — May 2026
-- Applied to production Supabase. Versioned here for git parity.
-- ============================================================

-- 1. pay_for_plan: wallets-based, amount validated, collected_balance updated
DROP FUNCTION IF EXISTS public.pay_for_plan(uuid, integer);
DROP FUNCTION IF EXISTS public.pay_for_plan(uuid, numeric);

CREATE OR REPLACE FUNCTION public.pay_for_plan(p_group_id uuid, p_amount integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id uuid; v_wallet_id uuid; v_balance numeric; v_group record;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT id, balance INTO v_wallet_id, v_balance FROM wallets WHERE user_id = v_user_id FOR UPDATE;
  IF v_wallet_id IS NULL THEN RAISE EXCEPTION 'No wallet found'; END IF;
  SELECT * INTO v_group FROM groups WHERE id = p_group_id;
  IF v_group IS NULL THEN RAISE EXCEPTION 'Group not found'; END IF;
  IF p_amount < v_group.per_person THEN RAISE EXCEPTION 'Amount % is less than required %', p_amount, v_group.per_person; END IF;
  IF v_balance < p_amount THEN RAISE EXCEPTION 'Insufficient Yuto Balance (have %, need %)', v_balance, p_amount; END IF;
  UPDATE wallets SET balance = balance - p_amount WHERE id = v_wallet_id;
  UPDATE group_members SET has_paid = true, paid_at = now() WHERE group_id = p_group_id AND user_id = v_user_id;
  UPDATE groups SET collected_balance = COALESCE(collected_balance, 0) + p_amount WHERE id = p_group_id;
  INSERT INTO wallets (user_id, balance) VALUES (v_group.created_by, p_amount) ON CONFLICT (user_id) DO UPDATE SET balance = wallets.balance + p_amount;
  INSERT INTO transactions (user_id, amount, kind, note, method, status, counterparty_id, metadata) VALUES
    (v_user_id, -p_amount, 'split_payment_sent', 'Split: ' || v_group.name, 'wallet', 'settled', v_group.created_by, jsonb_build_object('group_id', p_group_id)),
    (v_group.created_by, p_amount, 'split_payment_received', 'Split received: ' || v_group.name, 'wallet', 'settled', v_user_id, jsonb_build_object('group_id', p_group_id));
END; $$;

-- 2. pay_for_function: wallets-based, FOR UPDATE, idempotent
DROP FUNCTION IF EXISTS public.pay_for_function(uuid);

CREATE OR REPLACE FUNCTION public.pay_for_function(p_function_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id uuid; v_wallet_id uuid; v_balance numeric; v_function record; v_already_paid boolean;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_function FROM functions WHERE id = p_function_id FOR UPDATE;
  IF v_function IS NULL THEN RAISE EXCEPTION 'Function not found'; END IF;
  IF v_function.status = 'cancelled' THEN RAISE EXCEPTION 'This function has been cancelled'; END IF;
  SELECT has_paid INTO v_already_paid FROM function_members WHERE function_id = p_function_id AND user_id = v_user_id;
  IF v_already_paid = true THEN RETURN; END IF;
  SELECT id, balance INTO v_wallet_id, v_balance FROM wallets WHERE user_id = v_user_id FOR UPDATE;
  IF v_wallet_id IS NULL THEN RAISE EXCEPTION 'No wallet found'; END IF;
  IF v_balance < v_function.amount_per_person THEN RAISE EXCEPTION 'Insufficient Yuto Balance (have %, need %)', v_balance, v_function.amount_per_person; END IF;
  UPDATE wallets SET balance = balance - v_function.amount_per_person WHERE id = v_wallet_id;
  INSERT INTO function_members (function_id, user_id, has_paid, joined_at, paid_at) VALUES (p_function_id, v_user_id, true, now(), now()) ON CONFLICT (function_id, user_id) DO UPDATE SET has_paid = true, paid_at = now();
  INSERT INTO wallets (user_id, balance) VALUES (v_function.host_id, v_function.amount_per_person) ON CONFLICT (user_id) DO UPDATE SET balance = wallets.balance + v_function.amount_per_person;
  INSERT INTO transactions (user_id, amount, kind, note, method, status, counterparty_id, metadata) VALUES
    (v_user_id, -v_function.amount_per_person, 'function_payment_sent', 'Ticket: ' || v_function.title, 'wallet', 'settled', v_function.host_id, jsonb_build_object('function_id', p_function_id)),
    (v_function.host_id, v_function.amount_per_person, 'function_payment_received', 'Ticket sold: ' || v_function.title, 'wallet', 'settled', v_user_id, jsonb_build_object('function_id', p_function_id));
END; $$;

-- 3. cancel_split_group: refunds members, debits host
DROP FUNCTION IF EXISTS public.cancel_split_group(uuid);

CREATE OR REPLACE FUNCTION public.cancel_split_group(p_group_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id uuid; v_group record; v_member record; v_per_person numeric; v_total_to_debit_host numeric := 0;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_group FROM groups WHERE id = p_group_id FOR UPDATE;
  IF v_group IS NULL THEN RAISE EXCEPTION 'Group not found'; END IF;
  IF v_group.created_by != v_user_id THEN RAISE EXCEPTION 'Only the group creator can cancel'; END IF;
  IF v_group.status = 'cancelled' THEN RETURN; END IF;
  v_per_person := COALESCE(v_group.per_person, 0);
  FOR v_member IN SELECT user_id, has_paid FROM group_members WHERE group_id = p_group_id AND has_paid = true LOOP
    IF v_member.user_id != v_group.created_by THEN
      UPDATE wallets SET balance = balance + v_per_person WHERE user_id = v_member.user_id;
      v_total_to_debit_host := v_total_to_debit_host + v_per_person;
      INSERT INTO transactions (user_id, amount, kind, note, method, status, counterparty_id, metadata) VALUES (v_member.user_id, v_per_person, 'split_refund', 'Split cancelled: ' || v_group.name, 'system', 'settled', v_group.created_by, jsonb_build_object('group_id', p_group_id));
    END IF;
  END LOOP;
  IF v_total_to_debit_host > 0 THEN
    UPDATE wallets SET balance = GREATEST(0, balance - v_total_to_debit_host) WHERE user_id = v_group.created_by;
    INSERT INTO transactions (user_id, amount, kind, note, method, status, metadata) VALUES (v_group.created_by, -v_total_to_debit_host, 'split_cancel_debit', 'Split cancelled (refunds): ' || v_group.name, 'system', 'settled', jsonb_build_object('group_id', p_group_id));
  END IF;
  UPDATE groups SET status = 'cancelled', collected_balance = 0 WHERE id = p_group_id;
  UPDATE group_members SET has_paid = false WHERE group_id = p_group_id;
END; $$;

-- 4. leave_split_group: refunds paid member on removal, debits host
DROP FUNCTION IF EXISTS public.leave_split_group(uuid, uuid);

CREATE OR REPLACE FUNCTION public.leave_split_group(p_group_id uuid, p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_caller uuid; v_group record; v_member record; v_per_person numeric;
BEGIN
  v_caller := auth.uid();
  IF v_caller IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_group FROM groups WHERE id = p_group_id;
  IF v_group IS NULL THEN RAISE EXCEPTION 'Group not found'; END IF;
  IF v_caller != p_user_id AND v_caller != v_group.created_by THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT * INTO v_member FROM group_members WHERE group_id = p_group_id AND user_id = p_user_id;
  IF v_member IS NULL THEN RETURN; END IF;
  v_per_person := COALESCE(v_group.per_person, 0);
  IF v_member.has_paid AND p_user_id != v_group.created_by AND v_per_person > 0 THEN
    UPDATE wallets SET balance = balance + v_per_person WHERE user_id = p_user_id;
    INSERT INTO transactions (user_id, amount, kind, note, method, status, counterparty_id, metadata) VALUES (p_user_id, v_per_person, 'split_refund', 'Removed from split: ' || v_group.name, 'system', 'settled', v_group.created_by, jsonb_build_object('group_id', p_group_id));
    UPDATE wallets SET balance = GREATEST(0, balance - v_per_person) WHERE user_id = v_group.created_by;
    INSERT INTO transactions (user_id, amount, kind, note, method, status, counterparty_id, metadata) VALUES (v_group.created_by, -v_per_person, 'split_member_removed_debit', 'Member removed: ' || v_group.name, 'system', 'settled', p_user_id, jsonb_build_object('group_id', p_group_id));
    UPDATE groups SET collected_balance = GREATEST(0, COALESCE(collected_balance, 0) - v_per_person) WHERE id = p_group_id;
  END IF;
  DELETE FROM group_members WHERE group_id = p_group_id AND user_id = p_user_id;
END; $$;

-- 5. initiate_withdrawal: single clean signature
DROP FUNCTION IF EXISTS public.initiate_withdrawl(numeric);
DROP FUNCTION IF EXISTS public.initiate_withdrawl(integer);
DROP FUNCTION IF EXISTS public.initiate_withdrawl(bigint);
DROP FUNCTION IF EXISTS public.initiate_withdrawal(numeric);
DROP FUNCTION IF EXISTS public.initiate_withdrawal(integer);
DROP FUNCTION IF EXISTS public.initiate_withdrawal(bigint);
DROP FUNCTION IF EXISTS public.initiate_withdrawal(p_amount numeric);
DROP FUNCTION IF EXISTS public.initiate_withdrawal(p_amount integer);

CREATE OR REPLACE FUNCTION public.initiate_withdrawal(p_amount integer)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_user_id uuid; v_wallet_id uuid; v_balance numeric; v_tx_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT id, balance INTO v_wallet_id, v_balance FROM wallets WHERE user_id = v_user_id FOR UPDATE;
  IF v_wallet_id IS NULL THEN RAISE EXCEPTION 'No wallet found'; END IF;
  IF v_balance < p_amount THEN RAISE EXCEPTION 'Insufficient balance (have %, need %)', v_balance, p_amount; END IF;
  UPDATE wallets SET balance = balance - p_amount WHERE id = v_wallet_id;
  INSERT INTO transactions (user_id, amount, kind, note, method, status) VALUES (v_user_id, -p_amount, 'withdrawal', 'Withdrawal to M-PESA (pending)', 'mpesa_b2c', 'pending') RETURNING id INTO v_tx_id;
  RETURN v_tx_id;
END; $$;

-- 6. refund_failed_withdrawal: idempotent (only refunds pending)
DROP FUNCTION IF EXISTS public.refund_failed_withdrawal(uuid);
DROP FUNCTION IF EXISTS public.refund_failed_withdrawal(p_transaction_id uuid);

CREATE OR REPLACE FUNCTION public.refund_failed_withdrawal(p_transaction_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_user_id uuid; v_amount numeric;
BEGIN
  SELECT user_id, ABS(amount) INTO v_user_id, v_amount FROM transactions WHERE id = p_transaction_id AND status = 'pending' AND kind = 'withdrawal';
  IF v_user_id IS NULL THEN RETURN; END IF;
  UPDATE wallets SET balance = balance + v_amount WHERE user_id = v_user_id;
  UPDATE transactions SET status = 'failed', note = 'Withdrawal failed — refunded' WHERE id = p_transaction_id;
END; $$;

-- 7. accept_wallet_offer: idempotent
DROP FUNCTION IF EXISTS public.accept_wallet_offer(uuid);
DROP FUNCTION IF EXISTS public.accept_wallet_offer(p_offer_id uuid);

CREATE OR REPLACE FUNCTION public.accept_wallet_offer(p_offer_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_offer record; v_acceptor_id uuid;
BEGIN
  v_acceptor_id := auth.uid();
  IF v_acceptor_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_offer FROM wallet_offers WHERE id = p_offer_id FOR UPDATE;
  IF v_offer IS NULL THEN RAISE EXCEPTION 'Offer not found'; END IF;
  IF v_offer.status != 'pending' THEN RETURN; END IF;
  IF v_offer.sender_id = v_acceptor_id THEN RAISE EXCEPTION 'Cannot accept your own offer'; END IF;
  IF v_offer.recipient_user_id IS NOT NULL AND v_offer.recipient_user_id != v_acceptor_id THEN RAISE EXCEPTION 'This offer is not for you'; END IF;
  UPDATE wallets SET balance = balance - v_offer.amount_kes WHERE user_id = v_offer.sender_id AND balance >= v_offer.amount_kes;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sender does not have enough funds'; END IF;
  INSERT INTO wallets (user_id, balance) VALUES (v_acceptor_id, v_offer.amount_kes) ON CONFLICT (user_id) DO UPDATE SET balance = wallets.balance + v_offer.amount_kes;
  UPDATE wallet_offers SET status = 'accepted', accepted_by = v_acceptor_id, accepted_at = now() WHERE id = p_offer_id;
  INSERT INTO transactions (user_id, amount, kind, note, method, status, counterparty_id, metadata) VALUES
    (v_offer.sender_id, -v_offer.amount_kes, 'wallet_offer_sent', v_offer.note, 'wallet', 'settled', v_acceptor_id, jsonb_build_object('offer_id', p_offer_id)),
    (v_acceptor_id, v_offer.amount_kes, 'wallet_offer_received', v_offer.note, 'wallet', 'settled', v_offer.sender_id, jsonb_build_object('offer_id', p_offer_id));
END; $$;

-- 8. RLS: Lock down groups and group_members
DROP POLICY IF EXISTS "Members can update group totals" ON public.groups;
DROP POLICY IF EXISTS "Only host can update group" ON public.groups;
CREATE POLICY "Only host can update group" ON public.groups FOR UPDATE USING (auth.uid() = created_by) WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Users can update own membership" ON public.group_members;
-- No replacement — all writes via SECURITY DEFINER RPCs only
