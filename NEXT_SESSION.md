# Next Session — Pick Up Here

Read `CLAUDE.md` first for full context. Then build these:

## 1. Referral Landing Page (`/r/:username`)

Like the function/plan landing pages but for referrals. When someone clicks a referral link:
- Non-user sees: "[Friend's name] is about to earn KSH 10 from you joining 😏"
- Shows what Yuto is (split, host, sell)
- CTA: "Sign up — and you can earn KSH 10 too by inviting YOUR friends"
- The messaging should make it feel like a game/challenge, not a boring referral
- After signup, redirect them to Profile > Earnings tab so they immediately see how to earn too

**Route:** `/r/:username` → Vercel rewrite to `api/share-referral` (OG tags) → SPA `/invite/:username`
**Update the WhatsApp share message** in EarningsTab to use this new URL

## 2. Referral User List in Earnings Tab

The Referrals section currently shows count + total earned. Add:
- List of referred users (avatar, name, @username, "+KSH 10" badge next to each)
- Show which ones have converted (topped up) vs pending
- Make it feel like a leaderboard / collection

## 3. Creator Landing Page

When a creator shares their link to recruit OTHER creators:
- Different messaging: "Join the Yuto Creator program"
- Shows the economics: 70% → 100%, passive income from recruits
- "Apply now" CTA
- This is separate from the regular referral page

## 4. More Viral Ideas to Implement

- **Milestone celebrations:** When a creator hits 10, 25, 50, 100 users — confetti + push notification + shareable achievement card they can post to WhatsApp Status
- **Leaderboard:** Top 10 creators by users brought (anonymous or public — user's choice). Creates competition.
- **"Your network" visualization:** Show the creator their tree (them → their users, them → recruited creators → their users). Makes the exponential visible.
- **Auto-prompt after every action:** After someone joins a function, pays a split, or buys something — show a subtle "Invite a friend, earn KSH 10" banner for 3 seconds
- **Referral streak:** "You've referred 3 friends this week! 2 more for a bonus KSH 50" — gamification layer

## 5. WhatsApp Number

The "Apply to become a Creator" button should DM: `+1 612 471 3785` (already set)

## 6. The 70% → 100% Mechanic

Currently the EarningsTab shows the progress bar but doesn't actually check if the creator has recruited someone. Need to:
- Query `creators` table for any row where `recruited_by = this_creator_id`
- If found, show 100% instead of 70%
- Update the `process_creator_commission` RPC to give 100% to creators who have recruited (instead of 70%)

## Current State

- `supabase/migrations/20260511_feat_creator_earnings.sql` — full SQL (tables + RPCs)
- `src/components/profile/EarningsTab.tsx` — full UI (referrals + creator sections)
- `api/webhook.ts` — calls `process_creator_commission` on every top-up
- `api/withdraw.ts` — calls `process_creator_commission` on every withdrawal
- `src/lib/supabase.ts` signup — calls `attribute_user_to_creator` on signup
- ProfileScreen has "Profile | Earnings" toggle at the top

## LOCAL_PREVIEW Flag

Set `LOCAL_PREVIEW = true` in `EarningsTab.tsx` line 7 to see dummy data without running the SQL migration. Set back to `false` before deploying.
