import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import { getAuthenticatedUserId } from "./_auth.js";

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const userId = await getAuthenticatedUserId(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { pin } = req.body;
  if (!pin || typeof pin !== "string" || !/^\d{4}$/.test(pin)) {
    return res.status(400).json({ error: "PIN must be exactly 4 digits" });
  }

  try {
    const hash = await bcrypt.hash(pin, 10);

    const { error } = await supabase
      .from("profiles")
      .update({ pin_hash: hash })
      .eq("id", userId);

    if (error) throw error;

    // Log audit event
    await supabase.rpc("log_audit_event", {
      p_user_id: userId,
      p_event_type: "pin_set",
      p_metadata: {},
      p_ip_address: (req.headers["x-forwarded-for"] as string) || null,
      p_device_info: req.headers["user-agent"] || null,
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("[set-pin] error:", err);
    return res.status(500).json({ error: "Failed to set PIN" });
  }
}
