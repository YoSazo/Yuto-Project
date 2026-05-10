import type { VercelRequest, VercelResponse } from "@vercel/node";
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";
import { getAuthenticatedUserId } from "./_auth";

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function initWebPush() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails("mailto:support@yuto.app", publicKey, privateKey);
  return true;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // Auth: require a valid logged-in user (prevents anonymous spam)
  const authUserId = await getAuthenticatedUserId(req);
  if (!authUserId) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  const { userId, title, body } = req.body;
  if (!userId || !title || !body) return res.status(400).json({ error: "Missing fields" });

  if (!initWebPush()) return res.status(200).json({ message: "Push not configured" });

  try {
    const { data: tokenRow } = await supabase
      .from("push_tokens")
      .select("token")
      .eq("user_id", userId)
      .maybeSingle();

    if (!tokenRow?.token) return res.status(200).json({ message: "No token found" });

    const subscription = JSON.parse(tokenRow.token);
    await webpush.sendNotification(subscription, JSON.stringify({ title, body }));

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("Push notification error:", err);
    return res.status(500).json({ error: "Failed to send notification" });
  }
}
