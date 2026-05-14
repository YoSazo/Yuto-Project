# Requirements Document

## Introduction

This feature hardens the security of the Yuto BLE (Bluetooth Low Energy) peer-to-peer transfer system. It addresses critical vulnerabilities found during a security audit: lack of payload validation, missing amount limits, absence of cryptographic signing, no rate limiting on notifications, and no offline transaction cancellation. The scope covers Priority 1 (critical) and Priority 2 (important) fixes only.

## Glossary

- **BLE_Transfer_System**: The Bluetooth Low Energy peer-to-peer payment subsystem comprising the client-side `bluetooth.ts` module, the `transfer_yuto_balance` RPC, and the `settle_offline_transfer` RPC
- **Payload_Validator**: The client-side component that validates incoming BLE transaction payloads before storage
- **Transfer_RPC**: The `transfer_yuto_balance` Supabase RPC function that executes online wallet-to-wallet transfers
- **Settlement_RPC**: The `settle_offline_transfer` Supabase RPC function that settles queued offline BLE transactions
- **Notify_Endpoint**: The `/api/notify` Vercel serverless function that sends push notifications to users
- **HMAC_Signer**: The client-side component that generates HMAC-SHA256 signatures for outgoing BLE transaction payloads
- **Offline_TX_Manager**: The client-side component that manages the lifecycle of offline transactions including queuing, syncing, and cancellation
- **KES**: Kenyan Shilling, the currency unit for all transfer amounts
- **Daily_Limit**: The maximum cumulative transfer amount a single user can send within a rolling 24-hour period (150,000 KES)
- **Transaction_Payload**: A JSON object containing fields: id (UUID), senderId (UUID), recipientId (UUID), amount (numeric), timestamp (Unix milliseconds), and hmac (base64 string)

## Requirements

### Requirement 1: BLE Payload Schema Validation

**User Story:** As a receiver of BLE transfers, I want incoming payloads to be validated against a strict schema, so that malformed or malicious data cannot be stored or processed.

#### Acceptance Criteria

1. WHEN a BLE payload is received, THE Payload_Validator SHALL reject the payload if the `id` field is not a valid UUID v4 format
2. WHEN a BLE payload is received, THE Payload_Validator SHALL reject the payload if the `senderId` field is not a valid UUID v4 format
3. WHEN a BLE payload is received, THE Payload_Validator SHALL reject the payload if the `recipientId` field is not a valid UUID v4 format
4. WHEN a BLE payload is received, THE Payload_Validator SHALL reject the payload if the `amount` field is not a number
5. WHEN a BLE payload is received, THE Payload_Validator SHALL reject the payload if the `timestamp` field is not a positive integer
6. WHEN a BLE payload is received, THE Payload_Validator SHALL reject the payload if any required field (id, senderId, recipientId, amount, timestamp) is missing
7. IF a BLE payload fails schema validation, THEN THE Payload_Validator SHALL discard the payload and log a warning without storing it

### Requirement 2: BLE Payload Amount Bounds Enforcement

**User Story:** As a receiver of BLE transfers, I want amount bounds enforced on incoming payloads, so that spam micro-transactions and unrealistically large transfers are blocked at the receiver.

#### Acceptance Criteria

1. WHEN a BLE payload is received with an amount less than 1 KES, THE Payload_Validator SHALL reject the payload
2. WHEN a BLE payload is received with an amount greater than 50,000 KES, THE Payload_Validator SHALL reject the payload
3. WHEN a BLE payload is received with a non-integer amount, THE Payload_Validator SHALL round the amount to the nearest integer before validation

### Requirement 3: BLE Payload Timestamp Freshness Validation

**User Story:** As a receiver of BLE transfers, I want timestamp freshness enforced on incoming payloads, so that replayed or stale transactions are rejected immediately.

#### Acceptance Criteria

1. WHEN a BLE payload is received with a timestamp more than 1 hour in the past relative to the receiver device clock, THE Payload_Validator SHALL reject the payload
2. WHEN a BLE payload is received with a timestamp in the future relative to the receiver device clock, THE Payload_Validator SHALL reject the payload
3. IF a payload is rejected due to timestamp freshness, THEN THE Payload_Validator SHALL log the rejection reason including the timestamp difference

### Requirement 4: Transfer RPC Amount Limits

**User Story:** As a platform operator, I want per-transaction amount limits enforced server-side, so that no single transfer can exceed safe bounds regardless of client behavior.

#### Acceptance Criteria

1. WHEN `transfer_yuto_balance` is called with `p_amount_kes` less than 1, THE Transfer_RPC SHALL raise an exception with message 'Amount below minimum (1 KES)'
2. WHEN `transfer_yuto_balance` is called with `p_amount_kes` greater than 50,000, THE Transfer_RPC SHALL raise an exception with message 'Amount exceeds maximum (50,000 KES)'
3. WHEN `settle_offline_transfer` is called with `p_amount_kes` less than 1, THE Settlement_RPC SHALL return 'invalid_amount'
4. WHEN `settle_offline_transfer` is called with `p_amount_kes` greater than 50,000, THE Settlement_RPC SHALL return 'invalid_amount'

### Requirement 5: Daily Cumulative Transfer Limit

**User Story:** As a platform operator, I want a daily cumulative transfer limit per user, so that a compromised account cannot drain its entire balance in a short time.

#### Acceptance Criteria

1. WHEN `transfer_yuto_balance` is called, THE Transfer_RPC SHALL calculate the sum of all transfers sent by the authenticated user in the past 24 hours
2. IF the sum of past 24-hour transfers plus the requested amount exceeds 150,000 KES, THEN THE Transfer_RPC SHALL raise an exception with message 'Daily transfer limit exceeded (150,000 KES)'
3. WHEN `settle_offline_transfer` is called, THE Settlement_RPC SHALL calculate the sum of all settled offline transfers by the sender in the past 24 hours
4. IF the sum of past 24-hour settled offline transfers plus the requested amount exceeds 150,000 KES, THEN THE Settlement_RPC SHALL return 'daily_limit_exceeded'
5. THE Transfer_RPC SHALL count only successfully completed transfers (not rejected or expired) toward the daily limit

### Requirement 6: Notify Endpoint Rate Limiting

**User Story:** As a user, I want the notification endpoint rate-limited, so that no user can spam me with excessive push notifications.

#### Acceptance Criteria

1. THE Notify_Endpoint SHALL track the number of notifications sent by each authenticated user per minute
2. WHEN an authenticated user has sent 10 or more notifications in the current 60-second window, THE Notify_Endpoint SHALL return HTTP 429 with message 'Rate limit exceeded'
3. THE Notify_Endpoint SHALL reset the per-user notification count after 60 seconds from the first notification in the window

### Requirement 7: Notify Endpoint Relationship Check

**User Story:** As a user, I want notifications restricted to users I have a transaction history with, so that strangers cannot send me unsolicited push notifications.

#### Acceptance Criteria

1. WHEN a notification request is received, THE Notify_Endpoint SHALL verify that the authenticated sender has at least one completed transaction (sent or received) with the target user
2. IF no transaction history exists between the sender and the target user, THEN THE Notify_Endpoint SHALL return HTTP 403 with message 'No transaction relationship with target user'
3. THE Notify_Endpoint SHALL check the `transactions` table for records where the sender is either `user_id` or `counterparty_id` paired with the target user

### Requirement 8: HMAC Signing of BLE Payloads

**User Story:** As a platform operator, I want BLE payloads cryptographically signed by the sender, so that forged offline transactions from malicious BLE devices are rejected at settlement.

#### Acceptance Criteria

1. WHEN a BLE transaction payload is constructed for sending, THE HMAC_Signer SHALL generate an HMAC-SHA256 signature using a per-user secret derived from the user's current auth session
2. THE HMAC_Signer SHALL include the signature as a base64-encoded `hmac` field in the Transaction_Payload
3. THE HMAC_Signer SHALL compute the HMAC over the concatenation of: id + senderId + recipientId + amount + timestamp (in that exact order, as strings)
4. WHEN `settle_offline_transfer` is called, THE Settlement_RPC SHALL verify the HMAC signature against the sender's stored secret before executing the transfer
5. IF the HMAC signature is missing or invalid, THEN THE Settlement_RPC SHALL return 'invalid_signature' and log the attempt

### Requirement 9: Receiver-Side Payload Sanitization

**User Story:** As a receiver of BLE transfers, I want all payload fields sanitized after schema validation, so that injection attacks or unexpected data types cannot propagate into local storage.

#### Acceptance Criteria

1. WHEN a BLE payload passes schema validation, THE Payload_Validator SHALL trim all string fields to a maximum of 36 characters (UUID length)
2. WHEN a BLE payload passes schema validation, THE Payload_Validator SHALL coerce the amount field to an integer using Math.round
3. WHEN a BLE payload passes schema validation, THE Payload_Validator SHALL verify that senderId does not equal recipientId
4. IF senderId equals recipientId in a received payload, THEN THE Payload_Validator SHALL reject the payload

### Requirement 10: Offline Transaction Cancellation

**User Story:** As a sender of an offline BLE transfer, I want to cancel a pending transaction before it syncs, so that I can recover funds if I sent to the wrong person or entered the wrong amount.

#### Acceptance Criteria

1. WHILE an offline transaction has `synced` status equal to false, THE Offline_TX_Manager SHALL allow the sender to mark the transaction as cancelled
2. WHEN a transaction is marked as cancelled, THE Offline_TX_Manager SHALL set a `cancelled` flag on the transaction record in local storage
3. WHEN `syncOfflineTransactions` runs, THE Offline_TX_Manager SHALL skip any transaction marked as cancelled and not submit it to the Settlement_RPC
4. WHEN a transaction is cancelled, THE Offline_TX_Manager SHALL restore the deducted amount to the local cached balance
5. IF a transaction has already been synced (synced equals true), THEN THE Offline_TX_Manager SHALL reject the cancellation request

### Requirement 11: Settlement RPC Expiry Window Reduction

**User Story:** As a platform operator, I want the offline transaction expiry window reduced from 24 hours to 1 hour, so that a temporarily compromised device has a smaller window to queue fraudulent transactions.

#### Acceptance Criteria

1. WHEN `settle_offline_transfer` is called with a `p_timestamp` older than 1 hour, THE Settlement_RPC SHALL mark the transaction as 'expired' in the offline_tx_log
2. WHEN `settle_offline_transfer` is called with a `p_timestamp` older than 1 hour, THE Settlement_RPC SHALL return 'expired' without executing the transfer
3. THE Settlement_RPC SHALL calculate expiry as: (current server epoch milliseconds minus p_timestamp) divided by 3,600,000 exceeding 1.0
