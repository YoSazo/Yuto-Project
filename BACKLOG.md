# Backlog

Add items here as they come up. Format: `- [ ] description (priority: high/med/low)`

## Bugs
- [ ] (none currently known)

## Features — Next Up
- [ ] Post-signup: prompt "Add [referrer] as friend?" (med)
- [ ] Push notification 24h before function date: "X is tomorrow! 18 people going" (high)
- [ ] Connection-aware loading: reduce feed size on 2G (low)
- [ ] Background sync for messages on flaky connections (low)
- [ ] Supabase region check — ensure af-south-1 (high, config only)

## Tech Debt
- [ ] `listMyThreads` → single RPC (12 queries → 1) for faster inbox (high at scale)
- [ ] Webhook signature: verify IntaSend actually sends the header format we check (med)
- [ ] `cancel_listing_dm_charge` for "paid + held" state (no refund path currently) (med)
- [ ] Remove dead `topup_balance` / `refund_payout_balance` RPCs from DB (low)
