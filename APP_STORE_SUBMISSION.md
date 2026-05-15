# Yuto — App Store Connect Submission Guide

Everything you need to fill out in App Store Connect to submit Yuto for iOS review.

---

## App Information

| Field | Value |
|-------|-------|
| App Name | Yuto |
| Subtitle | Send money. No WiFi needed. |
| Bundle ID | social.yuto.app |
| Primary Language | English |
| Primary Category | Finance |
| Secondary Category | Social Networking |
| Content Rights | Does not contain third-party content |

---

## Pricing & Availability

| Field | Value |
|-------|-------|
| Price | Free |
| Availability | Kenya (start here, expand later) |

---

## App Privacy (Nutrition Labels)

When Apple asks "What data do you collect?" — answer these:

### Contact Info
- **Name** — collected, linked to identity, used for App Functionality
- **Phone Number** — collected, linked to identity, used for App Functionality (M-PESA)

### Financial Info
- **Payment Info** — collected, linked to identity, used for App Functionality (M-PESA phone number for top-ups/withdrawals)

### Identifiers
- **User ID** — collected, linked to identity, used for App Functionality

### Usage Data
- **Product Interaction** — collected, linked to identity, used for App Functionality and Analytics

### Other Data
- **Transaction History** — collected, linked to identity, used for App Functionality

### Data NOT collected
- Location (BLE doesn't use location)
- Browsing History
- Search History
- Diagnostics (no crash reporting SDK yet)
- Advertising Data (no ads)

### Tracking
- **No** — Yuto does not track users across other companies' apps/websites

---

## Age Rating Questionnaire

| Question | Answer |
|----------|--------|
| Cartoon or Fantasy Violence | None |
| Realistic Violence | None |
| Sexual Content or Nudity | None |
| Profanity or Crude Humor | None |
| Alcohol, Tobacco, or Drug Use | None |
| Simulated Gambling | None |
| Horror/Fear Themes | None |
| Mature/Suggestive Themes | None |
| Medical/Treatment Information | None |
| Unrestricted Web Access | No |
| Gambling and Contests | No |

**Expected Rating: 4+** (financial apps don't inherently require 17+)

---

## URLs (Required)

| Field | URL |
|-------|-----|
| Privacy Policy URL | https://yuto.social/privacy |
| Support URL | https://yuto.social/terms |
| Marketing URL (optional) | https://yuto.social |

---

## App Review Notes

Copy-paste this into the "Notes for Review" field:

```
═══════════════════════════════════════════════════════════
DEMO ACCOUNT (pre-loaded, ready to test all features)
═══════════════════════════════════════════════════════════

Username: reviewer
Password: Review2024!
Transaction PIN: 1234

This account has KSH 5,000 pre-loaded balance. You can test:
• Viewing balance on Profile and Wallet screens
• Sending money (online transfer from Profile → Send)
• Viewing transaction history (Profile → wallet card → History)
• Locking/unlocking wallet (Profile → Settings → Lock Wallet)
• Changing PIN (Profile → Settings → Change PIN)
• Deleting account (Profile → Settings → Delete Account)

NOTE: Bluetooth proximity transfers require two physical devices
in close range. The BLE radar on the Wallet screen will show
"Get your friend in range to send money" if no other Yuto user
is nearby. This is expected behavior — BLE requires physical
proximity (~10 meters).

NOTE: M-PESA top-up and withdrawal require a Kenyan phone number
registered with Safaricom. The demo account has pre-loaded balance
so you can test all send/receive features without M-PESA.

═══════════════════════════════════════════════════════════
WHAT THIS APP DOES
═══════════════════════════════════════════════════════════

Yuto is a peer-to-peer payment app for Kenyan youth (18+). 
Core features:

1. WALLET: Users top up via M-PESA (Kenyan mobile money) and 
   hold a KES balance in-app.

2. BLUETOOTH TRANSFERS: Users send money to nearby friends via 
   Bluetooth Low Energy — works without internet. The sender's 
   phone transmits a signed transaction payload to the receiver's 
   phone over BLE GATT. Settlement happens server-side when the 
   sender reconnects.

3. ONLINE TRANSFERS: Users send money to friends anywhere 
   (not just nearby) via server-side wallet-to-wallet transfer.

4. BILL SPLITTING: Users create group splits, invite friends, 
   and each person pays their share.

5. EVENTS & COMMERCE: Users host ticketed events, sell products, 
   and offer services — all paid via Yuto wallet.

6. WITHDRAWAL: Users cash out their Yuto balance to M-PESA 
   (real money sent to their phone).

═══════════════════════════════════════════════════════════
GUIDELINE COMPLIANCE — WHY WE DON'T USE IN-APP PURCHASE
═══════════════════════════════════════════════════════════

Yuto is exempt from in-app purchase under TWO guidelines:

• Guideline 3.1.3(d) — Person-to-Person Services: Yuto enables 
  real-time person-to-person money transfers between two 
  individuals. Users send real Kenyan Shillings (KES) to each 
  other — not digital goods, tokens, or virtual currency.

• Guideline 3.1.3(e) — Goods and Services Outside the App: 
  All money in Yuto is real KES that can be withdrawn to M-PESA 
  and spent in the real world. Top-ups come from M-PESA (real 
  bank-linked mobile money). No digital content is purchased.

Additionally per Guideline 3.2.1(vii) — Monetary Gifts: The 
transfer feature allows users to give monetary gifts where (a) 
the gift is completely optional, and (b) 100% of funds go to 
the receiver. Yuto takes zero commission on P2P transfers.

NO digital goods, virtual currencies, premium content, 
subscriptions, or unlockable features are sold in this app.

═══════════════════════════════════════════════════════════
PAYMENT PROCESSING & LICENSING
═══════════════════════════════════════════════════════════

Payment processor: IntaSend (https://intasend.com)
IntaSend is licensed by the Central Bank of Kenya (CBK) as a 
Payment Service Provider under the National Payment System Act.

How it works:
• Top-up: User enters amount → IntaSend triggers M-PESA STK 
  push to user's phone → user confirms with M-PESA PIN → 
  IntaSend webhook confirms payment → Yuto credits wallet.
• Withdrawal: User requests cash-out → Yuto calls IntaSend 
  B2C API → IntaSend sends KES to user's M-PESA number.

Yuto does NOT hold user funds directly. All money movement is 
processed through IntaSend's licensed infrastructure. Yuto is 
the user-facing application layer (similar to how Cash App uses 
Sutton Bank, or Venmo uses The Bancorp Bank).

Compliance page: https://intasend.com/compliance/

═══════════════════════════════════════════════════════════
BLUETOOTH USAGE JUSTIFICATION
═══════════════════════════════════════════════════════════

Yuto uses Bluetooth Low Energy (BLE) for its core feature: 
proximity-based money transfers without internet.

Why BLE is essential:
• Kenya has areas with poor/no cellular connectivity
• M-PESA requires internet; Yuto's BLE transfers do not
• Users in the same physical location can transact instantly
• This is the app's primary differentiator

How BLE is used:
• ADVERTISING: Device broadcasts a short identifier so nearby 
  Yuto users can discover it (NSBluetoothPeripheralUsageDescription)
• SCANNING: Device scans for nearby Yuto users to show on the 
  proximity radar (NSBluetoothAlwaysUsageDescription)
• DATA TRANSFER: Transaction payload sent via BLE GATT write 
  characteristic when user taps "Send"

Background modes (bluetooth-central, bluetooth-peripheral):
• Required so the app can receive BLE transfers even when not 
  in the foreground (e.g., user has phone in pocket)
• Without background BLE, the receiver would miss incoming 
  transfers unless the app is actively open

BLE is NEVER used for:
• Location tracking
• Advertising/marketing
• Data collection
• Connecting to external hardware

═══════════════════════════════════════════════════════════
SECURITY MEASURES
═══════════════════════════════════════════════════════════

• 4-digit transaction PIN required before any outgoing transfer
• PIN lockout after 3 failed attempts (15-minute cooldown)
• Wallet lock/freeze feature (blocks all outgoing transfers)
• HMAC-SHA256 signed BLE payloads (prevents forgery)
• Per-transaction amount limit: KSH 50,000
• Daily cumulative limit: KSH 150,000
• Offline transaction expiry: 1 hour
• Server-side enforcement via SECURITY DEFINER PostgreSQL RPCs
• Audit event logging for all security-relevant actions

═══════════════════════════════════════════════════════════
ACCOUNT DELETION (Guideline 5.1.1v)
═══════════════════════════════════════════════════════════

Location: Profile → scroll to bottom → "Delete Account"
Flow: User taps → confirmation modal with warning → confirms → 
account permanently deleted (auth user, profile, wallet, 
transactions, all associated data removed).

═══════════════════════════════════════════════════════════
PRIVACY POLICY (Guideline 5.1.1i)
═══════════════════════════════════════════════════════════

In-app: Accessible from Profile → Terms & Privacy, and linked 
from the sign-up screen.
URL: https://yuto.social/privacy

═══════════════════════════════════════════════════════════
USER-GENERATED CONTENT MODERATION (Guideline 1.2)
═══════════════════════════════════════════════════════════

Yuto includes group chats and public posts. Moderation:
• Block users: Profile → user profile → Block
• Report users: Profile → user profile → Report
• Report content: Long-press message → Report
• Contact: support@yuto.social (in-app via Help & Support)
• Timely response: We monitor reports and respond within 24h

═══════════════════════════════════════════════════════════
TESTING WALKTHROUGH
═══════════════════════════════════════════════════════════

1. Log in with demo account (reviewer / Review2024!)
2. You'll land on the Home screen — tap the Wallet tab
3. Wallet shows KSH 5,000 balance and BLE proximity radar
4. Go to Profile tab — see wallet card with balance
5. Tap "History" to see transaction history
6. Tap "Send" to see the online send flow (requires PIN: 1234)
7. Scroll down in Profile to see Settings:
   - Help & Support (opens email to support@yuto.social)
   - Terms & Privacy (opens Terms of Service page)
   - Log Out
   - Delete Account
8. The BLE radar on Wallet will show scanning animation but 
   won't find nearby users unless another Yuto device is present
```

---

## Screenshots Needed

You need screenshots for these device sizes:
- iPhone 6.7" (iPhone 15 Pro Max) — **required**
- iPhone 6.5" (iPhone 11 Pro Max) — required if supporting older devices
- iPad Pro 12.9" — only if you support iPad

### Recommended screenshots (in order):
1. **Wallet screen** — showing balance and BLE radar with nearby users
2. **BLE send flow** — tapping a nearby user, entering amount
3. **Profile screen** — showing wallet card with balance
4. **Split screen** — creating a split with friends
5. **Transaction history** — showing past transfers
6. **Function/Event** — showing an event listing

**Tips:**
- Show the app IN USE (not splash screen or login)
- Use realistic data (not "Test User" or "$0.00")
- Dark mode screenshots look great for finance apps

---

## App Description

Copy-paste for the App Store description:

```
Yuto — the social payment app for Kenyan youth 🇰🇪

Send money to friends nearby using Bluetooth — no WiFi, no data, no fees. Works even when you're completely offline.

💸 SEND MONEY INSTANTLY
• Tap a friend on the radar to send KSH via Bluetooth
• Works offline — settles automatically when you're back online
• Zero fees for proximity transfers

📱 M-PESA INTEGRATION
• Top up your Yuto wallet via M-PESA STK push
• Withdraw to M-PESA anytime
• Powered by IntaSend (CBK-licensed)

👥 SPLIT BILLS
• Create splits for rides, meals, rent — anything
• Friends pay their share directly in-app
• Track who's paid and who hasn't

🎉 HOST EVENTS & SELL
• Create ticketed events with instant payment
• Run a storefront or offer services
• Get paid directly to your Yuto wallet

🔒 SECURE
• 4-digit transaction PIN required for all sends
• Lock your wallet instantly if your phone is lost
• HMAC-signed Bluetooth transfers prevent forgery
• Daily transfer limits protect against fraud

Built for Kenya. Built for youth. Built to work without WiFi.
```

---

## Keywords (100 characters max)

```
mpesa,send money,split bills,bluetooth,payment,kenya,p2p,wallet,transfer,offline
```

---

## What's New (for first version)

```
First release! Send money to nearby friends via Bluetooth, top up with M-PESA, split bills, and more.
```

---

## Before You Submit Checklist

- [ ] Create the demo account (username: reviewer, password: Review2024!) with KSH 5,000 balance
- [ ] Verify https://yuto.social/privacy loads correctly
- [ ] Verify https://yuto.social/terms loads correctly
- [ ] Take screenshots on a real device (or simulator)
- [ ] Fill out App Privacy nutrition labels (see above)
- [ ] Answer age rating questionnaire (see above)
- [ ] Set availability to Kenya
- [ ] Upload app icon (1024x1024, no transparency, no rounded corners — Apple rounds them)
- [ ] Make sure the build number is incremented from any previous TestFlight builds
- [ ] Run the SQL migrations on your production Supabase database
- [ ] Verify the Vercel API endpoints are deployed (set-pin, verify-pin, audit, delete-account, notify)
- [ ] Test the full flow on a real device: sign up → top up → send via BLE → withdraw

---

## Common Rejection Reasons & How We've Handled Them

| Rejection Reason | Our Solution |
|-----------------|--------------|
| No account deletion (5.1.1v) | ✅ Profile → Delete Account |
| No privacy policy (5.1.1i) | ✅ /privacy page + linked from signup |
| Missing usage descriptions | ✅ BLE, Camera, Photos in Info.plist |
| App requires IAP for payments | ✅ Exempt under 3.1.3(d) and 3.1.3(e) — real money P2P |
| No demo account provided | ⚠️ YOU must create this before submitting |
| No support contact | ✅ Help & Support menu → support@yuto.social |
| UGC without moderation | ✅ Block + Report functionality exists |
| BLE without purpose string | ✅ NSBluetoothAlwaysUsageDescription set |
| Background modes unjustified | ✅ BLE peripheral/central for proximity payments |

---

## Notes

- Your Apple Developer account should ideally be registered as an **Organization** (not Individual) since you're handling financial transactions. If it's currently Individual, you can still submit but Apple may ask you to switch later.
- IntaSend handles the regulatory compliance (CBK licensing) for the actual money movement. Mention this in review notes.
- If Apple asks for additional documentation about your payment processing, provide IntaSend's compliance page: https://intasend.com/compliance/
