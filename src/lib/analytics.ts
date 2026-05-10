import posthog from "posthog-js";

/**
 * PostHog wrapper. Centralizes initialization, identification, and the
 * canonical funnel events so we have one source of truth for what gets
 * tracked. Session replays are enabled because we need to literally watch
 * users get stuck in the M-PESA flow before we pour ad spend on top.
 *
 * If env keys are missing (e.g. local dev without setup) we no-op silently
 * instead of crashing the app.
 */

const KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const HOST = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) || "https://us.i.posthog.com";

let initialized = false;

export function initAnalytics() {
  if (initialized) return;
  if (!KEY) {
    if (import.meta.env.DEV) {
      console.info("[analytics] VITE_POSTHOG_KEY not set — analytics disabled.");
    }
    return;
  }
  try {
    posthog.init(KEY, {
      api_host: HOST,
      // Session replay: we want the screen recordings to debug UI leaks before
      // scaling ads. Inputs are masked by default for privacy.
      disable_session_recording: false,
      session_recording: {
        maskAllInputs: true,
      },
      capture_pageview: true,
      autocapture: true,
      person_profiles: "identified_only",
      loaded: (ph) => {
        if (import.meta.env.DEV) ph.debug(false);
      },
    });
    initialized = true;
  } catch (err) {
    console.warn("[analytics] init failed:", err);
  }
}

/** Tie a Supabase user id to the current PostHog session. */
export function identifyAnalyticsUser(
  userId: string,
  traits?: { username?: string | null; display_name?: string | null },
) {
  if (!initialized) return;
  try {
    posthog.identify(userId, {
      username: traits?.username || undefined,
      display_name: traits?.display_name || undefined,
    });
  } catch {
    // ignore
  }
}

/** Clear identity on sign-out so replays don't bleed across accounts. */
export function resetAnalyticsUser() {
  if (!initialized) return;
  try {
    posthog.reset();
  } catch {
    // ignore
  }
}

/** Generic event capture (use sparingly — prefer named helpers below). */
export function track(event: string, properties?: Record<string, unknown>) {
  if (!initialized) return;
  try {
    posthog.capture(event, properties);
  } catch {
    // ignore
  }
}

// ─── Canonical funnel events ────────────────────────────────────────────
//
// These are the four moments we agreed mattered for ad spend:
// plan_created → plan_joined → yuto_it_clicked → group_paid_in_full
// Plus a couple of money-flow events that bound the M-PESA experience.

export const analytics = {
  planCreated: (props: { planId: string; amount: number | null; slots: number | null }) =>
    track("plan_created", props),

  planJoined: (props: { planId: string; isCreator: boolean }) =>
    track("plan_joined", props),

  yutoItClicked: (props: { planId: string; memberCount: number; perPerson: number }) =>
    track("yuto_it_clicked", props),

  groupPaidInFull: (props: { groupId: string; memberCount: number; totalKes: number }) =>
    track("group_paid_in_full", props),

  // ─── Function viral loop events ──────────────────────────────────────
  functionCreated: (props: { functionId: string; amountKes: number; hasMedia: boolean }) =>
    track("function_created", props),

  functionJoined: (props: { functionId: string; amountKes: number }) =>
    track("function_joined", props),

  functionTicketViewed: (props: { functionId: string }) =>
    track("function_ticket_viewed", props),

  functionShared: (props: { functionId: string; surface: "ticket" | "card" | "profile" }) =>
    track("function_shared", props),

  functionDuplicated: (props: { functionId: string }) =>
    track("function_duplicated", props),

  functionGroupBuy: (props: { functionId: string; friendCount: number; totalKes: number }) =>
    track("function_group_buy", props),

  // Money flow signals — useful for diagnosing where M-PESA users bail.
  topupStkSent: (props: { amountKes: number; phoneSuffix?: string }) =>
    track("topup_stk_sent", props),
  topupStkCompleted: (props: { amountKes: number }) =>
    track("topup_stk_completed", props),
  topupStkFailed: (props: { amountKes: number; reason?: string }) =>
    track("topup_stk_failed", props),

  walletTransferSent: (props: { amountKes: number; toUserId: string }) =>
    track("wallet_transfer_sent", props),
  walletOfferCreated: (props: { amountKes: number; surface: "dm" | "group" }) =>
    track("wallet_offer_created", props),
  walletOfferAccepted: (props: { amountKes: number }) =>
    track("wallet_offer_accepted", props),
};
