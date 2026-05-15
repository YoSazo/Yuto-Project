# Implementation Plan: Wallet Safety Controls

## Overview

Adds four safety layers to the Yuto wallet: transaction PIN gate, wallet lock/freeze, peer-to-peer dispute system, and audit event logging. Implementation follows a bottom-up approach — database schema and RPCs first, then API endpoints, then client-side components and integration.

## Tasks

- [ ] 1. Database migration — schema, RPCs, RLS, and wallet lock enforcement
  - [ ] 1.1 Create `supabase/migrations/20260515_wallet_safety_controls.sql` with all schema changes and functions
    - Add `pin_hash text DEFAULT NULL` column to `profiles` table
    - Add `locked_at timestamptz DEFAULT NULL` column to `wallets` table
    - Create `disputes` table (id, transaction_id, disputer_id, counterparty_id, reason, note, amount_kes, status, created_at, resolved_at)
    - Create `audit_events` table (id, user_id, event_type, metadata, ip_address, device_info, created_at)
    - Create `log_audit_event` SECURITY DEFINER function
    - Create `lock_wallet` SECURITY DEFINER function (sets locked_at, logs event)
    - Create `unlock_wallet(p_pin)` SECURITY DEFINER function (verifies PIN via pgcrypto crypt, clears locked_at, logs event)
    - Create `create_dispute` SECURITY DEFINER function (validates 7-day window, inserts dispute, sends notification, logs event)
    - Create `resolve_dispute` SECURITY DEFINER function (approve: reverse transfer + transaction records; deny: update status + notify disputer)
    - Add wallet lock check to `transfer_yuto_balance`: raise exception 'Wallet is locked' if sender's locked_at IS NOT NULL
    - Add wallet lock check to `settle_offline_transfer`: return 'wallet_locked' if sender's locked_at IS NOT NULL
    - Enable RLS on `disputes` — SELECT for disputer_id or counterparty_id matching auth.uid()
    - Enable RLS on `audit_events` — SELECT only where user_id = auth.uid(), no INSERT policy for authenticated role
    - _Requirements: 1.2, 5.1, 6.1, 6.2, 6.3, 6.4, 6.5, 7.2, 8.4, 8.5, 9.3, 9.4, 9.5, 10.1, 10.3, 11.1, 11.2, 11.4_

- [ ] 2. API endpoints — PIN and audit
  - [ ] 2.1 Create `api/set-pin.ts` endpoint
    - POST handler: validate authenticated user, validate PIN is exactly 4 digits
    - Hash PIN with bcryptjs (10 rounds)
    - Store hash in `profiles.pin_hash` using service role client
    - Call `log_audit_event` RPC with event_type `pin_set`
    - Return 200 on success
    - _Requirements: 1.2, 1.4, 1.5_

  - [ ] 2.2 Create `api/verify-pin.ts` endpoint
    - POST handler: validate authenticated user, validate PIN format
    - Fetch `pin_hash` from profiles for the user
    - Compare with bcryptjs — return 200 `{ success: true }` on match
    - On mismatch: log `pin_failed` audit event, return 403
    - Return 404 if no pin_hash set
    - _Requirements: 2.6, 2.7, 3.5_

  - [ ] 2.3 Create `api/audit.ts` endpoint
    - POST handler: validate authenticated user
    - Whitelist allowed client event types: `login`, `logout`, `pin_failed`
    - Call `log_audit_event` RPC with user_id, event_type, metadata, ip_address, device_info
    - Return 200 on success
    - _Requirements: 10.4_

- [ ] 3. Checkpoint
  - Ensure migration applies cleanly, API endpoints deploy without errors, ask the user if questions arise.

- [ ] 4. PinModal component
  - [ ] 4.1 Create `src/components/wallet/PinModal.tsx`
    - Props: `{ open, mode: "verify" | "setup" | "change", onSuccess, onCancel }`
    - Use Radix Dialog for modal shell
    - Use `input-otp` package for 4-digit PIN input (already in dependencies)
    - **Verify mode**: show PIN input, call `/api/verify-pin`, fire `onSuccess` on 200
    - **Setup mode**: show create PIN → confirm PIN flow, call `/api/set-pin` on match, fire `onSuccess`
    - **Change mode**: verify current PIN → enter new PIN → confirm new PIN → call `/api/set-pin`
    - On failed verify: increment failed count in Capacitor Preferences (`pin_failed_count`)
    - At 3 failures: set `pin_lockout_until` in Preferences to `Date.now() + 15*60*1000`, call `/api/audit` with `pin_failed` + `{ lockout: true }`
    - While locked out: show countdown timer with remaining minutes/seconds, reject all PIN attempts
    - On lockout expiry: clear `pin_lockout_until` and `pin_failed_count` from Preferences
    - On successful verify: reset `pin_failed_count` to 0
    - _Requirements: 1.1, 1.4, 2.6, 2.7, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.4_

- [ ] 5. Integrate PIN gate into WalletScreen send flow
  - [ ] 5.1 Add PIN gate to `src/pages/WalletScreen.tsx` BLE send action
    - Import PinModal component
    - Before executing `sendViaBluetooth`, check if user has `pin_hash` set (fetch from profiles or cache)
    - If no PIN set: open PinModal in `setup` mode, on success proceed with send
    - If PIN set: open PinModal in `verify` mode, on success proceed with send
    - If wallet is locked (`locked_at` not null): block send, show lock banner instead
    - _Requirements: 1.3, 2.1, 2.5_

- [ ] 6. Integrate PIN gate into ProfileScreen send/withdraw flow
  - [ ] 6.1 Add PIN gate to `src/pages/ProfileScreen.tsx` send and withdraw actions
    - Import PinModal component
    - Gate the online transfer (`transfer_yuto_balance`) behind PIN verify/setup
    - Gate the M-PESA withdrawal behind PIN verify/setup
    - Gate split payment behind PIN verify/setup
    - Same logic as WalletScreen: check pin_hash → setup or verify → proceed on success
    - _Requirements: 1.3, 2.2, 2.3, 2.4, 2.5_

- [ ] 7. Wallet lock/unlock UI and banner
  - [ ] 7.1 Add wallet lock/unlock controls to ProfileScreen settings
    - Add "Lock Wallet" button in ProfileScreen settings section
    - On tap: call `supabase.rpc("lock_wallet")`, update local state
    - When locked: show "Unlock Wallet" option instead
    - On unlock tap: open PinModal in verify mode → on success call `supabase.rpc("unlock_wallet", { p_pin })` → update state
    - _Requirements: 5.1, 7.1, 7.2, 7.6_

  - [ ] 7.2 Add "Set PIN" and "Change PIN" options to ProfileScreen settings
    - Add "Set Transaction PIN" item (visible when pin_hash is null)
    - Add "Change PIN" item (visible when pin_hash is set)
    - "Set PIN" opens PinModal in `setup` mode
    - "Change PIN" opens PinModal in `change` mode
    - _Requirements: 1.1, 4.1, 4.2, 4.3, 4.5_

  - [ ] 7.3 Add wallet lock banner to WalletScreen and ProfileScreen
    - Fetch `locked_at` from wallets table on screen mount
    - If `locked_at` is not null: render red/amber banner "🔒 Wallet Locked — Tap to unlock"
    - Disable all send/transfer/withdraw buttons when locked
    - Tap banner → open PinModal verify → on success call `unlock_wallet` RPC → remove banner, re-enable buttons
    - _Requirements: 5.2, 5.3, 5.4, 7.1, 7.3, 7.4, 7.5_

- [ ] 8. Checkpoint
  - Ensure PIN flow works end-to-end, wallet lock/unlock toggles correctly, ask the user if questions arise.

- [ ] 9. Dispute system UI
  - [ ] 9.1 Add "Report a problem" action to transaction history items
    - In transaction list (WalletScreen or shared transaction component), add a menu/link on each transaction
    - On tap: open a bottom sheet / modal with dispute form
    - Form contains: reason dropdown (Wrong person, Wrong amount, Didn't receive item, Unauthorized) + optional notes textarea
    - On submit: call `supabase.rpc("create_dispute", { p_transaction_id, p_reason, p_note })`
    - Handle error for expired dispute window (show message "Dispute window expired")
    - On success: show confirmation, refresh transaction list
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

  - [ ] 9.2 Add dispute notification handling with Approve/Deny actions
    - In notification list or notification detail view, handle `dispute_opened` notification type
    - Display dispute details: disputer name, amount, reason
    - Show "Approve" and "Deny" buttons
    - Approve: call `supabase.rpc("resolve_dispute", { p_dispute_id, p_action: "approve" })`
    - Deny: call `supabase.rpc("resolve_dispute", { p_dispute_id, p_action: "deny" })`
    - Show success/error feedback after action
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

- [ ] 10. Final checkpoint
  - Ensure all flows work: PIN setup/verify/change, lockout, wallet lock/unlock, dispute create/resolve, audit events logged.
  - Ensure no TypeScript compilation errors in modified files.
  - Ask the user if questions arise.

## Notes

- No test tasks included per project requirements — implementation only
- Migration file handles all DB changes in a single file for atomic deployment
- PIN lockout state is client-side (Capacitor Preferences) — server still requires correct PIN regardless
- Wallet lock is enforced server-side in RPCs even if client UI is bypassed
- Audit events are inserted only via SECURITY DEFINER functions — no direct INSERT from authenticated role
- Dispute reverse transfer is atomic within the `resolve_dispute` RPC transaction

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1", "2.2", "2.3"] },
    { "id": 2, "tasks": ["4.1"] },
    { "id": 3, "tasks": ["5.1", "6.1", "7.1", "7.2", "7.3"] },
    { "id": 4, "tasks": ["9.1", "9.2"] }
  ]
}
```
