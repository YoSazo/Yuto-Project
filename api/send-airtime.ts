import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

/**
 * Africa's Talking airtime integration.
 * NOTE: Currently NOT auto-triggered. Transfer credits accumulate in the
 * `transfer_credits` table and are used for remote P2P transfers (when
 * Bluetooth proximity isn't available). This file is kept for future use
 * if we ever want to send actual phone airtime as a reward.
 */

const AT_API_KEY = process.env.AT_API_KEY;
const AT_USERNAME = process.env.AT_USERNAME || "sandbox";
const AT_BASE = AT_USERNAME === "sandbox"
  ? "https://api.sandbox.africastalking.com"
  : "https://api.africastalking.com";

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env vars");
  return createClient(url, key);
}

/**
 * Send airtime to a phone number via Africa's Talking API.
 * Returns { success, message }
 */
async function sendAirtimeViaAT(phoneNumber: string, amountKes: number): Promise<{ success: boolean; message: string }> {
  if (!AT_API_KEY) {
    return { success: false, message: "Missing AT_API_KEY" };
  }

  const body = new URLSearchParams({
    username: AT_USERNAME,
    recipients: JSON.stringify([{
      phoneNumber,
      amount: `KES ${amountKes}`,
    }]),
  });

  try {
    const res = await fetch(`${AT_BASE}/version1/airtime/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        apiKey: AT_API_KEY,
      },
      body: body.toString(),
    });

    const data = await res.json() as any;

    if (data.errorMessage && data.errorMessage !== "None") {
      console.error("[send-airtime] AT error:", data);
      return { success: false, message: data.errorMessage || "Airtime send failed" };
    }

    // Check individual recipient status
    const entry = data.responses?.[0];
    if (entry?.status === "Success" || entry?.status === "Sent") {
      return { success: true, message: `KES ${amountKes} airtime sent` };
    }

    console.error("[send-airtime] AT recipient error:", entry);
    return { success: false, message: entry?.errorMessage || "Airtime delivery failed" };
  } catch (err) {
    console.error("[send-airtime] network error:", err);
    return { success: false, message: "Network error sending airtime" };
  }
}

/**
 * Try to send accumulated airtime to a user if their balance >= min_airtime_send.
 * Called from webhook.ts and withdraw.ts after crediting airtime.
 */
export async function trySendAirtime(userId: string): Promise<{ sent: boolean; amount?: number; message?: string }> {
  const supabase = getSupabase();

  // Get min threshold from config
  const { data: configRow } = await supabase
    .from("platform_config")
    .select("value")
    .eq("key", "min_airtime_send")
    .single();
  const minSend = Number(configRow?.value ?? 20);

  // Get user's airtime balance
  const { data: reward } = await supabase
    .from("airtime_rewards")
    .select("balance_kes")
    .eq("user_id", userId)
    .maybeSingle();

  const balance = Number(reward?.balance_kes ?? 0);
  if (balance < minSend) {
    return { sent: false, message: `Balance ${balance} < min ${minSend}` };
  }

  // Get user's phone number
  const { data: profile } = await supabase
    .from("profiles")
    .select("phone_number")
    .eq("id", userId)
    .maybeSingle();

  const phone = profile?.phone_number;
  if (!phone) {
    return { sent: false, message: "No phone number on profile" };
  }

  // Send the full balance as airtime
  const amountToSend = Math.floor(balance);
  const result = await sendAirtimeViaAT(phone, amountToSend);

  if (result.success) {
    // Mark as sent in DB
    await supabase.rpc("mark_airtime_sent", {
      p_user_id: userId,
      p_amount: amountToSend,
    });
    return { sent: true, amount: amountToSend };
  }

  return { sent: false, message: result.message };
}

/**
 * HTTP handler — can be called manually to trigger airtime send for a user.
 * POST /api/send-airtime { user_id }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { user_id } = req.body || {};
  if (!user_id) {
    return res.status(400).json({ success: false, message: "Missing user_id" });
  }

  const result = await trySendAirtime(user_id);
  return res.status(200).json(result);
}
