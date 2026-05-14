# Bugfix Requirements Document

## Introduction

Four related bugs have been identified in the Bluetooth proximity transfer flow of the Yuto wallet app. These issues degrade the offline experience and reduce user confidence in BLE transfers:

1. **ProfileScreen shows no balance when offline** — unlike WalletScreen which reads from Capacitor Preferences cache, ProfileScreen calls `fetchYutoBalance()` with no fallback.
2. **BLE transfers send no push notification to the recipient** — the push notification system exists but webhook.ts only triggers notifications for top-ups, referral bonuses, and split/function payments.
3. **ProfileScreen has no realtime balance subscription** — WalletScreen subscribes to `postgres_changes` on the `wallets` table, but ProfileScreen only fetches balance on page load.
4. **Offline BLE transfers have no pending UI for the sender** — transactions are stored in `yuto_offline_transactions` with `synced: false` but the sender has no visibility into queued transfers.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the user navigates to ProfileScreen while offline THEN the system shows a balance of 0 or nothing because `fetchYutoBalance(user.id)` fails with no cached fallback

1.2 WHEN a BLE transfer completes online via `transfer_yuto_balance` RPC THEN the system does NOT send a push notification to the recipient

1.3 WHEN a BLE transfer is settled offline via `settle_offline_transfer` RPC THEN the system does NOT send a push notification to the recipient

1.4 WHEN the user's wallet balance is updated by an incoming BLE transfer while ProfileScreen is open THEN the system does NOT update the displayed balance in realtime (requires page reload)

1.5 WHEN the user sends a BLE transfer offline (stored in `yuto_offline_transactions` with `synced: false`) THEN the system provides no UI indication of pending/queued transfers to the sender

### Expected Behavior (Correct)

2.1 WHEN the user navigates to ProfileScreen while offline THEN the system SHALL display the locally cached balance from Capacitor Preferences (`yuto_cached_balance`) as a fallback

2.2 WHEN a BLE transfer completes online via `transfer_yuto_balance` RPC THEN the system SHALL send a push notification to the recipient informing them of the received amount and sender name

2.3 WHEN a BLE transfer is settled via `settle_offline_transfer` RPC THEN the system SHALL send a push notification to the recipient informing them of the received amount and sender name

2.4 WHEN the user's wallet balance changes while ProfileScreen is open THEN the system SHALL update the displayed balance in realtime via a Supabase realtime subscription on the `wallets` table

2.5 WHEN the user has offline BLE transfers with `synced: false` THEN the system SHALL display a pending transfers indicator or list on WalletScreen showing the queued transfers awaiting settlement

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the user navigates to ProfileScreen while online THEN the system SHALL CONTINUE TO fetch and display the live balance from the server

3.2 WHEN a top-up, referral bonus, or split/function payment completes THEN the system SHALL CONTINUE TO send push notifications to the relevant user as before

3.3 WHEN the user navigates to WalletScreen THEN the system SHALL CONTINUE TO show the BLE radar, send flow, and realtime balance subscription as before

3.4 WHEN offline transactions are eventually synced THEN the system SHALL CONTINUE TO show the toast notification confirming settlement

3.5 WHEN the user's balance is updated via any method on WalletScreen THEN the system SHALL CONTINUE TO update in realtime via the existing Supabase channel subscription
