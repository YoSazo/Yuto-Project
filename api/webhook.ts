import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
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

  // 2) Only process completed KES payments
  if (payload.state !== "COMPLETE" || payload.currency !== "KES") {
    return res.status(200).json({ received: true });
  }

  if (!payload.api_ref) {
    return res.status(400).json({ error: "Missing api_ref" });
  }

  // 3) Parse api_ref: yuto__{groupId}__{userId}__{timestamp}
  const parts = payload.api_ref.split("__");
  if (parts.length < 3 || parts[0] !== "yuto") {
    return res.status(400).json({ error: "Invalid api_ref format" });
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

  if (updateError) {
    console.error("Supabase update error:", updateError);
    return res.status(200).json({ error: "Database update failed" });
  }

  const { data: members, error: membersError } = await supabase
    .from("group_members")
    .select("has_paid")
    .eq("group_id", groupId);

  if (!membersError && members?.length && members.every((m) => m.has_paid)) {
    await supabase.from("groups").update({ status: "completed" }).eq("id", groupId);
  }

  return res.status(200).json({ success: true });
}
