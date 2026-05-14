# Implementation Plan: BLE Security Hardening

## Overview

Harden the Yuto BLE transfer system across three layers: client-side payload validation and HMAC signing in `src/lib/bluetooth.ts`, server-side RPC enforcement in a new SQL migration, and API-level rate limiting in `api/notify.ts`. All client-side crypto uses the Web Crypto API (`crypto.subtle`) since this is a Capacitor/browser environment.

## Tasks

- [ ] 1. Add payload validation to bluetooth.ts
  - [ ] 1.1 Implement `validateBlePayload()` function in `src/lib/bluetooth.ts`
    - Add `ValidationResult` interface with `valid`, `error?`, and `sanitized?` fields
    - Add UUID v4 regex constant, `MIN_AMOUNT_KES = 1`, `MAX_AMOUNT_KES = 50_000`, `MAX_TIMESTAMP_DRIFT_MS = 3_600_000`
    - Implement schema checks: required field presence, UUID format for id/senderId/recipientId, numeric amount, positive integer timestamp
    - Implement self-transfer rejection (`senderId === recipientId`)
    - Implement amount bounds check after `Math.round()`
    - Implement timestamp freshness check (reject if >1h old or in the future)
    - Sanitize: trim string fields to 36 chars, round amount to integer
    - Export the function
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 9.1, 9.2, 9.3, 9.4_

  - [ ] 1.2 Integrate `validateBlePayload()` into `handleIncomingTransaction()`
    - Call `validateBlePayload(parsedPayload)` before storing
    - If invalid, `console.warn` with the error code and return early (discard payload)
    - If valid, use the `sanitized` output for storage instead of raw parsed data
    - _Requirements: 1.7, 9.1, 9.2_

- [ ] 2. Add HMAC signing and amount pre-check to outgoing BLE payloads
  - [ ] 2.1 Implement `deriveSigningSecret()` and `signBlePayload()` using Web Crypto API in `src/lib/bluetooth.ts`
    - `deriveSigningSecret(accessToken: string): Promise<string>` — SHA-256 hash of token, take first 32 hex chars
    - `signBlePayload(payload, secret): Promise<string>` — HMAC-SHA256 over canonical string `id|senderId|recipientId|amount|timestamp`, return base64
    - Use `crypto.subtle.digest` for SHA-256 and `crypto.subtle.importKey` + `crypto.subtle.sign` for HMAC (NOT Node.js `crypto` module)
    - Export both functions
    - _Requirements: 8.1, 8.2, 8.3_

  - [ ] 2.2 Integrate HMAC signing and amount validation into `sendViaBluetooth()`
    - Add amount bounds pre-check at the top: reject if `Math.round(amount) < 1` or `> 50_000` before any BLE send
    - After constructing the payload object, derive signing secret from current Supabase session access token
    - Call `signBlePayload()` and add the `hmac` field to the transaction payload JSON
    - Pass `p_hmac` to the `settle_offline_transfer` RPC call in the offline sync path
    - Store `hmac` in the `OfflineTransaction` record for later sync
    - _Requirements: 8.1, 8.2, 8.3, 4.1, 4.2_

- [ ] 3. Add offline transaction cancellation
  - [ ] 3.1 Implement `cancelOfflineTransaction()` in `src/lib/bluetooth.ts`
    - Add `cancelled?: boolean` and `hmac?: string` fields to the `OfflineTransaction` interface
    - Implement `cancelOfflineTransaction(txId: string): boolean` — find tx, reject if synced or not found, set `cancelled = true`, restore cached balance, persist
    - Export the function
    - _Requirements: 10.1, 10.2, 10.4, 10.5_

  - [ ] 3.2 Update `syncOfflineTransactions()` to skip cancelled transactions
    - Change the pending filter from `!tx.synced` to `!tx.synced && !tx.cancelled`
    - Pass `p_hmac: tx.hmac` to the `settle_offline_transfer` RPC call
    - _Requirements: 10.3, 8.3_

- [ ] 4. Checkpoint - Verify client-side changes
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Create SQL migration for RPC hardening
  - [ ] 5.1 Create `supabase/migrations/20260515_ble_security_hardening.sql`
    - `CREATE OR REPLACE FUNCTION transfer_yuto_balance(...)`: add amount bounds check (1–50,000 KES), add daily cumulative limit check (150,000 KES rolling 24h from `transactions` table where `kind = 'transfer_sent'` and `status = 'settled'`)
    - `CREATE OR REPLACE FUNCTION settle_offline_transfer(...)`: add `p_hmac text DEFAULT NULL` parameter, add amount bounds (return `'invalid_amount'`), add daily limit (return `'daily_limit_exceeded'`), add HMAC null check (return `'invalid_signature'`), reduce expiry from 24h to 1h (return `'expired'`)
    - Daily limit counts only successfully completed transfers
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 5.4, 5.5, 8.4, 8.5, 11.1, 11.2, 11.3_

- [ ] 6. Harden the notify endpoint
  - [ ] 6.1 Add rate limiting and relationship check to `api/notify.ts`
    - Add in-memory `Map<string, RateLimitEntry>` with 10 req/min per user window
    - Before processing, call `checkRateLimit(authUserId)` — return HTTP 429 with `'Rate limit exceeded'` if blocked
    - Add `hasTransactionRelationship(senderId, targetUserId)` — query `transactions` table for any row where sender is `user_id` or `counterparty_id` paired with target
    - After rate limit passes, call relationship check — return HTTP 403 with `'No transaction relationship with target user'` if no history
    - _Requirements: 6.1, 6.2, 6.3, 7.1, 7.2, 7.3_

- [ ] 7. Final checkpoint - Ensure all changes are consistent
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- All client-side crypto uses the Web Crypto API (`crypto.subtle`) since this is a Capacitor/browser app, NOT Node.js
- The `api/` folder runs on Vercel (Node.js) and can use Node.js APIs
- The `user_signing_keys` table already exists from the prior `20260514_offline_tx_idempotency.sql` migration
- No new tables are created — only RPC functions are modified
- Rate limiting in `api/notify.ts` is in-memory (resets on cold start), acceptable for Vercel serverless
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "3.1"] },
    { "id": 1, "tasks": ["1.2", "2.1", "3.2"] },
    { "id": 2, "tasks": ["2.2"] },
    { "id": 3, "tasks": ["5.1", "6.1"] }
  ]
}
```
