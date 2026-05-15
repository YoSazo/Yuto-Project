# Design Document: Wallet Safety Controls

## Overview

This design adds four safety layers to the Yuto wallet: a transaction PIN gate, a wallet lock/freeze mechanism, a peer-to-peer dispute system, and a comprehensive audit event log. The architecture prioritizes server-side enforcement (RPCs reject locked wallets regardless of client state), client-side UX (PIN modal, lock banner), and auditability (every security action logged atomically).

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Client (React + Capacitor)              │
│                                                             │
│  ┌──────────┐  ┌──────────────┐  ┌────────────────────┐    │
│  │ PinModal │  │ Lock Banner  │  │ Dispute Form/List  │    │
│  └────┬─────┘  └──────┬───────┘  └─────────┬──────────┘    │
│       │                │                    │               │
│  ┌────▼────────────────▼────────────────────▼───────────┐   │
│  │              Capacitor Preferences                    │   │
│  │  (pin_lockout_until, failed_count — client-side)      │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTPS / Supabase SDK
┌──────────────────────────▼──────────────────────────────────┐
│                    Vercel API Routes                         │
│  ┌──────────────┐  ┌──────────────┐                         │
│  │ /api/verify- │  │ /api/audit   │                         │
│  │    pin       │  │              │                         │
│  └──────┬───────┘  └──────┬───────┘                         │
└─────────┼──────────────────┼────────────────────────────────┘
          │                  │
┌─────────▼──────────────────▼────────────────────────────────┐
│                    Supabase (PostgreSQL)                     │
│                                                             │
│  profiles.pin_hash │ wallets.locked_at │ disputes │ audit   │
│                                                             │
│  RPCs: lock_wallet, unlock_wallet, create_dispute,          │
│        resolve_dispute, log_audit_event                     │
│  (transfer_yuto_balance + settle_offline_transfer modified) │
└─────────────────────────────────────────────────────────────┘
```

## Components

### 1. Database Schema Changes

#### profiles table — new column

```sql
ALTER TABLE profiles ADD COLUMN pin_hash text DEFAULT NULL;
```

- `pin_hash`: bcrypt hash of the user's 4-digit transaction PIN. NULL means PIN not yet set.

#### wallets table — new column

```sql
ALTER TABLE wallets ADD COLUMN locked_at timestamptz DEFAULT NULL;
```

- `locked_at`: timestamp when the wallet was locked. NULL means unlocked.

#### disputes table — new table

```sql
CREATE TABLE disputes (
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
```

#### audit_events table — new table

```sql
CREATE TABLE audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id),
  event_type text NOT NULL,
  metadata jsonb DEFAULT '{}',
  ip_address text,
  device_info text,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

### 2. RPC Functions

#### log_audit_event (SECURITY DEFINER)

```sql
CREATE OR REPLACE FUNCTION log_audit_event(
  p_user_id uuid,
  p_event_type text,
  p_metadata jsonb DEFAULT '{}',
  p_ip_address text DEFAULT NULL,
  p_device_info text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO audit_events (user_id, event_type, metadata, ip_address, device_info)
  VALUES (p_user_id, p_event_type, p_metadata, p_ip_address, p_device_info);
END;
$$;
```

#### lock_wallet

```sql
CREATE OR REPLACE FUNCTION lock_wallet()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  UPDATE wallets SET locked_at = now() WHERE user_id = v_user;
  PERFORM log_audit_event(v_user, 'wallet_locked', '{}');
END;
$$;
```

#### unlock_wallet

```sql
CREATE OR REPLACE FUNCTION unlock_wallet(p_pin text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_pin_hash text;
BEGIN
  SELECT pin_hash INTO v_pin_hash FROM profiles WHERE id = v_user;
  IF v_pin_hash IS NULL THEN
    RETURN 'no_pin_set';
  END IF;
  IF NOT extensions.crypt(p_pin, v_pin_hash) = v_pin_hash THEN
    RETURN 'invalid_pin';
  END IF;
  UPDATE wallets SET locked_at = NULL WHERE user_id = v_user;
  PERFORM log_audit_event(v_user, 'wallet_unlocked', '{}');
  RETURN 'unlocked';
END;
$$;
```

#### create_dispute

```sql
CREATE OR REPLACE FUNCTION create_dispute(
  p_transaction_id text,
  p_reason text,
  p_note text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_tx record;
  v_dispute_id uuid;
BEGIN
  -- Find the transaction and validate 7-day window
  SELECT * INTO v_tx FROM transactions
  WHERE id::text = p_transaction_id AND user_id = v_user
  LIMIT 1;

  IF v_tx IS NULL THEN
    RAISE EXCEPTION 'Transaction not found';
  END IF;
  IF v_tx.created_at < now() - interval '7 days' THEN
    RAISE EXCEPTION 'Dispute window expired (7 days)';
  END IF;

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

  PERFORM log_audit_event(v_user, 'dispute_opened', jsonb_build_object(
    'dispute_id', v_dispute_id, 'transaction_id', p_transaction_id, 'amount_kes', ABS(v_tx.amount)
  ));

  RETURN v_dispute_id;
END;
$$;
```

#### resolve_dispute

```sql
CREATE OR REPLACE FUNCTION resolve_dispute(
  p_dispute_id uuid,
  p_action text  -- 'approve' or 'deny'
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_dispute record;
BEGIN
  SELECT * INTO v_dispute FROM disputes WHERE id = p_dispute_id AND counterparty_id = v_user AND status = 'open';
  IF v_dispute IS NULL THEN
    RAISE EXCEPTION 'Dispute not found or not authorized';
  END IF;

  IF p_action = 'approve' THEN
    -- Execute reverse transfer atomically
    UPDATE wallets SET balance = balance - v_dispute.amount_kes WHERE user_id = v_user;
    UPDATE wallets SET balance = balance + v_dispute.amount_kes WHERE user_id = v_dispute.disputer_id;

    UPDATE disputes SET status = 'resolved', resolved_at = now() WHERE id = p_dispute_id;

    -- Transaction records for the reversal
    INSERT INTO transactions (user_id, amount, kind, note, status, counterparty_id, metadata)
    VALUES
      (v_user, -v_dispute.amount_kes, 'dispute_refund_sent', 'Dispute refund', 'settled', v_dispute.disputer_id, jsonb_build_object('dispute_id', p_dispute_id)),
      (v_dispute.disputer_id, v_dispute.amount_kes, 'dispute_refund_received', 'Dispute refund', 'settled', v_user, jsonb_build_object('dispute_id', p_dispute_id));

    PERFORM log_audit_event(v_user, 'dispute_resolved', jsonb_build_object('dispute_id', p_dispute_id, 'action', 'approve', 'amount_kes', v_dispute.amount_kes));

    RETURN 'resolved';
  ELSIF p_action = 'deny' THEN
    UPDATE disputes SET status = 'denied', resolved_at = now() WHERE id = p_dispute_id;

    -- Notify disputer
    INSERT INTO notifications (user_id, actor_id, type, title, body, reference_kind, reference_id)
    VALUES (
      v_dispute.disputer_id, v_user, 'dispute_denied',
      'Refund denied',
      'Your refund request was denied.',
      'dispute', p_dispute_id::text
    );

    PERFORM log_audit_event(v_user, 'dispute_resolved', jsonb_build_object('dispute_id', p_dispute_id, 'action', 'deny'));

    RETURN 'denied';
  ELSE
    RAISE EXCEPTION 'Invalid action. Use approve or deny.';
  END IF;
END;
$$;
```

#### Modified: transfer_yuto_balance (wallet lock check)

Add early in the function body, after auth checks:

```sql
-- Wallet lock enforcement
IF EXISTS (SELECT 1 FROM wallets WHERE user_id = v_from AND locked_at IS NOT NULL) THEN
  RAISE EXCEPTION 'Wallet is locked';
END IF;
```

#### Modified: settle_offline_transfer (wallet lock check)

Add after auth check:

```sql
-- Wallet lock enforcement
IF EXISTS (SELECT 1 FROM wallets WHERE user_id = p_sender_id AND locked_at IS NOT NULL) THEN
  RETURN 'wallet_locked';
END IF;
```

### 3. Row-Level Security

```sql
-- disputes: users see disputes where they are disputer or counterparty
ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own disputes" ON disputes
  FOR SELECT USING (auth.uid() = disputer_id OR auth.uid() = counterparty_id);

-- audit_events: users can only SELECT their own events
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own audit events" ON audit_events
  FOR SELECT USING (auth.uid() = user_id);
-- No INSERT policy for authenticated — only SECURITY DEFINER functions can insert
```

### 4. API Endpoints

#### `/api/verify-pin` (POST)

**Purpose:** Verify a user's PIN against their stored bcrypt hash.

```typescript
// api/verify-pin.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuthenticatedUserId } from "./_auth";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const userId = await getAuthenticatedUserId(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { pin } = req.body;
  if (!pin || typeof pin !== "string" || !/^\d{4}$/.test(pin)) {
    return res.status(400).json({ error: "Invalid PIN format" });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: profile } = await supabase
    .from("profiles")
    .select("pin_hash")
    .eq("id", userId)
    .single();

  if (!profile?.pin_hash) {
    return res.status(404).json({ error: "PIN not set" });
  }

  const valid = await bcrypt.compare(pin, profile.pin_hash);
  if (!valid) {
    // Log failed attempt
    await supabase.rpc("log_audit_event", {
      p_user_id: userId,
      p_event_type: "pin_failed",
      p_metadata: {},
      p_ip_address: (req.headers["x-forwarded-for"] as string) || null,
      p_device_info: req.headers["user-agent"] || null,
    });
    return res.status(403).json({ error: "Incorrect PIN" });
  }

  return res.status(200).json({ success: true });
}
```

#### `/api/audit` (POST)

**Purpose:** Log client-side audit events (login, logout, pin_failed lockout).

```typescript
// api/audit.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuthenticatedUserId } from "./_auth";
import { createClient } from "@supabase/supabase-js";

const ALLOWED_CLIENT_EVENTS = ["login", "logout", "pin_failed"];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const userId = await getAuthenticatedUserId(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { event_type, metadata, device_info } = req.body;

  if (!event_type || !ALLOWED_CLIENT_EVENTS.includes(event_type)) {
    return res.status(400).json({ error: "Invalid event type" });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  await supabase.rpc("log_audit_event", {
    p_user_id: userId,
    p_event_type: event_type,
    p_metadata: metadata || {},
    p_ip_address: (req.headers["x-forwarded-for"] as string) || null,
    p_device_info: device_info || req.headers["user-agent"] || null,
  });

  return res.status(200).json({ success: true });
}
```

### 5. Client Components

#### PinModal (`src/components/wallet/PinModal.tsx`)

A React modal component using Radix Dialog that:
- Accepts a `mode` prop: `"verify"` | `"setup"` | `"change"`
- In `verify` mode: shows 4-digit input, calls `/api/verify-pin`, fires `onSuccess` callback
- In `setup` mode: shows create + confirm flow, calls service to hash and store PIN
- In `change` mode: verify current → enter new → confirm new
- Manages lockout state via Capacitor Preferences (`pin_lockout_until`, `pin_failed_count`)
- Shows countdown timer during lockout
- Uses `input-otp` package (already in dependencies) for the 4-digit input

```typescript
interface PinModalProps {
  open: boolean;
  mode: "verify" | "setup" | "change";
  onSuccess: () => void;
  onCancel: () => void;
}
```

**Lockout logic (client-side):**
```typescript
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 3;

async function checkLockout(): Promise<{ locked: boolean; remainingMs: number }> {
  const { value: lockoutUntil } = await Preferences.get({ key: "pin_lockout_until" });
  if (!lockoutUntil) return { locked: false, remainingMs: 0 };
  const until = parseInt(lockoutUntil);
  const remaining = until - Date.now();
  if (remaining <= 0) {
    await Preferences.remove({ key: "pin_lockout_until" });
    await Preferences.remove({ key: "pin_failed_count" });
    return { locked: false, remainingMs: 0 };
  }
  return { locked: true, remainingMs: remaining };
}

async function recordFailedAttempt(): Promise<boolean> {
  const { value } = await Preferences.get({ key: "pin_failed_count" });
  const count = (parseInt(value || "0")) + 1;
  await Preferences.set({ key: "pin_failed_count", value: String(count) });
  if (count >= MAX_ATTEMPTS) {
    const lockoutUntil = Date.now() + LOCKOUT_DURATION_MS;
    await Preferences.set({ key: "pin_lockout_until", value: String(lockoutUntil) });
    // Log lockout event
    authFetch("/api/audit", {
      method: "POST",
      body: JSON.stringify({ event_type: "pin_failed", metadata: { lockout: true } }),
    });
    return true; // lockout triggered
  }
  return false;
}
```

#### PIN Setup in Send Flow

When `pin_hash` is null and user attempts to send:
1. `PinModal` opens in `setup` mode
2. User enters + confirms 4-digit PIN
3. Client calls `/api/verify-pin` replacement endpoint (or a `/api/set-pin` that hashes with bcrypt and stores via service role)
4. On success, the pending send action proceeds

For PIN setup, we add a `/api/set-pin` endpoint:

```typescript
// Within api/verify-pin.ts or separate api/set-pin.ts
// POST { pin: "1234" } → bcrypt hash → UPDATE profiles SET pin_hash = $hash WHERE id = $userId
```

#### Wallet Lock Banner

Added to both `WalletScreen.tsx` and `ProfileScreen.tsx`:
- Fetch `locked_at` from wallet on load
- If non-null, render a red/amber banner: "🔒 Wallet Locked — Tap to unlock"
- Disable send/transfer/withdraw buttons when locked
- Tap banner → open `PinModal` in verify mode → on success call `unlock_wallet` RPC

#### Dispute UI

- Transaction history items get a "⋯" menu or "Report a problem" link
- Tapping opens a bottom sheet with reason dropdown + notes field
- Pending disputes shown as a badge/section on WalletScreen
- Counterparty sees dispute notification with Approve/Deny buttons

### 6. Data Flow

#### Send with PIN Gate

```
User taps Send → check pin_hash exists?
  ├─ No  → PinModal(setup) → store hash → PinModal(verify) → proceed
  └─ Yes → check lockout?
              ├─ Locked → show countdown
              └─ Not locked → PinModal(verify) → /api/verify-pin
                                ├─ 200 → execute send (BLE or RPC)
                                └─ 403 → increment failed_count → check lockout threshold
```

#### Wallet Lock/Unlock

```
Lock:  User taps "Lock Wallet" → supabase.rpc("lock_wallet") → UI updates banner
Unlock: User taps banner → PinModal(verify) → supabase.rpc("unlock_wallet", { p_pin }) → UI removes banner
```

#### Dispute Flow

```
Disputer: View tx → "Report" → form → supabase.rpc("create_dispute") → notification sent
Counterparty: Notification → view dispute → Approve/Deny → supabase.rpc("resolve_dispute")
  ├─ Approve → reverse transfer executed atomically
  └─ Deny → status updated, disputer notified
```

### 7. Error Handling

| Scenario | Handling |
|----------|----------|
| PIN verification fails | Increment client-side counter, show error, trigger lockout at 3 |
| Wallet locked + transfer attempt (server) | RPC raises exception / returns status code |
| Wallet locked + transfer attempt (client) | Buttons disabled, banner shown |
| Dispute on expired transaction | RPC raises "Dispute window expired" |
| Dispute approval with insufficient counterparty balance | RPC raises "Insufficient balance for refund" |
| Network failure during PIN verify | Show "Unable to verify PIN. Check connection." |
| bcrypt comparison error | Return 500, do not reveal details |

### 8. Security Considerations

- **PIN hash storage**: bcrypt with default cost factor (10 rounds). PIN never stored in plaintext.
- **Lockout state client-side**: Acceptable because server-side PIN verification still requires correct PIN. Client lockout is UX protection against brute-force; server rate limiting provides additional protection.
- **Wallet lock server-side enforcement**: Even if client UI is bypassed, RPCs reject transfers from locked wallets.
- **Audit immutability**: No UPDATE/DELETE policies on `audit_events`. INSERT only via SECURITY DEFINER.
- **Dispute atomicity**: Reverse transfer in `resolve_dispute` runs within a single transaction — if balance deduction fails, the entire operation rolls back.

## Interfaces

### PinModal Component Interface

```typescript
interface PinModalProps {
  open: boolean;
  mode: "verify" | "setup" | "change";
  onSuccess: () => void;
  onCancel: () => void;
}
```

### API Endpoint Interfaces

```typescript
// POST /api/verify-pin
interface VerifyPinRequest {
  pin: string; // exactly 4 digits
}
interface VerifyPinResponse {
  success: boolean;
}

// POST /api/set-pin
interface SetPinRequest {
  pin: string; // exactly 4 digits
}
interface SetPinResponse {
  success: boolean;
}

// POST /api/audit
interface AuditEventRequest {
  event_type: "login" | "logout" | "pin_failed";
  metadata?: Record<string, unknown>;
  device_info?: string;
}
interface AuditEventResponse {
  success: boolean;
}
```

### RPC Interfaces

```typescript
// lock_wallet() → void
// unlock_wallet(p_pin: text) → 'unlocked' | 'invalid_pin' | 'no_pin_set'
// create_dispute(p_transaction_id: text, p_reason: text, p_note?: text) → uuid
// resolve_dispute(p_dispute_id: uuid, p_action: 'approve' | 'deny') → 'resolved' | 'denied'
// log_audit_event(p_user_id: uuid, p_event_type: text, p_metadata?: jsonb, p_ip_address?: text, p_device_info?: text) → void
```

## Data Models

### Dispute Status Machine

```
open → resolved  (counterparty approves)
open → denied    (counterparty denies)
```

### Audit Event Types

| Event Type | Trigger | Metadata |
|-----------|---------|----------|
| pin_set | PIN created | {} |
| pin_changed | PIN updated | {} |
| pin_failed | Wrong PIN entered | { lockout: boolean } |
| wallet_locked | User locks wallet | {} |
| wallet_unlocked | User unlocks wallet | {} |
| transfer_sent | Outgoing transfer | { amount_kes, counterparty_id, method } |
| transfer_received | Incoming transfer | { amount_kes, counterparty_id, method } |
| transfer_failed | Transfer rejected | { reason, amount_kes } |
| withdrawal_initiated | M-PESA withdrawal started | { amount_kes, phone } |
| withdrawal_completed | M-PESA withdrawal done | { amount_kes } |
| dispute_opened | Dispute created | { dispute_id, transaction_id, amount_kes } |
| dispute_resolved | Dispute approved/denied | { dispute_id, action, amount_kes? } |
| login | User logs in | {} |
| logout | User logs out | {} |

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: PIN verification round-trip

*For any* valid 4-digit numeric PIN, if the PIN is hashed with bcrypt and stored, then verifying the same PIN against that hash SHALL return success, and verifying any different 4-digit PIN SHALL return failure.

**Validates: Requirements 1.2, 2.6**

### Property 2: PIN validation rejects invalid inputs

*For any* string that does not match the pattern `/^\d{4}$/` (exactly 4 numeric digits), the PIN setup and verification endpoints SHALL reject the input without storing or comparing it.

**Validates: Requirements 1.4**

### Property 3: Lockout rejects all PIN attempts

*For any* PIN value (correct or incorrect), while the lockout period is active (failed_count >= 3 and lockout_until > now), the PIN verification system SHALL reject the attempt without checking the hash.

**Validates: Requirements 3.3**

### Property 4: PIN change invalidates old PIN

*For any* old PIN and new PIN where old ≠ new, after a successful PIN change operation, verifying the old PIN against the updated hash SHALL return failure, and verifying the new PIN SHALL return success.

**Validates: Requirements 4.3**

### Property 5: Locked wallet blocks all outgoing transfers

*For any* wallet where `locked_at IS NOT NULL`, calling `transfer_yuto_balance` SHALL raise an exception with message 'Wallet is locked', and calling `settle_offline_transfer` SHALL return 'wallet_locked', regardless of the transfer amount or recipient.

**Validates: Requirements 6.1, 6.2, 6.3, 6.4**

### Property 6: Locked wallet allows incoming transfers

*For any* wallet where `locked_at IS NOT NULL`, incoming transfers (where the locked wallet is the recipient) SHALL succeed and increase the wallet balance by the transfer amount.

**Validates: Requirements 6.5**

### Property 7: Lock/unlock round-trip

*For any* unlocked wallet, performing `lock_wallet()` followed by `unlock_wallet(correct_pin)` SHALL return the wallet to its original unlocked state (locked_at = NULL).

**Validates: Requirements 7.2**

### Property 8: Dispute creation preserves submitted fields

*For any* valid dispute submission (transaction within 7-day window, valid reason, optional note), the created dispute row SHALL contain the exact transaction_id, disputer_id matching auth.uid(), the selected reason, the provided note, and the transaction's absolute amount as amount_kes, with status 'open'.

**Validates: Requirements 8.4**

### Property 9: Dispute approval conserves total balance

*For any* approved dispute, the sum of the disputer's balance change and the counterparty's balance change SHALL equal zero (the disputed amount is transferred from counterparty to disputer with no creation or destruction of funds).

**Validates: Requirements 9.3**

### Property 10: Audit events contain required structure

*For any* audit event written by `log_audit_event`, the resulting row SHALL have a non-null user_id, a non-empty event_type, a valid jsonb metadata field, and a created_at timestamp. For transaction-related events, the metadata SHALL include transaction_id and amount_kes.

**Validates: Requirements 10.1, 10.5**

### Property 11: Audit logging is transactional with RPC execution

*For any* RPC that calls `log_audit_event` internally, if the RPC transaction commits successfully then the audit event row SHALL exist, and if the RPC transaction rolls back then no audit event row SHALL be created.

**Validates: Requirements 10.3**

### Property 12: RLS — users only see own audit events

*For any* authenticated user, a SELECT query on `audit_events` SHALL return only rows where `user_id` equals the querying user's `auth.uid()`, regardless of how many other users' events exist in the table.

**Validates: Requirements 11.1**

### Property 13: RLS — no direct inserts from authenticated role

*For any* authenticated user attempting a direct INSERT on `audit_events` (not through a SECURITY DEFINER function), the operation SHALL be rejected by RLS policy.

**Validates: Requirements 11.2**

## Files Summary

### New Files
| File | Purpose |
|------|---------|
| `supabase/migrations/20260515_wallet_safety_controls.sql` | Schema changes, RPCs, RLS policies |
| `src/components/wallet/PinModal.tsx` | PIN entry/setup/change modal component |
| `api/verify-pin.ts` | PIN verification endpoint |
| `api/set-pin.ts` | PIN setup endpoint (hash + store) |
| `api/audit.ts` | Client-side audit event logging endpoint |

### Modified Files
| File | Changes |
|------|---------|
| `src/pages/WalletScreen.tsx` | PIN gate before send, lock banner, pending disputes section |
| `src/pages/ProfileScreen.tsx` | PIN gate before send/withdraw, lock banner, settings items (Set PIN, Change PIN, Lock Wallet) |
| `src/lib/bluetooth.ts` | No direct changes — PIN gate applied at caller level in WalletScreen |
| `supabase/migrations/20260515_ble_security_hardening.sql` | Wallet lock check added to both RPCs |
