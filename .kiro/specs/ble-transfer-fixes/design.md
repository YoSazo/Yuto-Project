# BLE Transfer Fixes — Bugfix Design

## Overview

Four related bugs degrade the Bluetooth proximity transfer experience in the Yuto wallet app. The fixes are scoped to:
1. Adding a cached balance fallback to ProfileScreen (mirroring WalletScreen's existing pattern)
2. Triggering push notifications to BLE transfer recipients via the `/api/notify` endpoint
3. Adding a Supabase realtime subscription to ProfileScreen for wallet balance changes
4. Displaying pending offline transactions on WalletScreen

The general strategy is to replicate proven patterns already in WalletScreen and extend the existing notification infrastructure to cover BLE transfers.

## Glossary

- **Bug_Condition (C)**: The set of conditions that trigger the four bugs — offline ProfileScreen access, BLE transfer completion without notification, ProfileScreen open during balance change, and offline BLE sends with no pending UI
- **Property (P)**: The desired behavior — cached balance display, push notifications sent, realtime updates, and pending transfer visibility
- **Preservation**: Existing WalletScreen behavior, online ProfileScreen fetch, existing push notifications for top-ups/referrals/splits, and offline sync toast notifications must remain unchanged
- **`fetchYutoBalance(userId)`**: Function in `src/lib/supabase.ts` that reads balance from the `wallets` table via Supabase query
- **`cacheBalanceLocally()`**: Function in `src/lib/bluetooth.ts` that writes balance to Capacitor Preferences under key `yuto_cached_balance`
- **`getCachedBalance()`**: Function in `src/lib/bluetooth.ts` that reads the in-memory cache of the balance
- **`sendViaBluetooth()`**: Function in `src/lib/bluetooth.ts` that handles BLE P2P transfer (online settlement or offline queue)
- **`syncOfflineTransactions()`**: Function in `src/lib/bluetooth.ts` that settles queued offline transactions when connectivity returns
- **`/api/notify`**: Authenticated POST endpoint that sends a web push notification to a target user by `userId`
- **`authFetch()`**: Authenticated fetch wrapper in `src/lib/supabase.ts` that attaches the Supabase Bearer token
- **`yuto_offline_transactions`**: Capacitor Preferences key storing the array of `OfflineTransaction` objects with `synced: boolean`

## Bug Details

### Bug Condition

The bugs manifest across four distinct conditions in the BLE transfer flow:

1. **ProfileScreen offline balance**: User navigates to ProfileScreen while offline; `fetchYutoBalance()` fails silently returning 0, with no fallback to `yuto_cached_balance` in Capacitor Preferences.
2. **Missing BLE push notification**: A BLE transfer completes (online via `transfer_yuto_balance` RPC or offline via `settle_offline_transfer` RPC) but no code path calls `/api/notify` for the recipient.
3. **ProfileScreen no realtime**: User's wallet balance changes while ProfileScreen is open; no Supabase channel subscription exists to push the update.
4. **No pending transfers UI**: User sends BLE transfers offline (stored with `synced: false`) but WalletScreen has no component to display queued transactions.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type AppEvent
  OUTPUT: boolean
  
  RETURN (input.type == "navigate_profile" AND input.networkStatus == "offline")
         OR (input.type == "ble_transfer_complete" AND input.transferMethod IN ["online_rpc", "offline_settle"])
         OR (input.type == "balance_changed" AND input.activeScreen == "ProfileScreen")
         OR (input.type == "offline_tx_queued" AND input.screen == "WalletScreen" AND pendingTransactions.length > 0)
END FUNCTION
```

### Examples

- **Bug 1**: User opens ProfileScreen while on airplane mode → balance shows "0" or blank instead of the last known KSH 1,500 cached from their previous WalletScreen visit
- **Bug 2**: Alice sends Bob KSH 200 via BLE while both are online → `transfer_yuto_balance` succeeds, Bob's balance updates, but Bob receives no push notification
- **Bug 3**: Alice sends Bob KSH 200 offline, later syncs → `settle_offline_transfer` returns "settled", Bob's wallet row updates, but Bob receives no push notification
- **Bug 4**: User has ProfileScreen open, receives an incoming BLE transfer → WalletScreen would show the new balance via realtime subscription, but ProfileScreen still shows the stale value until page reload
- **Bug 5**: User sends 3 BLE transfers offline → transactions stored with `synced: false` in Preferences, but WalletScreen shows no indication of pending/queued transfers

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- WalletScreen's existing cached balance fallback on mount must continue to work exactly as before
- WalletScreen's existing Supabase realtime subscription on `wallets` table must remain unchanged
- Top-up, referral bonus, and split/function payment push notifications in `webhook.ts` must continue to fire as before
- The offline sync toast notification (`"X offline transfer(s) settled!"`) on WalletScreen must continue to appear
- Mouse/tap interactions on WalletScreen (BLE radar, send flow, top-up modal) must remain unchanged
- The `sendViaBluetooth()` return values and offline transaction storage format must remain unchanged

**Scope:**
All inputs that do NOT involve the four bug conditions should be completely unaffected by this fix. This includes:
- Online ProfileScreen balance fetch (should still call `fetchYutoBalance()` and display live data)
- Non-BLE transactions (top-ups, splits, function payments) — their notification paths are in `webhook.ts` and remain untouched
- WalletScreen realtime subscription — already works, no changes needed
- Offline transaction sync logic — the `syncOfflineTransactions()` settlement flow remains the same, we only add a notification call after successful settlement

## Hypothesized Root Cause

Based on the bug description and code analysis, the root causes are:

1. **ProfileScreen missing cache read**: `ProfileScreen.tsx` calls `fetchYutoBalance(user.id)` directly in its `loadProfile()` function with no try/catch fallback to Capacitor Preferences. WalletScreen's `loadWallet()` reads from `Preferences.get({ key: "yuto_cached_balance" })` first, then attempts the network fetch — ProfileScreen simply never implemented this pattern.

2. **No notification call in BLE transfer paths**: In `bluetooth.ts`, `sendViaBluetooth()` calls `supabase.rpc("transfer_yuto_balance", ...)` for online transfers but never calls `/api/notify` on success. Similarly, `syncOfflineTransactions()` calls `supabase.rpc("settle_offline_transfer", ...)` but never calls `/api/notify` when the result is `"settled"`. The `/api/notify` endpoint exists and works — it's simply never invoked from BLE code paths.

3. **ProfileScreen missing realtime subscription**: WalletScreen has a `useEffect` that creates a Supabase channel subscribing to `postgres_changes` on the `wallets` table filtered by `user_id`. ProfileScreen has no equivalent `useEffect` — it only fetches balance once on mount.

4. **No pending transactions component**: `getOfflineTransactions()` (synchronous, reads from memCache) returns the full list including `synced: false` entries, but WalletScreen never reads or displays this data. No UI component exists to show pending transfers.

## Correctness Properties

Property 1: Bug Condition - Offline ProfileScreen Shows Cached Balance

_For any_ navigation to ProfileScreen where the network is unavailable (fetchYutoBalance fails or times out), the ProfileScreen SHALL display the locally cached balance from Capacitor Preferences (`yuto_cached_balance`) as a fallback, showing the last known positive balance rather than 0.

**Validates: Requirements 2.1**

Property 2: Bug Condition - BLE Transfer Sends Push Notification

_For any_ BLE transfer that completes successfully (online via `transfer_yuto_balance` returning no error, or offline via `settle_offline_transfer` returning "settled"), the system SHALL call `/api/notify` with the recipient's userId, a title indicating money received, and a body containing the amount and sender name.

**Validates: Requirements 2.2, 2.3**

Property 3: Bug Condition - ProfileScreen Realtime Balance Updates

_For any_ wallet balance change (UPDATE on `wallets` table for the current user) while ProfileScreen is mounted, the ProfileScreen SHALL update the displayed balance in realtime without requiring a page reload.

**Validates: Requirements 2.4**

Property 4: Bug Condition - Pending Transfers Visibility

_For any_ state where `yuto_offline_transactions` contains entries with `synced: false`, the WalletScreen SHALL display a pending transfers indicator showing the count and/or list of queued transfers awaiting settlement.

**Validates: Requirements 2.5**

Property 5: Preservation - Online ProfileScreen Fetch

_For any_ navigation to ProfileScreen where the network is available, the ProfileScreen SHALL continue to fetch and display the live balance from the server via `fetchYutoBalance()`, and update the local cache with the fresh value.

**Validates: Requirements 3.1**

Property 6: Preservation - Existing Push Notifications

_For any_ top-up, referral bonus, or split/function payment completion, the system SHALL continue to send push notifications via the existing `webhook.ts` `sendPushNotification()` helper exactly as before, with no changes to those code paths.

**Validates: Requirements 3.2**

Property 7: Preservation - WalletScreen Existing Behavior

_For any_ interaction with WalletScreen (BLE radar, send flow, realtime subscription, offline sync toast), the system SHALL produce the same behavior as before the fix, preserving all existing functionality.

**Validates: Requirements 3.3, 3.4, 3.5**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `src/pages/ProfileScreen.tsx`

**Function**: `loadProfile()` (or equivalent data-loading useEffect)

**Specific Changes**:
1. **Add cached balance fallback**: Before calling `fetchYutoBalance()`, read from Capacitor Preferences (`yuto_cached_balance`) and set the balance state immediately. This mirrors WalletScreen's `loadWallet()` pattern.
   - Import `Preferences` from `@capacitor/preferences`
   - Read `yuto_cached_balance` key, parse JSON, set balance if `cached.balance > 0`
   - Wrap `fetchYutoBalance()` in try/catch with timeout (2.5s race, same as WalletScreen)
   - On success: update state and call `cacheBalanceLocally()`
   - On failure: keep the cached value displayed

2. **Add realtime subscription**: Add a `useEffect` that subscribes to Supabase `postgres_changes` on the `wallets` table filtered by `user_id=eq.${user.id}`, updating balance state on UPDATE events.
   - Import `cacheBalanceLocally` from `../lib/bluetooth`
   - Create channel `"profile-wallet-balance"`
   - On payload: `setPoints(Number(payload.new?.balance ?? 0))` and update cache
   - Cleanup: `supabase.removeChannel(channel)` on unmount

---

**File**: `src/lib/bluetooth.ts`

**Function**: `sendViaBluetooth()`

**Specific Changes**:
3. **Add push notification for online BLE transfers**: After the `supabase.rpc("transfer_yuto_balance", ...)` succeeds (no error), call `authFetch("/api/notify", ...)` with the recipient's userId, title "💸 Money received!", and body containing amount and sender name.
   - Import `authFetch` from `./supabase` (already in the same lib directory)
   - After the `if (!error)` block inside the online settlement try, fire-and-forget the notification call
   - Use `getCachedUser()` to get the sender's display name for the notification body

---

**File**: `src/lib/bluetooth.ts`

**Function**: `syncOfflineTransactions()`

**Specific Changes**:
4. **Add push notification for settled offline transfers**: After `settle_offline_transfer` returns `"settled"`, call `authFetch("/api/notify", ...)` with the recipient's userId, title "💸 Money received!", and body containing amount and sender name.
   - Same pattern as online: fire-and-forget after successful settlement
   - Use `getCachedUser()` for sender name

---

**File**: `src/pages/WalletScreen.tsx`

**Specific Changes**:
5. **Add pending transfers UI**: Add a component/section that reads offline transactions from Capacitor Preferences, filters for `synced: false`, and displays them as a pending indicator.
   - Import `getOfflineTransactions` (or expose it) from `../lib/bluetooth`
   - Add state: `pendingTransfers` array
   - Read pending transactions on mount and after each send
   - Display a card/banner showing "X transfers pending" with amount totals
   - Listen for `online` event to refresh (they'll be synced and disappear)

---

**File**: `src/lib/bluetooth.ts`

**Specific Changes**:
6. **Export `getOfflineTransactions`**: The function is currently private. Export it so WalletScreen can read pending transactions for display.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bugs on unfixed code, then verify the fixes work correctly and preserve existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bugs BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write unit tests that simulate each bug condition and assert the expected behavior. Run these tests on the UNFIXED code to observe failures and confirm root causes.

**Test Cases**:
1. **ProfileScreen Offline Balance Test**: Mock `fetchYutoBalance` to reject/timeout, verify ProfileScreen displays 0 (will fail — confirms no fallback exists)
2. **BLE Online Transfer Notification Test**: Mock `supabase.rpc("transfer_yuto_balance")` to succeed, verify `/api/notify` is called with recipient info (will fail — no call exists)
3. **BLE Offline Settlement Notification Test**: Mock `supabase.rpc("settle_offline_transfer")` to return "settled", verify `/api/notify` is called (will fail — no call exists)
4. **ProfileScreen Realtime Test**: Simulate a `postgres_changes` event on `wallets` table, verify ProfileScreen balance updates (will fail — no subscription exists)
5. **Pending Transfers UI Test**: Set `yuto_offline_transactions` with `synced: false` entries, verify WalletScreen renders pending indicator (will fail — no component exists)

**Expected Counterexamples**:
- ProfileScreen shows 0 when offline despite cached balance existing in Preferences
- No HTTP call to `/api/notify` after successful BLE transfer RPC
- ProfileScreen balance state unchanged after wallets table UPDATE event
- WalletScreen renders no pending transfer information despite queued transactions

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed functions produce the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  IF input.type == "navigate_profile" AND input.networkStatus == "offline" THEN
    result := ProfileScreen.loadProfile()
    ASSERT result.displayedBalance == cachedBalance AND cachedBalance > 0
  
  ELSE IF input.type == "ble_transfer_complete" THEN
    result := sendViaBluetooth_fixed(input) OR syncOfflineTransactions_fixed(input)
    ASSERT notifyEndpointCalled(input.recipientId, input.amount)
  
  ELSE IF input.type == "balance_changed" AND input.activeScreen == "ProfileScreen" THEN
    result := ProfileScreen.onRealtimeEvent(input.newBalance)
    ASSERT ProfileScreen.displayedBalance == input.newBalance
  
  ELSE IF input.type == "offline_tx_queued" THEN
    result := WalletScreen.render()
    ASSERT result.pendingIndicator.visible == true
    ASSERT result.pendingIndicator.count == pendingTransactions.length
  END IF
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed functions produce the same result as the original functions.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT ProfileScreen_fixed.onlineBalance(input) == ProfileScreen_original.onlineBalance(input)
  ASSERT webhook_fixed.sendPushNotification(input) == webhook_original.sendPushNotification(input)
  ASSERT WalletScreen_fixed.render(input) == WalletScreen_original.render(input)
  ASSERT syncOfflineTransactions_fixed.settlement(input) == syncOfflineTransactions_original.settlement(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain (various network states, transaction types, screen states)
- It catches edge cases that manual unit tests might miss (e.g., race conditions between cache read and network fetch)
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for online fetches, existing notifications, and WalletScreen interactions, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Online ProfileScreen Preservation**: Verify that when online, ProfileScreen still fetches live balance from server and displays it correctly (not just cache)
2. **Existing Notification Preservation**: Verify that top-up, referral, and split payment notifications in webhook.ts continue to fire with correct payloads
3. **WalletScreen Behavior Preservation**: Verify BLE radar, send flow, realtime subscription, and sync toast all continue working identically
4. **Offline Sync Flow Preservation**: Verify that `syncOfflineTransactions()` still correctly marks transactions as synced and shows the toast

### Unit Tests

- Test ProfileScreen `loadProfile()` with mocked offline Preferences read → displays cached balance
- Test ProfileScreen `loadProfile()` with mocked online fetch → displays live balance and updates cache
- Test `sendViaBluetooth()` online path → verify `authFetch("/api/notify", ...)` called with correct payload
- Test `syncOfflineTransactions()` settled path → verify `authFetch("/api/notify", ...)` called per settled tx
- Test ProfileScreen realtime subscription → verify balance state updates on channel event
- Test WalletScreen pending transfers component → renders correct count and amounts
- Test edge case: notification call fails silently (fire-and-forget, doesn't break transfer flow)
- Test edge case: cached balance is 0 → ProfileScreen shows 0 (doesn't show stale positive value)

### Property-Based Tests

- Generate random network states (online/offline/timeout) and verify ProfileScreen always shows a reasonable balance (cached or live, never undefined)
- Generate random BLE transfer amounts and recipient IDs, verify notification payload always contains correct amount and recipient after successful transfer
- Generate random sequences of balance updates via realtime events, verify ProfileScreen state always reflects the latest value
- Generate random sets of offline transactions with mixed `synced` states, verify pending UI shows exactly the `synced: false` subset

### Integration Tests

- Test full BLE send flow online: send → RPC succeeds → notification fires → sender balance decreases → recipient gets push
- Test full BLE send flow offline: send → queued → pending UI shows → come online → sync → notification fires → pending UI clears
- Test ProfileScreen lifecycle: mount offline (shows cache) → come online → fetch succeeds → balance updates → receive transfer → realtime updates balance
- Test that WalletScreen and ProfileScreen can both be mounted simultaneously with independent realtime subscriptions that don't conflict
