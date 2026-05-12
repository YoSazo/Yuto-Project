import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { getAuthenticatedUserId } from "./_auth.js";
import { verifyPhoneSignupToken } from "./_phoneVerification.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const authUserId = await getAuthenticatedUserId(req);
  if (!authUserId) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  const token = typeof req.body?.verification_token === "string" ? req.body.verification_token : "";
  const payload = verifyPhoneSignupToken(token);
  if (!payload) {
    return res.status(400).json({ error: "Invalid or expired verification. Request a new code." });
  }

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return res.status(500).json({ error: "Server misconfigured" });
  }

  const supabase = createClient(url, key);
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("profiles")
    .update({
      phone_number: payload.phone,
      phone_verified_at: now,
    })
    .eq("id", authUserId);

  if (error) {
    console.error("[phone-attach-verified]", error);
    return res.status(500).json({ error: "Could not save phone number." });
  }

  return res.status(200).json({ success: true });
}
