import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const INTASEND_BASE = process.env.INTASEND_HOST || "https://sandbox.intasend.com";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { phone_number, amount, user_id, transaction_id } = req.body;

  if (!phone_number || !amount || !user_id || !transaction_id) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  try {
    // Call IntaSend's B2C Transfer API
    const response = await fetch(`${INTASEND_BASE}/api/v1/send-money/initiate/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.INTASEND_SECRET_KEY!}`,
      },
      body: JSON.stringify({
        currency: "KES",
        transactions: [{
          name: "Yuto User",
          account: phone_number,
          amount: Number(amount),
          narrative: "Yuto Balance Withdrawal"
        }],
        requires_approval: "NO" // Set to NO to automate, or YES if you want to manually approve them in IntaSend dashboard
      }),
    });

    const data = await response.json();

    if (response.ok && data.status === "Success") {
      // Update the transaction description to show it worked
      await supabase.from("transactions").update({ description: "Withdrawal to M-PESA (Sent)" }).eq("id", transaction_id);
      
      return res.status(200).json({ success: true, message: "Funds sent to M-PESA!" });
    }

    // IF API FAILS: Trigger the refund SQL
    await supabase.rpc("refund_failed_withdrawal", { p_transaction_id: transaction_id });
    
    return res.status(400).json({
      success: false,
      message: data.message || "Transfer failed. Funds refunded to Yuto Balance.",
    });

  } catch (err) {
    // IF NETWORK CRASHES: Trigger the refund SQL
    await supabase.rpc("refund_failed_withdrawal", { p_transaction_id: transaction_id });
    return res.status(500).json({ success: false, message: "Internal server error. Funds refunded." });
  }
}