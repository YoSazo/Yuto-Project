# Architecture Decisions

Non-obvious choices that should not be re-litigated without good reason.

## Money

- **STK pushes always go through top-up modal, never direct to group/function invoice.** Platform always holds float. (May 2026)
- **`has_paid` flip is the canonical payment event.** Never manually toggle in client. Only RPCs set it. (May 2026)
- **Wallet offers do NOT debit on create, only on accept.** Sender's balance is checked at accept time. (May 2026)
- **Cancel = refund members + debit host.** Every cancel reverses both sides. (May 2026)
- **`collected_balance` on groups tracks the payout pool.** Incremented by `pay_for_plan`, decremented by payout/cancel. (May 2026)
- **Withdrawals: amount read from DB transaction row, not client body.** Prevents amount tampering. (May 2026)

## Auth & Security

- **All API endpoints require auth token.** `api/_auth.ts` verifies via `supabase.auth.getUser(token)`. (May 2026)
- **Webhook verifies `INTASEND_WEBHOOK_SECRET`.** Rejects unsigned requests. (May 2026)
- **Wallets table: SELECT-only RLS for authenticated.** All writes via service role / SECURITY DEFINER. (May 2026)
- **`group_members` has no UPDATE policy.** All payment state changes go through RPCs. (May 2026)
- **Signups gated by `?key=yuto2026`.** Remove gate when IntaSend grants instant settlement. (May 2026)

## Product

- **Plan chat and split chat are separate.** Plan chat = pre-money discussion. Split chat = post-money coordination. (May 2026)
- **Functions require date + location.** Enforced in compose sheet validation. (May 2026)
- **Cancelled functions hide ticket button.** Card shows "Cancelled" but no actions. (May 2026)
- **Guest browse mode:** Non-authenticated users can see home, split, activity, profile (read-only). (May 2026)
- **Dev announcements:** Only user `f5f5da38...` can create. Stored in `dev_announcements` table. (May 2026)

## Sharing

- **Share URLs use short paths:** `/f/:id` (functions), `/p/:id` (plans), `/i/:username` (invites). (May 2026)
- **OG pages redirect to SPA routes.** `/f/:id` → API (serves OG HTML) → redirects to `/function/:id` (React). (May 2026)
- **All share buttons default to WhatsApp** with pre-filled messages. Native share as primary, `wa.me` as fallback. (May 2026)
