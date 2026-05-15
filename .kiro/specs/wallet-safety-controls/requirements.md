# Requirements Document

## Introduction

This feature adds four critical safety controls to the Yuto wallet: a 4-digit transaction PIN required before any outgoing money movement, a wallet lock/freeze mechanism that blocks all outgoing transfers server-side, a dispute/refund request system for transaction problems, and a comprehensive audit event log for administrative oversight. Together these controls protect users from unauthorized sends, provide a self-service freeze option, enable dispute resolution between parties, and give the platform operator full visibility into account activity.

## Glossary

- **PIN_System**: The transaction PIN subsystem comprising the PIN setup UI, PIN entry modal, PIN verification logic, and the `pin_hash` column on the `profiles` table
- **PIN_Modal**: The React modal component that prompts the user to enter their 4-digit PIN before any outgoing money action is executed
- **Wallet_Lock_System**: The wallet freeze subsystem comprising the lock/unlock UI controls, the `locked_at` column on the `wallets` table, and server-side enforcement in RPCs
- **Transfer_RPC**: The `transfer_yuto_balance` Supabase RPC function that executes online wallet-to-wallet transfers
- **Settlement_RPC**: The `settle_offline_transfer` Supabase RPC function that settles queued offline BLE transactions
- **Dispute_System**: The dispute/refund request subsystem comprising the dispute form UI, the `disputes` table, counterparty notification, and approval/denial flow
- **Audit_Logger**: The server-side and client-side components that write rows to the `audit_events` table for security-relevant actions
- **KES**: Kenyan Shilling, the currency unit for all transfer amounts
- **Lockout_Period**: A 15-minute window during which PIN entry is blocked after 3 consecutive failed attempts
- **Dispute_Window**: A 7-day period from transaction creation during which a user may open a dispute

## Requirements

### Requirement 1: Transaction PIN Setup

**User Story:** As a wallet user, I want to set a 4-digit transaction PIN, so that my outgoing transfers are protected by a secret only I know.

#### Acceptance Criteria

1. WHEN a user navigates to profile settings and selects "Set Transaction PIN", THE PIN_System SHALL display a PIN creation form requiring exactly 4 numeric digits
2. WHEN a user submits a valid 4-digit PIN, THE PIN_System SHALL store a bcrypt hash of the PIN in the `profiles.pin_hash` column for the authenticated user
3. IF a user has not yet set a PIN and attempts to send money for the first time, THEN THE PIN_System SHALL prompt the user to create a PIN before proceeding with the send action
4. THE PIN_System SHALL reject PIN values that are not exactly 4 numeric digits during setup
5. WHEN a PIN is successfully set, THE PIN_System SHALL log a `pin_set` event to the Audit_Logger

### Requirement 2: Transaction PIN Verification Before Outgoing Transfers

**User Story:** As a wallet user, I want to confirm my PIN before any money leaves my wallet, so that unauthorized access to my device cannot drain my balance.

#### Acceptance Criteria

1. WHEN a user initiates a BLE send via `sendViaBluetooth`, THE PIN_Modal SHALL appear and require correct PIN entry before the transfer executes
2. WHEN a user initiates an online transfer via `transfer_yuto_balance` from ProfileScreen, THE PIN_Modal SHALL appear and require correct PIN entry before the transfer executes
3. WHEN a user initiates a withdrawal to M-PESA, THE PIN_Modal SHALL appear and require correct PIN entry before the withdrawal executes
4. WHEN a user initiates a split payment, THE PIN_Modal SHALL appear and require correct PIN entry before the payment executes
5. THE PIN_Modal SHALL NOT appear for receiving money, viewing balance, or topping up the wallet
6. WHEN the user enters the correct PIN, THE PIN_System SHALL verify the entered PIN against the stored bcrypt hash and allow the pending action to proceed
7. IF the entered PIN does not match the stored hash, THEN THE PIN_System SHALL display an error message and increment the failed attempt counter

### Requirement 3: PIN Lockout After Failed Attempts

**User Story:** As a wallet user, I want my PIN locked after multiple wrong attempts, so that brute-force guessing of my PIN is prevented.

#### Acceptance Criteria

1. WHEN a user enters an incorrect PIN 3 consecutive times, THE PIN_System SHALL block all further PIN entry attempts for 15 minutes
2. WHILE the Lockout_Period is active, THE PIN_Modal SHALL display a message indicating the remaining lockout time
3. WHILE the Lockout_Period is active, THE PIN_System SHALL reject all PIN verification requests without checking the hash
4. WHEN the Lockout_Period expires, THE PIN_System SHALL reset the failed attempt counter to zero and allow PIN entry again
5. WHEN a PIN lockout is triggered, THE PIN_System SHALL log a `pin_failed` event to the Audit_Logger with metadata indicating lockout activation

### Requirement 4: PIN Change

**User Story:** As a wallet user, I want to change my transaction PIN from settings, so that I can update my PIN if I suspect it has been compromised.

#### Acceptance Criteria

1. WHEN a user selects "Change PIN" in profile settings, THE PIN_System SHALL require the user to enter the current PIN before accepting a new PIN
2. WHEN the current PIN is verified successfully, THE PIN_System SHALL display a form to enter and confirm a new 4-digit PIN
3. WHEN a new PIN is submitted and confirmed, THE PIN_System SHALL replace the existing `profiles.pin_hash` with a bcrypt hash of the new PIN
4. IF the current PIN verification fails during a change attempt, THEN THE PIN_System SHALL reject the change request and increment the failed attempt counter
5. WHEN a PIN is successfully changed, THE PIN_System SHALL log a `pin_changed` event to the Audit_Logger

### Requirement 5: Wallet Lock Activation

**User Story:** As a wallet user, I want to lock my wallet instantly from settings, so that I can freeze all outgoing money if my device is lost or compromised.

#### Acceptance Criteria

1. WHEN a user taps "Lock Wallet" in ProfileScreen settings, THE Wallet_Lock_System SHALL set the `wallets.locked_at` column to the current timestamp for the authenticated user
2. WHEN the wallet is locked, THE Wallet_Lock_System SHALL display a "Wallet Locked" banner on WalletScreen
3. WHEN the wallet is locked, THE Wallet_Lock_System SHALL display a "Wallet Locked" banner on ProfileScreen
4. WHEN the wallet is locked, THE Wallet_Lock_System SHALL disable all send/transfer/withdraw buttons in the UI
5. WHEN a wallet lock is activated, THE Wallet_Lock_System SHALL log a `wallet_locked` event to the Audit_Logger

### Requirement 6: Wallet Lock Server-Side Enforcement

**User Story:** As a platform operator, I want wallet lock enforced server-side, so that locked wallets cannot be drained even if the client UI is bypassed.

#### Acceptance Criteria

1. WHEN `transfer_yuto_balance` is called, THE Transfer_RPC SHALL check the `wallets.locked_at` column for the sender
2. IF `wallets.locked_at` is not null for the sender, THEN THE Transfer_RPC SHALL raise an exception with message 'Wallet is locked'
3. WHEN `settle_offline_transfer` is called, THE Settlement_RPC SHALL check the `wallets.locked_at` column for the sender
4. IF `wallets.locked_at` is not null for the sender, THEN THE Settlement_RPC SHALL return 'wallet_locked' without executing the transfer
5. WHILE the wallet is locked, THE Wallet_Lock_System SHALL allow incoming transfers and top-ups to proceed without restriction

### Requirement 7: Wallet Unlock

**User Story:** As a wallet user, I want to unlock my wallet using my transaction PIN, so that I can resume normal wallet operations after confirming my identity.

#### Acceptance Criteria

1. WHEN a user taps "Unlock Wallet" on the locked wallet banner, THE Wallet_Lock_System SHALL display the PIN_Modal requiring correct PIN entry
2. WHEN the correct PIN is entered, THE Wallet_Lock_System SHALL set `wallets.locked_at` to null for the authenticated user
3. WHEN the wallet is unlocked, THE Wallet_Lock_System SHALL remove the "Wallet Locked" banner from WalletScreen and ProfileScreen
4. WHEN the wallet is unlocked, THE Wallet_Lock_System SHALL re-enable all send/transfer/withdraw buttons in the UI
5. WHEN a wallet unlock is completed, THE Wallet_Lock_System SHALL log a `wallet_unlocked` event to the Audit_Logger
6. IF the PIN verification fails during unlock, THEN THE Wallet_Lock_System SHALL keep the wallet locked and increment the failed attempt counter

### Requirement 8: Dispute Creation

**User Story:** As a wallet user, I want to report a problem on any transaction, so that I can request a refund if something went wrong.

#### Acceptance Criteria

1. WHEN a user views a transaction in their history, THE Dispute_System SHALL display a "Report a problem" action on the transaction
2. WHEN a user taps "Report a problem", THE Dispute_System SHALL display a dispute form with a reason dropdown and an optional notes text field
3. THE Dispute_System SHALL provide the following reason options in the dropdown: "Wrong person", "Wrong amount", "Didn't receive item", "Unauthorized"
4. WHEN the user submits the dispute form, THE Dispute_System SHALL create a row in the `disputes` table with status 'open', the transaction ID, the disputing user ID, the selected reason, and the optional note
5. IF the transaction was created more than 7 days ago, THEN THE Dispute_System SHALL reject the dispute submission with a message indicating the Dispute_Window has expired
6. WHEN a dispute is created, THE Dispute_System SHALL log a `dispute_opened` event to the Audit_Logger

### Requirement 9: Dispute Notification and Resolution

**User Story:** As a wallet user who receives a dispute, I want to be notified and given the option to approve or deny the refund, so that legitimate refund requests can be resolved quickly.

#### Acceptance Criteria

1. WHEN a dispute is created, THE Dispute_System SHALL send a notification to the counterparty with the message format "X requested a refund of KSH Y" where X is the disputer display name and Y is the transaction amount
2. WHEN the counterparty views the dispute notification, THE Dispute_System SHALL display "Approve" and "Deny" action buttons
3. WHEN the counterparty taps "Approve", THE Dispute_System SHALL execute a reverse transfer of the disputed amount from the counterparty wallet back to the disputer wallet
4. WHEN the counterparty taps "Approve", THE Dispute_System SHALL update the dispute status to 'resolved' and log a `dispute_resolved` event to the Audit_Logger
5. WHEN the counterparty taps "Deny", THE Dispute_System SHALL update the dispute status to 'denied' and notify the disputer that the refund was denied
6. IF the counterparty denies the dispute, THEN THE Dispute_System SHALL keep the dispute record available for future admin review

### Requirement 10: Audit Event Logging

**User Story:** As a platform operator, I want all security-relevant actions logged to an audit table, so that I have a complete timeline of user activity for investigation and compliance.

#### Acceptance Criteria

1. THE Audit_Logger SHALL write events to the `audit_events` table with columns: user_id (uuid), event_type (text), metadata (jsonb), ip_address (text), device_info (text), created_at (timestamptz)
2. THE Audit_Logger SHALL log the following event types: pin_set, pin_changed, pin_failed, wallet_locked, wallet_unlocked, transfer_sent, transfer_received, transfer_failed, withdrawal_initiated, withdrawal_completed, dispute_opened, dispute_resolved, login, logout
3. WHEN a server-side RPC executes a loggable action, THE Audit_Logger SHALL record the event within the same database transaction
4. WHEN a client-side UI event occurs that requires logging, THE Audit_Logger SHALL send the event to a `/api/audit` endpoint for server-side persistence
5. THE Audit_Logger SHALL include relevant context in the metadata field including transaction IDs, amounts, and counterparty IDs where applicable

### Requirement 11: Audit Event Access Control

**User Story:** As a platform operator, I want audit events protected by row-level security, so that users cannot read other users' audit trails and the data remains secure.

#### Acceptance Criteria

1. THE Audit_Logger SHALL enforce RLS on the `audit_events` table such that authenticated users can only SELECT rows where `user_id` matches their own auth.uid()
2. THE Audit_Logger SHALL allow INSERT on the `audit_events` table only through SECURITY DEFINER functions or the service role
3. THE Audit_Logger SHALL NOT expose any user-facing UI for viewing audit events in the current release
4. THE Audit_Logger SHALL retain all audit event records indefinitely without automatic deletion
