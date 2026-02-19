import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Verify Flutterwave webhook signature
  const hash = req.headers["verif-hash"];
  if (hash !== process.env.FLW_WEBHOOK_HASH) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { event, data } = req.body;

  if (event !== "charge.completed" || data.status !== "successful") {
    return res.status(200).json({ received: true });
  }

  // Double-verify with Flutterwave
  try {
    const verifyRes = await fetch(
      `https://api.flutterwave.com/v3/transactions/${data.id}/verify`,
      { headers: { Authorization: `Bearer ${process.env.FLW_SECRET_KEY}` } }
    );
    const verifyData = await verifyRes.json();

    if (verifyData.data?.status !== "successful" || verifyData.data?.currency !== "KES") {
      console.error("Verification failed:", verifyData);
      return res.status(400).json({ error: "Verification failed" });
    }
  } catch (err) {
    console.error("Verify error:", err);
    return res.status(500).json({ error: "Verification request failed" });
  }

  // Parse tx_ref: yuto--{groupId}--{userId}--{timestamp}
  const parts = (data.tx_ref as string).split("--");
  if (parts.length < 3 || parts[0] !== "yuto") {
    return res.status(400).json({ error: "Invalid tx_ref format" });
  }

  const groupId = parts[1];
  const userId = parts[2];

  // Update Supabase with service role key (bypasses RLS)
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
    return res.status(500).json({ error: "Database update failed" });
  }

  // Check if all members paid → mark group completed
  const { data: members } = await supabase
    .from("group_members")
    .select("has_paid")
    .eq("group_id", groupId);

  if (members && members.every((m) => m.has_paid)) {
    await supabase.from("groups").update({ status: "completed" }).eq("id", groupId);
  }

  return res.status(200).json({ success: true });
}
