import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const INTASEND_BASE = process.env.INTASEND_HOST || "https://sandbox.intasend.com";

function getSupabaseClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    const missing = [
      !SUPABASE_URL && "SUPABASE_URL or VITE_SUPABASE_URL",
      !SUPABASE_SERVICE_ROLE_KEY && "SUPABASE_SERVICE_ROLE_KEY",
    ].filter(Boolean);
    throw new Error(
      `Missing Supabase env in webhook: ${missing.join(", ")}. Use service role key (not anon) for server-side.`,
    );
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

const REFERRAL_BONUS_KES = 10;

async function creditWalletBalance(supabase: ReturnType<typeof createClient>, userId: string, amountKes: number) {
  // Avoid `topup_balance` RPC: some DBs have an enum mismatch (`transaction_type` missing "topup") which breaks credits.
  if (!Number.isFinite(amountKes) || amountKes <= 0) return { ok: false as const, reason: "invalid_amount" as const };

  for (let attempt = 0; attempt < 4; attempt++) {
    const { data: w, error: readErr } = await supabase
      .from("wallets")
      .select("id, balance")
      .eq("user_id", userId)
      .maybeSingle();

    if (readErr) {
      console.error("[webhook] wallets read error:", readErr);
      return { ok: false as const, reason: "read_error" as const };
    }

    const current = Number(w?.balance ?? 0) || 0;
    const next = current + amountKes;

    if (!w?.id) {
      const { error: insertErr } = await supabase.from("wallets").insert({ user_id: userId, balance: next });
      if (!insertErr) return { ok: true as const, previous: 0, next };
      console.error("[webhook] wallets insert error (retrying):", insertErr);
      continue;
    }

    const { error: updateErr } = await supabase
      .from("wallets")
      .update({ balance: next })
      .eq("id", w.id)
      // optimistic concurrency: retry if balance changed between read & write
      .eq("balance", w.balance as any);

    if (!updateErr) return { ok: true as const, previous: current, next };

    console.error("[webhook] wallets update error (retrying):", updateErr);
  }

  return { ok: false as const, reason: "retry_exhausted" as const };
}

function extractKesAmount(payload: Record<string, unknown>): number {
  const candidates: unknown[] = [
    payload.value,
    payload.amount,
    (payload.invoice as any)?.value,
    (payload.invoice as any)?.amount,
    (payload.data as any)?.value,
    (payload.data as any)?.amount,
    payload.net_amount,
  ];
  for (const v of candidates) {
    const n = typeof v === "string" ? Number(v.replace(/,/g, "")) : Number(v);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}

async function fetchAmountFromStatus(invoiceId: string): Promise<number> {
  try {
    const res = await fetch(`${INTASEND_BASE}/api/v1/payment/status/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.INTASEND_SECRET_KEY!}`,
      },
      body: JSON.stringify({ invoice_id: invoiceId }),
    });
    const data = (await res.json()) as any;
    if (!res.ok) return 0;
    const n = Number(data?.invoice?.value ?? data?.invoice?.amount ?? 0);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

async function maybeConvertReferralOnFirstTopUp(supabase: ReturnType<typeof createClient>, referredUserId: string) {
  // If this user has a referral row and it hasn't converted yet, convert it and credit the referrer once.
  const { data: ref, error } = await supabase
    .from("referrals")
    .select("id, referrer_id, referred_id, converted")
    .eq("referred_id", referredUserId)
    .maybeSingle();

  if (error) {
    console.error("[webhook] referral lookup error:", error);
    return;
  }
  if (!ref || ref.converted) return;

  try {
    // Credit referrer wallet
    const credited = await creditWalletBalance(supabase, ref.referrer_id, REFERRAL_BONUS_KES);
    if (!credited.ok) {
      console.error("[webhook] referral bonus credit failed:", credited);
      return;
    }
    // Mark referral converted
    await supabase.from("referrals").update({ converted: true }).eq("id", ref.id);
    // Ledger entry (best-effort; some DBs use an enum for type)
    const { error: txErr } = await supabase.from("transactions").insert({
      user_id: ref.referrer_id,
      amount: REFERRAL_BONUS_KES,
      type: "deposit",
      description: `Referral bonus (+KSH ${REFERRAL_BONUS_KES})`,
    });
    if (txErr) console.error("[webhook] referral_bonus transaction insert error:", txErr);
  } catch (e) {
    console.error("[webhook] referral convert/credit error:", e);
  }
}

async function processIntaSendWebhook(payload: {
  invoice_id?: string;
  state?: string;
  currency?: string;
  api_ref?: string;
  provider?: string;
  [key: string]: unknown;
}) {
  const state = payload.state;
  if (String(payload.currency || "").toUpperCase() !== "KES") return;
  if (state !== "COMPLETE") {
    // Helpful diagnostics for FAILED / PENDING / PROCESSING, etc.
    const reason =
      (payload as any).failed_reason ??
      (payload as any).failedReason ??
      (payload as any).reason ??
      (payload as any).message ??
      (payload as any).detail ??
      null;
    const code =
      (payload as any).failed_code ??
      (payload as any).failedCode ??
      (payload as any).code ??
      null;
    console.log("[webhook] non-complete event:", JSON.stringify({
      state,
      invoice_id: payload.invoice_id,
      api_ref: payload.api_ref,
      provider: payload.provider,
      code,
      reason,
    }));
    return;
  }

  const supabase = getSupabaseClient();

  const apiref = (payload.api_ref as string) ?? "";
  if (apiref.startsWith("TOPUP")) {
    // apiref format: "TOPUP" (5 chars) + 32 hex user id + numeric timestamp (charge.ts)
    const raw = apiref.slice(5, 37);
    if (!/^[a-f0-9]{32}$/i.test(raw)) {
      console.error("[webhook] Invalid TOPUP api_ref (expected 32 hex chars after TOPUP)", apiref);
      return;
    }
    const uid = `${raw.slice(0,8)}-${raw.slice(8,12)}-${raw.slice(12,16)}-${raw.slice(16,20)}-${raw.slice(20)}`;
    let amount = extractKesAmount(payload as any);
    if (!amount && payload.invoice_id) {
      amount = await fetchAmountFromStatus(String(payload.invoice_id));
    }
    if (amount > 0) {
      const credited = await creditWalletBalance(supabase, uid, amount);
      if (!credited.ok) {
        console.error("[webhook] wallet credit failed:", credited);
        return;
      }
      // Ledger entry for wallet history (best-effort; enum-safe)
      const { error: topupTxErr } = await supabase.from("transactions").insert({
        user_id: uid,
        amount,
        type: "deposit",
        description: `Top up (+KSH ${Math.round(amount)})`,
      });
      if (topupTxErr) console.error("[webhook] topup transaction insert error:", topupTxErr);
      // If this is their first ever top-up conversion, reward referrer.
      await maybeConvertReferralOnFirstTopUp(supabase, uid);
    } else {
      console.error("[webhook] TOPUP amount missing/zero:", {
        invoice_id: payload.invoice_id,
        api_ref: apiref,
        keys: Object.keys(payload),
      });
    }
    return;

  }

  let membershipTable: "group_members" | "function_members" | null = null;
  let parentTable: "groups" | "functions" | null = null;
  let parentIdColumn: "group_id" | "function_id" | null = null;
  let groupId: string | null = null;
  let userId: string | null = null;

  const membershipTables: Array<{
    table: "group_members" | "function_members";
    idColumn: "group_id" | "function_id";
  }> = [
    { table: "group_members", idColumn: "group_id" },
    { table: "function_members", idColumn: "function_id" },
  ];

  for (const entry of membershipTables) {
    if (groupId && userId) break;

    if (payload.invoice_id) {
      const { data: match, error: matchError } = await supabase
        .from(entry.table)
        .select(`${entry.idColumn}, user_id`)
        .eq("payment_invoice_id", payload.invoice_id)
        .maybeSingle();
      if (matchError) throw matchError;
      if (match) {
        membershipTable = entry.table;
        parentTable = entry.table === "group_members" ? "groups" : "functions";
        parentIdColumn = entry.idColumn;
        groupId = match[entry.idColumn] as string;
        userId = match.user_id;
        break;
      }
    }

    if (payload.api_ref) {
      const { data: match, error: matchError } = await supabase
        .from(entry.table)
        .select(`${entry.idColumn}, user_id`)
        .eq("payment_api_ref", payload.api_ref)
        .maybeSingle();
      if (matchError) throw matchError;
      if (match) {
        membershipTable = entry.table;
        parentTable = entry.table === "group_members" ? "groups" : "functions";
        parentIdColumn = entry.idColumn;
        groupId = match[entry.idColumn] as string;
        userId = match.user_id;
        break;
      }
    }
  }

  if (!membershipTable || !parentTable || !parentIdColumn || !groupId || !userId) {
    throw new Error(
      `Could not resolve membership for invoice_id=${payload.invoice_id} api_ref=${payload.api_ref}`,
    );
  }

  const { error: updateError } = await supabase
    .from(membershipTable)
    .update({ has_paid: true, paid_at: new Date().toISOString() })
    .eq(parentIdColumn, groupId)
    .eq("user_id", userId);

  if (updateError) throw updateError;
  console.log(
    `Webhook: set has_paid=true for ${membershipTable} parent_id=${groupId} user_id=${userId}`,
  );

  const { data: members, error: membersError } = await supabase
    .from(membershipTable)
    .select("has_paid")
    .eq(parentIdColumn, groupId);

  if (membersError) throw membersError;

  if (members?.length && members.every((m) => m.has_paid)) {
    const nextStatus = parentTable === "functions" ? "funded" : "completed";
    const { error: groupError } = await supabase
      .from(parentTable)
      .update({ status: nextStatus })
      .eq("id", groupId);
    if (groupError) throw groupError;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const payload = req.body as {
      invoice_id?: string;
      state?: string;
      currency?: string;
      api_ref?: string;
      provider?: string;
      [key: string]: unknown;
    };

    console.log(
      "IntaSend webhook received:",
      JSON.stringify({
        state: payload.state,
        currency: payload.currency,
        invoice_id: payload.invoice_id,
        api_ref: payload.api_ref,
      }),
    );

    try {
      await processIntaSendWebhook(payload);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const cause = err instanceof Error && err.cause ? String(err.cause) : "";
      console.error("Webhook processing error:", msg, cause || "", err);
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Webhook handler error:", err);
    return res.status(200).json({ ok: true });
  }
}