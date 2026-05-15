import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { getAuthenticatedUserId } from "./_auth.js";

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ALLOWED_CLIENT_EVENTS = ["login", "logout", "pin_failed"];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const userId = await getAuthenticatedUserId(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { event_type, metadata, device_info } = req.body;

  if (!event_type || !ALLOWED_CLIENT_EVENTS.includes(event_type)) {
    return res.status(400).json({ error: "Invalid event type" });
  }

  try {
    await supabase.rpc("log_audit_event", {
      p_user_id: userId,
      p_event_type: event_type,
      p_metadata: metadata || {},
      p_ip_address: (req.headers["x-forwarded-for"] as string) || null,
      p_device_info: device_info || req.headers["user-agent"] || null,
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("[audit] error:", err);
    return res.status(500).json({ error: "Failed to log event" });
  }
}
