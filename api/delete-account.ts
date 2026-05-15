import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { getAuthenticatedUserId } from "./_auth.js";

/**
 * Delete Account endpoint — Apple App Store requirement (Guideline 5.1.1).
 * Permanently deletes the user's account and all associated data.
 * Uses the Supabase Admin API to delete the auth user, which cascades
 * to profiles (ON DELETE CASCADE) and all related data.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const userId = await getAuthenticatedUserId(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const supabase = createClient(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    // Log the deletion event before deleting (for compliance audit trail)
    await supabase.rpc("log_audit_event", {
      p_user_id: userId,
      p_event_type: "account_deleted",
      p_metadata: { requested_at: new Date().toISOString() },
      p_ip_address: (req.headers["x-forwarded-for"] as string) || null,
      p_device_info: req.headers["user-agent"] || null,
    }).catch(() => {}); // Best effort — don't block deletion if audit fails

    // Delete wallet balance (zero it out first for audit)
    await supabase.from("wallets").delete().eq("user_id", userId);

    // Delete push tokens
    await supabase.from("push_tokens").delete().eq("user_id", userId);

    // Delete the auth user — this cascades to profiles and all FK references
    const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);

    if (deleteError) {
      console.error("[delete-account] auth deletion failed:", deleteError);
      return res.status(500).json({ error: "Failed to delete account. Please contact support." });
    }

    return res.status(200).json({ success: true, message: "Account deleted" });
  } catch (err) {
    console.error("[delete-account] error:", err);
    return res.status(500).json({ error: "Failed to delete account" });
  }
}
