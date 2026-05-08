import type { VercelRequest, VercelResponse } from "@vercel/node";
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getSupabase() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing Supabase env vars");
  }
  return createClient<any>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

function initWebPush() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails("mailto:support@yuto.app", publicKey, privateKey);
  return true;
}

async function sendPush(supabase: any, userId: string, title: string, body: string) {
  try {
    if (!initWebPush()) return;
    const { data } = await supabase.from("push_tokens").select("token").eq("user_id", userId).maybeSingle();
    if (!data?.token) return;
    const subscription = JSON.parse(data.token);
    await webpush.sendNotification(subscription, JSON.stringify({ title, body }));
  } catch (e) {
    console.error("[cancel-function] push failed:", e);
  }
}

async function creditWallet(
  supabase: any,
  userId: string,
  amountKes: number,
  fn: { id: string; title: string; host_id: string },
) {
  if (!Number.isFinite(amountKes) || amountKes <= 0) return;
  const { data: w } = await supabase.from("wallets").select("id, balance").eq("user_id", userId).maybeSingle();
  const current = Number(w?.balance ?? 0) || 0;
  const next = current + amountKes;
  if (!w?.id) {
    await supabase.from("wallets").insert({ user_id: userId, balance: next });
  } else {
    await supabase.from("wallets").update({ balance: next }).eq("id", w.id);
  }
  // Canonical refund ledger entry — receipts can now show "Refunded — Function
  // cancelled" with a deep-link to the original function.
  await supabase.from("transactions").insert({
    user_id: userId,
    amount: amountKes,
    kind: "cancellation_refund",
    note: `Refund: ${fn.title} was cancelled by host`,
    method: "system",
    status: "settled",
    counterparty_id: fn.host_id,
    metadata: {
      reason: "host_cancelled_function",
      function_id: fn.id,
      function_title: fn.title,
    },
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const { function_id, host_id } = req.body as { function_id?: string; host_id?: string };
    if (!function_id || !host_id) return res.status(400).json({ success: false, message: "Missing function_id or host_id" });

    const supabase = getSupabase();

    const { data: fn, error: fnErr } = await supabase
      .from("functions")
      .select("id, title, host_id, amount_per_person, status")
      .eq("id", function_id)
      .single();
    if (fnErr || !fn) return res.status(404).json({ success: false, message: "Function not found" });
    if (String(fn.host_id) !== String(host_id)) return res.status(403).json({ success: false, message: "Only host can cancel" });

    if (String(fn.status) === "cancelled") return res.status(200).json({ success: true, refunded: 0, message: "Already cancelled" });

    const { data: paidMembers, error: memErr } = await supabase
      .from("function_members")
      .select("user_id")
      .eq("function_id", function_id)
      .eq("has_paid", true);
    if (memErr) return res.status(400).json({ success: false, message: memErr.message });

    const userIds = Array.from(new Set((paidMembers || []).map((m: any) => String(m.user_id)).filter(Boolean)));
    const refundKes = Number(fn.amount_per_person || 0) || 0;

    // Cancel first (so UI stops selling)
    await supabase.from("functions").update({ status: "cancelled" }).eq("id", function_id);

    let refunded = 0;
    for (const uid of userIds) {
      try {
        await creditWallet(supabase, uid, refundKes, { id: fn.id, title: fn.title, host_id: fn.host_id });
        refunded += 1;
        await sendPush(supabase, uid, "Refund issued", `“${fn.title}” was cancelled. Refunded KSH ${refundKes.toLocaleString("en-KE")} to your Yuto Balance.`);
      } catch (e) {
        console.error("[cancel-function] refund failed:", uid, e);
      }
    }

    // Notify host too
    await sendPush(supabase, host_id, "Function cancelled", `Refunded ${refunded} attendee${refunded === 1 ? "" : "s"} for “${fn.title}”.`);

    return res.status(200).json({ success: true, refunded });
  } catch (e) {
    console.error("[cancel-function] error:", e);
    return res.status(500).json({ success: false, message: "Internal error" });
  }
}

