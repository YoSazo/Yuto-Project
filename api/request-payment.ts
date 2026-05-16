import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { getAuthenticatedUserId } from "./_auth.js";
import webpush from "web-push";

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env vars");
  return createClient(url, key);
}

function initWebPush() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails("mailto:support@yuto.app", publicKey, privateKey);
  return true;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const supabase = getSupabase();

  // Authenticate the requester
  const authUserId = await getAuthenticatedUserId(req, supabase);
  if (!authUserId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { requester_id, target_id, amount, description } = req.body as {
    requester_id: string;
    target_id: string;
    amount: number;
    description?: string;
  };

  // Validate: requester must be the authenticated user
  if (requester_id !== authUserId) {
    return res.status(403).json({ error: "Requester must be the authenticated user" });
  }

  if (!target_id || !amount || amount <= 0) {
    return res.status(400).json({ error: "Missing target_id or invalid amount" });
  }

  // Get requester's display name
  const { data: requesterProfile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", requester_id)
    .single();

  const requesterName = requesterProfile?.display_name || "Someone";

  // Insert a notification for the target user
  try {
    await supabase.from("notifications").insert({
      user_id: target_id,
      actor_id: requester_id,
      type: "payment_request",
      title: `${requesterName} is requesting KSH ${amount.toLocaleString("en-KE")}`,
      body: description || `Tap to pay ${requesterName} KSH ${amount.toLocaleString("en-KE")}`,
      reference_kind: "user",
      reference_id: requester_id,
      amount_kes: amount,
      cta_label: "Pay now",
      cta_action: `/wallet`,
    });
  } catch (e) {
    console.error("[request-payment] notification insert error:", e);
  }

  // Send push notification
  try {
    if (initWebPush()) {
      const { data: tokenRow } = await supabase
        .from("push_tokens")
        .select("token")
        .eq("user_id", target_id)
        .maybeSingle();

      if (tokenRow?.token) {
        const subscription = JSON.parse(tokenRow.token);
        await webpush.sendNotification(
          subscription,
          JSON.stringify({
            title: `${requesterName} is requesting money`,
            body: `KSH ${amount.toLocaleString("en-KE")} — tap to pay`,
          })
        );
      }
    }
  } catch (e) {
    console.error("[request-payment] push error:", e);
  }

  return res.status(200).json({ success: true, message: "Request sent" });
}
