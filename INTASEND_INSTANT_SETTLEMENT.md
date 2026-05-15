# Yuto — Instant Settlement Request
## Complete Risk Assessment & Platform Documentation for IntaSend Finance/Underwriting

---

## 1. Executive Summary

Yuto is a peer-to-peer social payment app for Kenyan youth (18+). We use IntaSend exclusively for M-PESA STK push collections and B2C disbursements. We are requesting instant settlement to enable real-time wallet crediting upon successful M-PESA collection.

**The ask:** When our webhook receives `state: "COMPLETE"`, the collected funds should be immediately available in our IntaSend wallet — not held for T+1 or T+2.

**Why it matters:** Without instant settlement, a user tops up KSH 500 and cannot use it for 24–48 hours. The app becomes unusable. Our entire product is built around instant money movement.

**Our risk profile:** Closed-loop KES-only system, small transaction sizes (avg KSH 200–2,000), KYC-gated limits, no credit/lending, no cross-border, withdrawals only to the same verified M-PESA number that deposited. Chargeback risk is near-zero because M-PESA STK push requires the user's own PIN on their own device.

---

## 2. Platform Overview

### What Yuto Does

| Feature | Description |
|---------|-------------|
| Wallet top-up | User adds KES from M-PESA via STK push |
| P2P transfers | Send money to friends (online or via Bluetooth proximity) |
| Bill splitting | Create group splits, each person pays their share |
| Events & commerce | Host ticketed events, sell products, offer services |
| Withdrawal | Cash out Yuto balance to M-PESA |

### What Yuto Does NOT Do

| Excluded Activity | Reason |
|-------------------|--------|
| Lending/credit | No credit extended. Users spend only what they deposit. |
| Cross-border transfers | KES only, Kenya only. No forex. |
| Cryptocurrency | No crypto buying, selling, or holding. |
| Gambling/betting | No gambling features of any kind. |
| Anonymous transfers | All users have verified phone numbers for meaningful volume. |
| Third-party payouts | Withdrawals go only to the depositor's own M-PESA number. |
| Cash advances | Not offered. Zero default risk. |
| Merchant acquiring | We are not a merchant payment processor. |

---

## 3. Fund Flow Architecture

### How Money Enters the System

```
User's M-PESA Account
        │
        │ (1) STK Push initiated by Yuto via IntaSend Checkout API
        │     User confirms with their M-PESA PIN on their phone
        ▼
IntaSend Collection
        │
        │ (2) IntaSend processes the M-PESA payment
        │     Sends webhook to https://yuto.social/api/webhook
        │     Payload includes: state="COMPLETE", amount, invoice_id
        ▼
Yuto Webhook Handler
        │
        │ (3) Validates webhook signature
        │     Checks idempotency (invoice_id not already processed)
        │     Credits user's internal wallet ledger
        │     Logs transaction with full metadata
        ▼
User's Yuto Wallet (Internal Ledger)
        │
        │ (4) User can now send to other users, pay for events, etc.
        │     All P2P movement is INTERNAL — no money leaves IntaSend
        ▼
[Internal transfers between users — no IntaSend involvement]
```

### How Money Exits the System

```
User's Yuto Wallet (Internal Ledger)
        │
        │ (1) User requests withdrawal from app
        │     Must enter Transaction PIN
        │     Must have wallet unlocked
        │     Withdrawal goes to SAME phone number that topped up
        ▼
Yuto Withdrawal Handler
        │
        │ (2) Deducts from internal ledger
        │     Calls IntaSend B2C Send Money API
        │     Target: user's verified M-PESA number
        ▼
IntaSend B2C Disbursement
        │
        │ (3) IntaSend sends KES to user's M-PESA
        ▼
User's M-PESA Account (same number that deposited)
```

### Critical Point: IntaSend's Exposure

IntaSend only handles money at two touchpoints:
1. **Collection** (M-PESA STK push → IntaSend wallet)
2. **Disbursement** (IntaSend wallet → M-PESA B2C)

All peer-to-peer transfers, splits, event payments, and commerce transactions happen **entirely on Yuto's internal ledger**. No money moves through IntaSend for these. IntaSend's net exposure at any time is:

```
Net Exposure = Total Withdrawals Pending - Available IntaSend Wallet Balance
```

Since users keep float in their Yuto wallets (for P2P sends), total deposits always exceed total withdrawals. **IntaSend is never in a negative position.**

---

## 4. Fraud Prevention — Complete System

### 4.1 Authentication & Access Control

| Control | Implementation |
|---------|---------------|
| Account creation | Username + password (bcrypt hashed) |
| Phone verification | OTP via SMS, verified before Tier 1 access |
| Transaction PIN | 4-digit PIN (bcrypt hashed), required before ANY outgoing money movement |
| PIN lockout | 3 consecutive failures → 15-minute lockout, logged as fraud alert |
| Wallet lock/freeze | User can instantly freeze all outgoing transfers; server-enforced in PostgreSQL |
| Session management | Supabase JWT tokens with expiry |

### 4.2 Transaction Limits (Server-Enforced, Cannot Be Bypassed)

| KYC Tier | Verification Required | Per-Transaction Limit | Daily Cumulative Limit |
|----------|----------------------|----------------------|----------------------|
| Tier 0 (new user) | Username only | KSH 2,000 | KSH 5,000 |
| Tier 1 (phone verified) | M-PESA phone OTP | KSH 50,000 | KSH 50,000 |
| Tier 2 (ID verified) | National ID submitted | KSH 50,000 | KSH 150,000 |

**Enforcement:** These limits are checked inside PostgreSQL `SECURITY DEFINER` functions. The client application cannot bypass them — even if someone reverse-engineers the app, the database rejects transactions exceeding the tier limits.

### 4.3 Automated Fraud Detection & Alerting

| Alert Type | Trigger Condition | Severity | Action |
|-----------|-------------------|----------|--------|
| `daily_limit_hit` | User attempts transfer that would exceed daily limit | High | Transaction blocked, alert logged |
| `rapid_transfers` | 5+ transfers in under 2 minutes | High | Alert logged for review |
| `new_device_large_send` | First transfer from new device exceeds KSH 10,000 | Medium | Alert logged |
| `multiple_failed_pins` | 3+ failed PIN attempts | High | Account locked for 15 min, alert logged |
| `suspicious_pattern` | Unusual transfer pattern detected | Medium | Alert logged for review |
| `large_withdrawal` | Single withdrawal exceeds KSH 20,000 | Low | Alert logged |

All alerts are stored in a `fraud_alerts` table with severity, metadata, and acknowledgment status. Reviewed via admin dashboard.

### 4.4 Offline BLE Transfer Security

Yuto's unique feature is Bluetooth proximity transfers. Here's how we prevent abuse:

| Security Layer | What It Does |
|---------------|--------------|
| HMAC-SHA256 signing | Every BLE payload is cryptographically signed with a secret derived from the sender's auth token. Server verifies signature before settling. |
| Payload validation | Receiver validates: UUID format, amount bounds (1–50,000 KES), timestamp freshness (±1 hour), sender ≠ recipient |
| 1-hour expiry | Offline transactions must settle within 1 hour or they're automatically rejected |
| Idempotency | Each transaction has a unique UUID. The `offline_tx_log` table prevents double-settlement |
| Sender-only settlement | Only the authenticated sender can call the settlement RPC (`auth.uid() = sender_id`) |
| Balance check at settlement | Even if BLE payload was accepted, server checks real balance before executing |

**Attack scenario: Someone crafts a fake BLE payload**
→ Rejected at settlement because HMAC signature won't match the sender's stored secret

**Attack scenario: Someone replays an old BLE transaction**
→ Rejected by idempotency check (tx_id already in offline_tx_log) OR rejected by 1-hour expiry

**Attack scenario: Someone modifies the amount in a BLE payload**
→ Rejected because HMAC is computed over `id|senderId|recipientId|amount|timestamp` — any modification invalidates the signature

### 4.5 Withdrawal Security

| Control | Detail |
|---------|--------|
| Destination locked | Withdrawals go ONLY to the M-PESA number the user verified during onboarding |
| PIN required | Transaction PIN must be entered before withdrawal |
| Wallet must be unlocked | Locked wallets cannot withdraw |
| Minimum amount | KSH 20 minimum withdrawal |
| Fee | KSH 40 per withdrawal (covers B2C cost + discourages micro-withdrawals) |
| Balance check | Server verifies sufficient balance before calling B2C API |
| Failed withdrawal refund | If B2C fails, funds are automatically refunded to user's wallet via `refund_failed_withdrawal` RPC |

### 4.6 Anti-Money Laundering (AML) Considerations

| Measure | Implementation |
|---------|---------------|
| Closed loop | Money enters from M-PESA, exits to same M-PESA. No anonymous cash-out. |
| KYC tiers | Meaningful volume requires phone verification (tied to real Safaricom identity) |
| Transaction limits | Daily caps prevent large-scale money movement |
| Audit trail | Every transaction, transfer, login, PIN attempt, and security event is logged with timestamp, IP, and device info |
| Suspicious activity | Fraud alerts auto-generated when limits are hit or unusual patterns detected |
| No cash-in/cash-out agents | All money movement is digital via M-PESA — no physical cash handling |
| No anonymous accounts | Every account has a username; meaningful use requires phone verification |

---

## 5. Dispute Resolution System

### How Disputes Work

1. **User opens dispute** — within 7 days of transaction, selects reason (wrong person, wrong amount, didn't receive item, unauthorized)
2. **Counterparty notified** — receives in-app notification "X requested a refund of KSH Y"
3. **Counterparty responds** — can Approve (auto-reverses transfer) or Deny
4. **If approved** — atomic reverse transfer executed server-side, both parties' wallets updated, transaction records created
5. **If denied** — dispute remains on record for admin review

### Dispute Reasons

| Reason | Description | Expected Resolution |
|--------|-------------|-------------------|
| Wrong person | Sent to incorrect recipient | Counterparty approves refund |
| Wrong amount | Sent incorrect amount | Counterparty approves partial/full refund |
| Didn't receive item | Paid for goods/service not delivered | Admin review if denied |
| Unauthorized | Someone else used my account | Investigate via audit log |

### Dispute Safeguards

- 7-day window — cannot dispute transactions older than 7 days
- Server-side enforcement — dispute RPC validates ownership and time window
- Atomic reversal — approve triggers a single database transaction (debit counterparty + credit disputer)
- Audit logged — every dispute creation and resolution is logged
- No double-dispute — cannot open multiple disputes on the same transaction

---

## 6. Chargeback Risk Analysis

### Why Chargeback Risk Is Near-Zero

| Factor | Explanation |
|--------|-------------|
| M-PESA STK Push authentication | User must enter their own M-PESA PIN on their own phone. This is 2FA by design — possession of phone + knowledge of PIN. |
| No card payments | We don't accept credit/debit cards. Card chargebacks don't apply. |
| No PayPal/bank transfers | Only M-PESA. M-PESA doesn't have a consumer chargeback mechanism like cards do. |
| User initiates the payment | The STK push is triggered by the user tapping "Top Up" in the app. It's not a merchant-initiated charge. |
| Safaricom confirmation | User sees the exact amount on their phone's STK prompt before confirming. No hidden charges. |

### Theoretical Chargeback Scenarios & Our Response

| Scenario | Likelihood | Our Protection |
|----------|-----------|---------------|
| "I didn't authorize this top-up" | Near-zero (requires user's M-PESA PIN) | Audit log shows user initiated from their device + IP |
| "I topped up but didn't receive balance" | Very low (webhook idempotency) | Transaction log shows credit; if webhook failed, we can reconcile |
| "Someone stole my phone and topped up" | Low | Transaction PIN required to spend; wallet lock available; audit trail shows device/IP |
| "I want my money back after sending to someone" | N/A — this is a dispute, not a chargeback | Dispute system handles this between users |

**Bottom line:** M-PESA STK push is one of the most secure collection methods available. The user authenticates with their own PIN on their own device. There is no mechanism for a user to reverse an M-PESA payment after confirmation — unlike credit cards which have 60–120 day chargeback windows.

---

## 7. Data Security & Compliance

### Infrastructure

| Component | Provider | Security |
|-----------|----------|----------|
| Database | Supabase (PostgreSQL) | Row-Level Security, encrypted at rest, SSL in transit |
| API | Vercel (serverless) | HTTPS only, no persistent state |
| Auth | Supabase Auth | JWT tokens, bcrypt password hashing |
| Payments | IntaSend | PCI-DSS compliant, CBK-licensed |
| BLE transfers | On-device | HMAC-SHA256 signed, validated server-side |

### Data Protection

| Data Type | Storage | Access Control |
|-----------|---------|---------------|
| Passwords | bcrypt hash (never plaintext) | Not readable by anyone |
| Transaction PIN | bcrypt hash | Not readable by anyone |
| Phone numbers | Encrypted column | User + admin only |
| Transaction history | PostgreSQL with RLS | User sees only their own |
| Audit events | PostgreSQL with RLS | User sees only their own; admin via service role |
| M-PESA receipts | Stored in transaction metadata | User + admin only |

### Compliance Posture

| Requirement | Status |
|-------------|--------|
| Data Protection Act 2019 (Kenya) | Privacy policy published, data minimization practiced, deletion available |
| CBK National Payment System Act | Operating under IntaSend's PSP license |
| Consumer protection | Clear terms, dispute resolution, support tickets, account deletion |
| Record keeping | All transactions retained with full metadata for 7+ years |
| Suspicious activity reporting | Fraud alerts system in place, admin dashboard for review |

---

## 8. Operational Maturity

### Monitoring & Alerting

| System | Purpose |
|--------|---------|
| Sentry | Real-time error monitoring, crash reporting |
| Audit event log | Complete timeline of all user actions |
| Fraud alerts table | Automated suspicious activity detection |
| Admin dashboard | User lookup, ticket management, dispute review, fraud review |

### Support Infrastructure

| Channel | Response Time |
|---------|--------------|
| In-app support tickets | < 24 hours |
| Email (support@yuto.social) | < 24 hours |
| Dispute resolution | Counterparty has 7 days to respond |

### Incident Response

| Scenario | Response |
|----------|----------|
| Suspected fraud | Wallet auto-locked after 3 failed PINs; admin reviews fraud alerts |
| Unauthorized access | User locks wallet immediately; admin can investigate via audit log |
| System outage | Offline BLE transfers continue working; sync when online |
| Failed withdrawal | Automatic refund via `refund_failed_withdrawal` RPC |
| Disputed transaction | 7-day dispute window; counterparty approve/deny; admin escalation |

---

## 9. Volume & Financial Projections

**Current status: Pre-launch.** We have not yet gone live publicly. These are conservative estimates based on our target demographic (university students in Nairobi, 18–30 age group). Actual volume will start at zero and grow organically.

### Projected Transaction Patterns (Post-Launch)

| Metric | Month 1 | Month 3 | Month 6 |
|--------|---------|---------|---------|
| Active users | 50–200 | 500–1,000 | 2,000–5,000 |
| Monthly top-ups (inflow) | KSH 100K–500K | KSH 1M–5M | KSH 5M–20M |
| Monthly withdrawals (outflow) | KSH 50K–250K | KSH 500K–2.5M | KSH 2.5M–10M |
| Net retention (float) | 50–60% | 50–60% | 50–60% |
| Average top-up | KSH 200–500 | KSH 300–700 | KSH 500–1,000 |
| Average P2P transfer | KSH 100–500 | KSH 200–800 | KSH 300–1,500 |
| Average withdrawal | KSH 300–800 | KSH 500–1,500 | KSH 1,000–3,000 |

**These are estimates only.** We are happy to start with volume caps or a probationary period if that helps the approval process. We are also open to manual settlement initially while we prove our transaction patterns, transitioning to instant settlement once IntaSend is comfortable with our volume and risk profile.

### Why Net Retention Is High

Users keep money in their Yuto wallet because:
- They use it for P2P transfers to friends (internal, no withdrawal needed)
- They use it for splits, events, and purchases (internal)
- Withdrawal has a KSH 40 fee — incentivizes keeping balance for future use
- The app is designed for frequent small transactions, not large cash-outs

**This means:** At any given time, IntaSend holds more in collected funds than is being requested for withdrawal. The float is always positive.

---

## 10. Revenue Model

| Revenue Stream | Amount | When |
|---------------|--------|------|
| Withdrawal fee | KSH 40 per withdrawal | User cashes out to M-PESA |
| Top-up fee rebate | 1% of top-up amount credited as "transfer credits" | User tops up (we absorb the fee, rebate as credits) |
| Creator commissions | % of attributed user top-ups | Creator's referred users top up |
| Event/storefront fees | Future: small % on commerce transactions | When commerce volume grows |

**Note:** P2P transfers are FREE. We do not charge for sending money between users. This is intentional — it drives adoption and keeps money in the ecosystem.

---

## 11. Summary: Why Approve Instant Settlement for Yuto

| Concern | Our Answer |
|---------|-----------|
| "What if users chargeback?" | M-PESA STK push requires user's own PIN. No chargeback mechanism exists. |
| "What if someone launders money?" | KYC tiers limit unverified users to KSH 5K/day. Withdrawals go to same phone that deposited. Closed loop. |
| "What if there's fraud?" | Transaction PIN, wallet lock, HMAC-signed BLE, automated fraud alerts, 1-hour offline expiry, admin dashboard. |
| "What if users dispute?" | Built-in dispute system with 7-day window, counterparty approve/deny, atomic reversal. |
| "What if you go negative?" | Impossible. Users can only spend what they've deposited. No credit. Float is always positive. |
| "What's your volume?" | Starting small (KSH 100K–500K/month). University students sending KSH 200–2,000. Not high-value corporate. |
| "Are you compliant?" | Operating under IntaSend's PSP license. Privacy policy, ToS, data protection, audit trail all in place. |
| "What if the system is hacked?" | Server-side enforcement (PostgreSQL SECURITY DEFINER), HMAC signatures, bcrypt hashing, RLS, Sentry monitoring. |
| "Can you handle disputes without us?" | Yes. Our dispute system is self-contained. Users resolve between themselves. Admin escalation for denials. |
| "What's your chargeback rate?" | Expected: 0%. M-PESA STK push has no consumer chargeback mechanism. |

---

## 12. What We Need

**One thing:** When our webhook receives `state: "COMPLETE"` for an M-PESA STK push collection, the funds should be immediately available in our IntaSend wallet balance.

**That's it.** Everything else — the internal ledger, P2P transfers, disputes, fraud detection, withdrawals — we handle entirely on our side.

---

## 13. Available for Review

We can provide any of the following immediately upon request:

- [ ] Live APK/IPA for testing
- [ ] Full app walkthrough (video or live call)
- [ ] Database schema documentation
- [ ] API endpoint documentation
- [ ] Security architecture diagram
- [ ] Source code access (GitHub)
- [ ] Privacy policy: https://yuto.social/privacy
- [ ] Terms of Service: https://yuto.social/terms
- [ ] Live demo with test transactions

**Contact:** support@yuto.social | Available for a call at any time.

---

*Prepared for the IntaSend Finance/Underwriting team. This document provides complete transparency into Yuto's payment architecture, risk controls, fraud prevention, dispute resolution, compliance posture, and business model to facilitate the instant settlement approval decision.*
