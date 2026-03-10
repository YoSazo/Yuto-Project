import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

// Server-side: use SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in Vercel (VITE_* may not be available in API routes).
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

async function processIntaSendWebhook(payload: {
  invoice_id?: string;
  state?: string;
  currency?: string;
  api_ref?: string;
  challenge?: string;
  provider?: string;
  [key: string]: unknown;
}) {
  // 2) Only process completed KES payments
  const state = payload.state;
  if (payload.currency !== "KES") return;
  if (state !== "COMPLETE") return;

  const supabase = getSupabaseClient();

  let groupId: string | null = null;
  let userId: string | null = null;

  const supabase = getSupabaseClient();

  // Primary: look up by invoice_id — this is always saved to DB by charge.ts
  // before the webhook fires, so it's the most reliable identifier.
  if (payload.invoice_id) {
    const { data: match, error: matchError } = await supabase
      .from("group_members")
      .select("group_id, user_id")
      .eq("payment_invoice_id", payload.invoice_id)
      .maybeSingle();
    if (matchError) throw matchError;
    if (match) {
      groupId = match.group_id;
      userId = match.user_id;
    }
  }

  // Fallback: parse api_ref in the short format yuto-{shortGroupId}-{shortUserId}
  // This is a last resort in case invoice_id wasn't persisted (e.g. Supabase was
  // temporarily unavailable during the charge call).
  if ((!groupId || !userId) && payload.api_ref) {
    const parts = payload.api_ref.split("-");
    if (parts.length >= 3 && parts[0] === "yuto") {
      const shortGroupId = parts[1];
      const shortUserId = parts[2];
      const { data: match } = await supabase
        .from("group_members")
        .select("group_id, user_id")
        .ilike("payment_api_ref", `yuto-${shortGroupId}-${shortUserId}%`)
        .maybeSingle();
      if (match) {
        groupId = match.group_id;
        userId = match.user_id;
      }
    }
  }

  if (!groupId || !userId) {
    throw new Error(
      `Could not resolve group/user for invoice_id=${payload.invoice_id} api_ref=${payload.api_ref}`,
    );
  }

  const { error: updateError } = await supabase
    .from("group_members")
    .update({ has_paid: true, paid_at: new Date().toISOString() })
    .eq("group_id", groupId)
    .eq("user_id", userId);

  if (updateError) throw updateError;
  console.log(
    "Webhook: set has_paid=true for group_id=" + groupId + " user_id=" + userId,
  );

  const { data: members, error: membersError } = await supabase
    .from("group_members")
    .select("has_paid")
    .eq("group_id", groupId);

  if (membersError) throw membersError;

  if (members?.length && members.every((m) => m.has_paid)) {
    const { error: groupError } = await supabase
      .from("groups")
      .update({ status: "completed" })
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
      challenge?: string;
      provider?: string;
      [key: string]: unknown;
    };

    // 1) Verify webhook challenge (body-based; adjust to header if IntaSend sends it there)
    if (
      !payload.challenge ||
      payload.challenge !== process.env.INTASEND_WEBHOOK_SECRET
    ) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    console.log(
      "IntaSend webhook received:",
      JSON.stringify({
        state: payload.state,
        currency: payload.currency,
        invoice_id: payload.invoice_id,
        api_ref: payload.api_ref,
      }),
    );

    // Await DB work BEFORE responding — Vercel terminates the function as soon
    // as the response is sent, so fire-and-forget will never complete.
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
    // Always return a response even if something unexpected happens.
    return res.status(200).json({ ok: true });
  }
}
