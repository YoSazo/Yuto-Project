import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

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
    await supabase.rpc("topup_balance", { p_user_id: ref.referrer_id, p_amount: REFERRAL_BONUS_KES });
    // Mark referral converted
    await supabase.from("referrals").update({ converted: true }).eq("id", ref.id);
    // Ledger entry (shows up in wallet history)
    await supabase.from("transactions").insert({
      user_id: ref.referrer_id,
      amount: REFERRAL_BONUS_KES,
      type: "referral_bonus",
      description: `Referral bonus (+KSH ${REFERRAL_BONUS_KES})`,
    });
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
  if (payload.currency !== "KES") return;
  if (state !== "COMPLETE") return;

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
    const amount = Number((payload as any).value ?? (payload as any).amount ?? 0);
    if (amount > 0) {
      await supabase.rpc("topup_balance", { p_user_id: uid, p_amount: amount });
      // If this is their first ever top-up conversion, reward referrer.
      await maybeConvertReferralOnFirstTopUp(supabase, uid);
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