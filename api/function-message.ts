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
      `Missing Supabase env in function-message: ${missing.join(", ")}. Use service role key (not anon) for server-side.`,
    );
  }

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const { function_id, user_id, content } = req.body ?? {};

  if (!function_id || !user_id || !content?.trim()) {
    return res.status(400).json({ success: false, message: "Missing required fields" });
  }

  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from("function_messages").insert({
      function_id,
      user_id,
      content: content.trim(),
    });

    if (error) {
      console.error("function-message insert error:", error);
      return res.status(400).json({
        success: false,
        message: error.message || "Couldn't send message. Try again.",
      });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("function-message handler error:", err);
    return res.status(500).json({ success: false, message });
  }
}
