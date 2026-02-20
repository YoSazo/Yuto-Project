import type { VercelRequest, VercelResponse } from "@vercel/node";
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

webpush.setVapidDetails(
  "mailto:support@yuto.app",
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { userId, title, body } = req.body;
  if (!userId || !title || !body) return res.status(400).json({ error: "Missing fields" });

  try {
    const { data: tokenRow } = await supabase
      .from("push_tokens")
      .select("token")
      .eq("user_id", userId)
      .single();

    if (!tokenRow?.token) return res.status(200).json({ message: "No token found" });

    const subscription = JSON.parse(tokenRow.token);
    await webpush.sendNotification(subscription, JSON.stringify({ title, body }));

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("Push notification error:", err);
    return res.status(500).json({ error: "Failed to send notification" });
  }
}
