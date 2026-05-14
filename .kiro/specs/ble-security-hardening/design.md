# Design Document: BLE Security Hardening

## Overview

This design hardens the Yuto BLE peer-to-peer transfer system against payload injection, amount abuse, replay attacks, notification spam, and unauthorized settlement. Changes span three layers: client-side validation/signing in `bluetooth.ts`, server-side RPC enforcement in a new SQL migration, and API-level rate limiting in `api/notify.ts`.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Client (bluetooth.ts)                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐ │
│  │ validateBle  │  │ signPayload  │  │ cancelOfflineTx       │ │
│  │ Payload()    │  │ (HMAC-SHA256)│  │ + balance restore     │ │
│  └──────┬───────┘  └──────┬───────┘  └───────────────────────┘ │
│         │                  │                                     │
│         ▼                  ▼                                     │
│  handleIncomingTx()   sendViaBluetooth()                        │
└─────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  Server (Supabase RPCs)                                         │
│  ┌────────────────────────┐  ┌────────────────────────────────┐ │
│  │ transfer_yuto_balance  │  │ settle_offline_transfer        │ │
│  │ + amount limits        │  │ + amount limits                │ │
│  │ + daily limit check    │  │ + daily limit check            │ │
│  │                        │  │ + HMAC verification            │ │
│  │                        │  │ + 1h expiry (was 24h)          │ │
│  └────────────────────────┘  └────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  API (api/notify.ts)                                            │
│  ┌────────────────────────┐  ┌────────────────────────────────┐ │
│  │ Rate Limiter           │  │ Relationship Check             │ │
│  │ (10 req/min per user)  │  │ (transactions table lookup)    │ │
│  └────────────────────────┘  └────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Components

### 1. BLE Payload Validator (`validateBlePayload`)

**Location:** `src/lib/bluetooth.ts`

A pure validation function called at the top of `handleIncomingTransaction()` before any storage occurs.

```typescript
interface ValidationResult {
  valid: boolean;
  error?: string;
  sanitized?: OfflineTransaction;
}

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MIN_AMOUNT_KES = 1;
const MAX_AMOUNT_KES = 50_000;
const MAX_TIMESTAMP_DRIFT_MS = 60 * 60 * 1000; // 1 hour

export function validateBlePayload(payload: unknown, nowMs?: number): ValidationResult {
  const now = nowMs ?? Date.now();

  // Type guard
  if (typeof payload !== "object" || payload === null) {
    return { valid: false, error: "payload_not_object" };
  }

  const p = payload as Record<string, unknown>;

  // Required fields presence
  const requiredFields = ["id", "senderId", "recipientId", "amount", "timestamp"];
  for (const field of requiredFields) {
    if (!(field in p) || p[field] === undefined || p[field] === null) {
      return { valid: false, error: `missing_field:${field}` };
    }
  }

  // UUID validation
  if (typeof p.id !== "string" || !UUID_V4_REGEX.test(p.id)) {
    return { valid: false, error: "invalid_id_format" };
  }
  if (typeof p.senderId !== "string" || !UUID_V4_REGEX.test(p.senderId)) {
    return { valid: false, error: "invalid_sender_id_format" };
  }
  if (typeof p.recipientId !== "string" || !UUID_V4_REGEX.test(p.recipientId)) {
    return { valid: false, error: "invalid_recipient_id_format" };
  }

  // Self-transfer check
  if (p.senderId === p.recipientId) {
    return { valid: false, error: "sender_equals_recipient" };
  }

  // Amount validation
  if (typeof p.amount !== "number" || isNaN(p.amount)) {
    return { valid: false, error: "invalid_amount_type" };
  }
  const roundedAmount = Math.round(p.amount as number);
  if (roundedAmount < MIN_AMOUNT_KES || roundedAmount > MAX_AMOUNT_KES) {
    return { valid: false, error: "amount_out_of_bounds" };
  }

  // Timestamp validation
  if (typeof p.timestamp !== "number" || !Number.isInteger(p.timestamp) || p.timestamp <= 0) {
    return { valid: false, error: "invalid_timestamp" };
  }
  const drift = now - (p.timestamp as number);
  if (drift > MAX_TIMESTAMP_DRIFT_MS) {
    return { valid: false, error: `timestamp_too_old:${drift}ms` };
  }
  if (drift < 0) {
    return { valid: false, error: `timestamp_in_future:${Math.abs(drift)}ms` };
  }

  // Sanitize: trim strings to 36 chars (UUID length)
  const sanitized: OfflineTransaction = {
    id: (p.id as string).slice(0, 36),
    senderId: (p.senderId as string).slice(0, 36),
    recipientId: (p.recipientId as string).slice(0, 36),
    amount: roundedAmount,
    timestamp: p.timestamp as number,
    synced: false,
  };

  return { valid: true, sanitized };
}
```

### 2. HMAC Signing (`signBlePayload` / `getSigningSecret`)

**Location:** `src/lib/bluetooth.ts`

Derives a signing secret from the user's Supabase access token and signs outgoing payloads.

```typescript
import { createHmac, createHash } from "crypto";

/**
 * Derive a 32-char hex signing secret from the user's access token.
 * Uses first 32 chars of SHA-256(token).
 */
export function deriveSigningSecret(accessToken: string): string {
  const hash = createHash("sha256").update(accessToken).digest("hex");
  return hash.slice(0, 32);
}

/**
 * Compute HMAC-SHA256 over the canonical payload string.
 * Canonical form: id|senderId|recipientId|amount|timestamp
 */
export function signBlePayload(
  payload: { id: string; senderId: string; recipientId: string; amount: number; timestamp: number },
  secret: string
): string {
  const canonical = `${payload.id}|${payload.senderId}|${payload.recipientId}|${payload.amount}|${payload.timestamp}`;
  const hmac = createHmac("sha256", secret).update(canonical).digest("base64");
  return hmac;
}
```

The signing secret hash is stored in `user_signing_keys` table (already exists from prior migration) when the user first opens the wallet. The `settle_offline_transfer` RPC receives a new `p_hmac` parameter and verifies it server-side.

### 3. Offline Transaction Cancellation

**Location:** `src/lib/bluetooth.ts`

Extends the `OfflineTransaction` interface and adds a cancellation function.

```typescript
export interface OfflineTransaction {
  id: string;
  senderId: string;
  recipientId: string;
  amount: number;
  timestamp: number;
  synced: boolean;
  cancelled?: boolean; // NEW
}

/**
 * Cancel a pending offline transaction.
 * Returns true if cancelled, false if already synced or not found.
 */
export function cancelOfflineTransaction(txId: string): boolean {
  const transactions = getOfflineTransactions();
  const tx = transactions.find((t) => t.id === txId);

  if (!tx) return false;
  if (tx.synced) return false;
  if (tx.cancelled) return true; // already cancelled

  tx.cancelled = true;

  // Restore cached balance
  const cached = getCachedBalance();
  if (cached) {
    cached.balance += tx.amount;
    cached.updatedAt = Date.now();
    persistSetSync(CACHED_BALANCE_KEY, JSON.stringify(cached));
  }

  persistSetSync(OFFLINE_TX_KEY, JSON.stringify(transactions));
  return true;
}
```

The `syncOfflineTransactions()` function is updated to skip cancelled transactions:

```typescript
const pending = transactions.filter((tx) => !tx.synced && !tx.cancelled);
```

### 4. Transfer RPC Hardening (SQL Migration)

**Location:** `supabase/migrations/20260515_ble_security_hardening.sql`

Updates both RPCs with:
- Amount bounds (1–50,000 KES)
- Daily cumulative limit (150,000 KES rolling 24h)
- HMAC verification (settle_offline_transfer only)
- Expiry window reduction (24h → 1h)

```sql
-- In transfer_yuto_balance, add after existing amount > 0 check:
IF v_amount < 1 THEN
  RAISE EXCEPTION 'Amount below minimum (1 KES)';
END IF;
IF v_amount > 50000 THEN
  RAISE EXCEPTION 'Amount exceeds maximum (50,000 KES)';
END IF;

-- Daily limit check
DECLARE v_daily_total numeric;
SELECT COALESCE(SUM(-amount), 0) INTO v_daily_total
FROM transactions
WHERE user_id = v_from
  AND kind = 'transfer_sent'
  AND status = 'settled'
  AND created_at > now() - interval '24 hours';

IF v_daily_total + v_amount > 150000 THEN
  RAISE EXCEPTION 'Daily transfer limit exceeded (150,000 KES)';
END IF;
```

```sql
-- In settle_offline_transfer, add new parameter and checks:
CREATE OR REPLACE FUNCTION public.settle_offline_transfer(
  p_tx_id text,
  p_sender_id uuid,
  p_recipient_id uuid,
  p_amount_kes numeric,
  p_timestamp bigint,
  p_hmac text DEFAULT NULL  -- NEW parameter
) ...

-- Amount bounds
IF p_amount_kes < 1 OR p_amount_kes > 50000 THEN
  RETURN 'invalid_amount';
END IF;

-- Daily limit
SELECT COALESCE(SUM(amount_kes), 0) INTO v_daily_total
FROM offline_tx_log
WHERE sender_id = p_sender_id
  AND status = 'settled'
  AND settled_at > now() - interval '24 hours';

IF v_daily_total + p_amount_kes > 150000 THEN
  RETURN 'daily_limit_exceeded';
END IF;

-- HMAC verification
IF p_hmac IS NULL THEN
  RETURN 'invalid_signature';
END IF;
-- Verify against stored key (using pgcrypto or application-level check)

-- Expiry: change 24 → 1
IF v_age_hours > 1 THEN
  ...
  RETURN 'expired';
END IF;
```

### 5. Notify Endpoint Hardening

**Location:** `api/notify.ts`

#### Rate Limiter (In-Memory)

```typescript
interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(userId, { count: 1, windowStart: now });
    return true; // allowed
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return false; // blocked
  }

  entry.count++;
  return true; // allowed
}
```

#### Relationship Check

```typescript
async function hasTransactionRelationship(
  senderId: string,
  targetUserId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("transactions")
    .select("id")
    .or(
      `and(user_id.eq.${senderId},counterparty_id.eq.${targetUserId}),` +
      `and(user_id.eq.${targetUserId},counterparty_id.eq.${senderId})`
    )
    .limit(1);

  return !error && !!data && data.length > 0;
}
```

## Data Models

### Extended OfflineTransaction Interface

```typescript
export interface OfflineTransaction {
  id: string;          // UUID v4
  senderId: string;    // UUID v4
  recipientId: string; // UUID v4
  amount: number;      // integer, 1–50,000 KES
  timestamp: number;   // Unix ms
  synced: boolean;
  cancelled?: boolean; // NEW: marks tx as cancelled
  hmac?: string;       // NEW: base64 HMAC-SHA256 signature
}
```

### Rate Limit Entry (In-Memory)

```typescript
interface RateLimitEntry {
  count: number;       // notifications sent in current window
  windowStart: number; // epoch ms when window started
}
```

### SQL Schema Changes

The migration adds no new tables but modifies both RPCs. The `user_signing_keys` table already exists from the prior `20260514_offline_tx_idempotency.sql` migration and stores the HMAC verification key.

The `offline_tx_log.status` CHECK constraint is unchanged — it already supports `'settled' | 'rejected' | 'expired'`.

## Interfaces

### validateBlePayload

```typescript
function validateBlePayload(payload: unknown, nowMs?: number): ValidationResult
```

| Parameter | Type | Description |
|-----------|------|-------------|
| payload | unknown | Raw parsed JSON from BLE GATT characteristic |
| nowMs | number (optional) | Current time in ms (for testing; defaults to Date.now()) |

Returns `{ valid: true, sanitized: OfflineTransaction }` or `{ valid: false, error: string }`.

### signBlePayload

```typescript
function signBlePayload(
  payload: { id: string; senderId: string; recipientId: string; amount: number; timestamp: number },
  secret: string
): string
```

Returns base64-encoded HMAC-SHA256 signature.

### cancelOfflineTransaction

```typescript
function cancelOfflineTransaction(txId: string): boolean
```

Returns `true` if successfully cancelled, `false` if not found or already synced.

### checkRateLimit

```typescript
function checkRateLimit(userId: string): boolean
```

Returns `true` if request is allowed, `false` if rate limit exceeded.

### hasTransactionRelationship

```typescript
function hasTransactionRelationship(senderId: string, targetUserId: string): Promise<boolean>
```

Returns `true` if at least one transaction exists between the two users.

## Error Handling

| Scenario | Layer | Response |
|----------|-------|----------|
| Invalid BLE payload schema | Client | Discard + console.warn with error code |
| Amount out of bounds (client) | Client | Discard + console.warn |
| Timestamp stale/future (client) | Client | Discard + console.warn with drift |
| Self-transfer attempt | Client | Discard + console.warn |
| Amount < 1 or > 50,000 (transfer RPC) | Server | Exception: 'Amount below minimum (1 KES)' or 'Amount exceeds maximum (50,000 KES)' |
| Amount < 1 or > 50,000 (settle RPC) | Server | Return 'invalid_amount' |
| Daily limit exceeded (transfer RPC) | Server | Exception: 'Daily transfer limit exceeded (150,000 KES)' |
| Daily limit exceeded (settle RPC) | Server | Return 'daily_limit_exceeded' |
| Invalid/missing HMAC (settle RPC) | Server | Return 'invalid_signature' |
| Expired transaction (settle RPC) | Server | Return 'expired' + log to offline_tx_log |
| Rate limit exceeded (notify) | API | HTTP 429: 'Rate limit exceeded' |
| No relationship (notify) | API | HTTP 403: 'No transaction relationship with target user' |
| Cancel already-synced tx | Client | Return false (no-op) |

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Schema validation rejects malformed payloads

*For any* payload where at least one required field (id, senderId, recipientId, amount, timestamp) is missing, has an incorrect type, or has an invalid UUID format, `validateBlePayload` SHALL return `{ valid: false }` with an appropriate error code.

**Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7**

### Property 2: Amount bounds enforcement

*For any* numeric amount where `Math.round(amount) < 1` or `Math.round(amount) > 50,000`, `validateBlePayload` SHALL return `{ valid: false, error: "amount_out_of_bounds" }`.

**Validates: Requirements 2.1, 2.2**

### Property 3: Timestamp freshness window

*For any* payload with a timestamp more than 3,600,000 ms before the current time OR any timestamp ahead of the current time, `validateBlePayload` SHALL return `{ valid: false }` with an error indicating the drift direction and magnitude.

**Validates: Requirements 3.1, 3.2**

### Property 4: Amount rounding sanitization

*For any* valid payload with a non-integer amount value, the sanitized output's `amount` field SHALL equal `Math.round(originalAmount)`.

**Validates: Requirements 2.3, 9.2**

### Property 5: Self-transfer rejection

*For any* payload where `senderId === recipientId`, `validateBlePayload` SHALL return `{ valid: false, error: "sender_equals_recipient" }`.

**Validates: Requirements 9.3, 9.4**

### Property 6: String field length sanitization

*For any* valid payload, all string fields in the sanitized output (id, senderId, recipientId) SHALL have length ≤ 36 characters.

**Validates: Requirements 9.1**

### Property 7: Valid payloads pass validation

*For any* payload with all fields present, valid UUID v4 format for id/senderId/recipientId, senderId ≠ recipientId, amount in [1, 50000] after rounding, and timestamp within ±1 hour of now, `validateBlePayload` SHALL return `{ valid: true }` with a sanitized transaction.

**Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 3.1, 3.2, 9.3**

### Property 8: HMAC signing round-trip

*For any* valid transaction payload and signing secret, computing `signBlePayload(payload, secret)` and then independently computing HMAC-SHA256 over `id|senderId|recipientId|amount|timestamp` with the same secret SHALL produce identical base64 strings.

**Validates: Requirements 8.1, 8.2, 8.3**

### Property 9: HMAC tamper detection

*For any* signed payload, if any field (id, senderId, recipientId, amount, or timestamp) is modified after signing, re-verifying the original HMAC against the modified payload SHALL fail.

**Validates: Requirements 8.4, 8.5**

### Property 10: Transfer RPC amount bounds

*For any* call to `transfer_yuto_balance` with `p_amount_kes < 1` or `p_amount_kes > 50,000`, the function SHALL raise an exception before any balance modification occurs.

**Validates: Requirements 4.1, 4.2**

### Property 11: Settlement RPC amount bounds

*For any* call to `settle_offline_transfer` with `p_amount_kes < 1` or `p_amount_kes > 50,000`, the function SHALL return `'invalid_amount'` without modifying any balances.

**Validates: Requirements 4.3, 4.4**

### Property 12: Daily cumulative limit enforcement

*For any* user whose sum of settled transfers in the past 24 hours plus the requested amount exceeds 150,000 KES, both `transfer_yuto_balance` and `settle_offline_transfer` SHALL reject the transfer before any balance modification.

**Validates: Requirements 5.2, 5.4**

### Property 13: Rate limiter blocks after threshold

*For any* user who has sent 10 or more notification requests within a 60-second window, the next request within that same window SHALL be rejected with HTTP 429.

**Validates: Requirements 6.2**

### Property 14: Relationship gate blocks strangers

*For any* pair of users (sender, target) where no row exists in the `transactions` table with the sender as either `user_id` or `counterparty_id` paired with the target, the notify endpoint SHALL return HTTP 403.

**Validates: Requirements 7.1, 7.2, 7.3**

### Property 15: Cancellation restores balance and sets flag

*For any* offline transaction with `synced === false` and `cancelled !== true`, calling `cancelOfflineTransaction(txId)` SHALL set `cancelled = true` on the transaction AND increase the cached balance by the transaction's amount.

**Validates: Requirements 10.1, 10.2, 10.4**

### Property 16: Cancelled transactions skipped during sync

*For any* set of offline transactions where some are marked `cancelled = true`, `syncOfflineTransactions` SHALL not submit cancelled transactions to the Settlement RPC.

**Validates: Requirements 10.3**

### Property 17: Synced transactions cannot be cancelled

*For any* offline transaction with `synced === true`, calling `cancelOfflineTransaction(txId)` SHALL return `false` without modifying the transaction or cached balance.

**Validates: Requirements 10.5**

### Property 18: Settlement expiry at 1 hour

*For any* call to `settle_offline_transfer` where `(current_epoch_ms - p_timestamp) / 3,600,000 > 1.0`, the function SHALL return `'expired'` and log the transaction with status `'expired'` without executing the transfer.

**Validates: Requirements 11.1, 11.2, 11.3**
