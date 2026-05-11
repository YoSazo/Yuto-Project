# YUTO — LLM Context File

## What Yuto Is
Social-fintech PWA for Kenyan youth. Replaces WhatsApp groups + M-PESA screenshots with:
- **Functions** — ticketed social events (parties, hangouts)
- **Splits** — group money collection (chamas, shared expenses)
- **Storefronts** — sell items or offer services
- **Wallets** — instant settlement via M-PESA

## Tech Stack
- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS v4 + React Router v7
- **Backend:** Supabase (auth, DB, storage, realtime) + Vercel serverless functions
- **Payments:** IntaSend (M-PESA STK push collections + B2C payouts)
- **Analytics:** PostHog (session replays + funnel events)
- **Push:** web-push (VAPID)

## File Structure
```
src/
├── lib/supabase.ts      # ALL database operations (1500+ lines)
├── lib/analytics.ts     # PostHog events
├── pages/               # Route components
├── components/          # Shared UI
├── contexts/            # AuthContext, ThemeContext
├── hooks/               # useAppResume, usePullToRefresh, etc.
api/                     # Vercel serverless (money endpoints)
├── _auth.ts             # Shared auth helper (getAuthenticatedUserId)
├── charge.ts            # M-PESA STK push (top-up + invoices)
├── webhook.ts           # IntaSend payment webhooks
├── withdraw.ts          # B2C withdrawal
├── payout.ts            # Split payout to M-PESA/Till/Paybill
├── cancel-function.ts   # Cancel event + refund attendees
├── share-function.ts    # OG meta tags for WhatsApp previews
├── share-plan.ts        # OG meta tags for plan sharing
supabase/migrations/     # SQL that defines RPCs, RLS, tables
```

## Critical Conventions

### Money
- **Balance lives in `wallets` table ONLY.** Never read/write `profiles.balance` in new code.
- **All money RPCs are `SECURITY DEFINER`.** Client cannot bypass them.
- **Every credit has a corresponding debit.** Cancel = reverse BOTH sides.
- **Idempotency:** RPCs check `has_paid`, `status != 'pending'`, etc. before moving money.
- **Client sends `Math.round(amount)` for all RPC calls** (avoids integer/numeric ambiguity).

### Listing Sentinels
- `location = '__SELL__'` → marketplace listing
- `location = '__SERVICE__'` → service booking
- Regular location string → event function

### Auth
- Username-based auth (email = `username@yuto.app`)
- All API endpoints require `Authorization: Bearer <token>` via `authFetch()`
- `api/_auth.ts` verifies the token server-side
- Dev user ID: `f5f5da38-c839-4ce4-94fc-10f3854674e0`
- Signup gate: `?key=yuto2026` in URL enables signups

### Sharing / Viral
- Share URLs: `/f/:id` (functions), `/p/:id` (plans), `/i/:username` (invites)
- These serve OG HTML → redirect to SPA routes `/function/:id`, `/plan/:id`, `/invite/:username`
- All share buttons prefer WhatsApp (`wa.me/?text=...`) with pre-filled messages

### Realtime
- HomeScreen debounces feed reloads (1.5s)
- YutoGroupScreen listens for UPDATE + DELETE on group_members
- Split chat sheet has its own realtime channel
- Unread counts tracked via `*_reads` tables (dm_reads, plan_reads, function_reads, group_chat_reads)

### Dark Mode
- Class-based: `.dark` on `<html>` element
- Every component must have `dark:` variants
- Pattern: `bg-white dark:bg-zinc-900`, `text-black dark:text-white`, `border-gray-100 dark:border-zinc-800`

### UI Patterns
- Modals: `fixed inset-0 z-50 fade-in` + `modal-slide-up`
- Buttons: `tap-scale` class for press feedback
- Confirmations: use `<ConfirmModal>` component, never `window.confirm()`
- Loading: spinner with `border-black dark:border-white border-t-transparent`

## Common Gotchas
- ESM imports in `api/` need `.js` extension: `from "./_auth.js"`
- `supabase.ts` exports `authFetch()` — use it for ALL `/api/*` calls
- `function_members` has `ON CONFLICT (function_id, user_id)` — always upsert
- Vercel rewrites: `/f/:id` → API (OG), `/function/:id` → SPA (app route)
- Mascot image: use `../assets/yuto-mascot.webp` (80KB), NOT the old PNG (1.4MB)
- `HostedFunctionItem` includes `status` field — don't cast with `as any`

## Ship Checklist
Before finishing any feature:
- [ ] RLS policies added/verified?
- [ ] Migration saved in `supabase/migrations/`?
- [ ] Function signature added to `supabase.ts`?
- [ ] Is the new RPC `SECURITY DEFINER`?
- [ ] Dark mode variants on all new UI?
- [ ] `authFetch()` used for API calls?
- [ ] Amount passed as `Math.round()` to RPCs?
- [ ] Cancellation reverses BOTH sides of the transaction?
