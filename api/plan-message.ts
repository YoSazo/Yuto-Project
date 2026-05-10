import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { getAuthenticatedUserId } from "./_auth";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { plan_id, user_id, content } = req.body;
  if (!plan_id || !user_id || !content?.trim()) {
    return res.status(400).json({ success: false, message: "Missing fields" });
  }

  // Auth: verify the caller is the user they claim to be
  const authUserId = await getAuthenticatedUserId(req);
  if (!authUserId || authUserId !== user_id) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ success: false, message: "Server config error" });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { error } = await supabase
    .from("plan_messages")
    .insert({ plan_id, user_id, content: content.trim() });

  if (error) {
    console.error("plan-message insert error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }

  return res.status(200).json({ success: true });
}
