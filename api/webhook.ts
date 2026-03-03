import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

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
  if (payload.state !== "COMPLETE" || payload.currency !== "KES") return;

  if (!payload.api_ref) throw new Error("Missing api_ref");

  // 3) Parse api_ref: yuto__{groupId}__{userId}__{timestamp}
  const parts = payload.api_ref.split("__");
  if (parts.length < 3 || parts[0] !== "yuto") {
    throw new Error("Invalid api_ref format");
  }

  const groupId = parts[1];
  const userId = parts[2];

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error: updateError } = await supabase
    .from("group_members")
    .update({ has_paid: true, paid_at: new Date().toISOString() })
    .eq("group_id", groupId)
    .eq("user_id", userId);

  if (updateError) throw updateError;

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
    if (!payload.challenge || payload.challenge !== process.env.INTASEND_WEBHOOK_SECRET) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Respond immediately to prevent IntaSend timeouts/retries.
    res.status(200).json({ ok: true });

    // Do the DB work after responding (best-effort).
    console.log(
      "IntaSend webhook received:",
      JSON.stringify({ state: payload.state, currency: payload.currency, invoice_id: payload.invoice_id })
    );

    void processIntaSendWebhook(payload).catch((err) => {
      console.error("Webhook processing error:", err);
    });

    return;
  } catch (err) {
    console.error("Webhook handler error:", err);
    // Always return a response even if something unexpected happens.
    return res.status(200).json({ ok: true });
  }
}
