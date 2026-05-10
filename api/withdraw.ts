import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { getAuthenticatedUserId } from "./_auth";

// IntaSend send-money API base. For live use `https://api.intasend.com`.
const INTASEND_BASE = process.env.INTASEND_HOST || "https://sandbox.intasend.com";
const INTASEND_SECRET_KEY = process.env.INTASEND_SECRET_KEY;

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env vars");
  return createClient(url, key);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { phone_number, amount, user_id, transaction_id } = req.body;

  if (!phone_number || !amount || !user_id || !transaction_id) {
    return res.status(400).json({ success: false, message: "Missing required fields" });
  }

  // Auth: verify the caller is the user they claim to be
  const authUserId = await getAuthenticatedUserId(req);
  if (!authUserId || authUserId !== user_id) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  if (!INTASEND_SECRET_KEY) {
    return res.status(500).json({ success: false, message: "Missing INTASEND_SECRET_KEY" });
  }

  const supabase = getSupabase();

  try {
    // ── Call IntaSend's B2C Transfer API ──────────────────
    // IMPORTANT: 'provider' is required. For M-Pesa withdrawals, it's 'MPESA-B2C'.
    const startedAt = Date.now();
    const initiateRes = await fetch(`${INTASEND_BASE}/api/v1/send-money/initiate/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${INTASEND_SECRET_KEY}`,
      },
      body: JSON.stringify({
        provider: "MPESA-B2C",
        currency: "KES",
        transactions: [{
          name: "Yuto User",
          account: phone_number,
          amount: Number(amount),
          narrative: "Yuto Balance Withdrawal"
        }],
        requires_approval: "NO"
      }),
    });

    const initiateData = (await initiateRes.json()) as {
      tracking_id?: string;
      nonce?: string;
      status?: string;
      detail?: string;
      message?: string;
      [key: string]: unknown;
    };

    if (!initiateRes.ok) {
      // API failed — trigger the refund SQL
      await supabase.rpc("refund_failed_withdrawal", { p_transaction_id: transaction_id });
      console.error("[withdraw] initiate failed:", {
        status: initiateRes.status,
        duration_ms: Date.now() - startedAt,
        body: initiateData,
      });
      return res.status(400).json({
        success: false,
        message: initiateData.detail || initiateData.message || "Transfer failed — balance refunded",
      });
    }

    // ── Handle Approval (if required by IntaSend) ──────────
    const statusText = String(initiateData.status || "").toLowerCase();

    // Check if the transaction actually failed early
    const isFailed = statusText.includes("fail") || statusText.includes("reject") || statusText.includes("cancel");
    if (isFailed) {
      await supabase.rpc("refund_failed_withdrawal", { p_transaction_id: transaction_id });
      return res.status(400).json({
        success: false,
        message: "Transaction failed — balance refunded",
      });
    }

    const approvalRequired =
      statusText.includes("approve") ||
      statusText.includes("approval") ||
      statusText.includes("pending");

    if (approvalRequired && initiateData.nonce && initiateData.tracking_id) {
      const approveRes = await fetch(`${INTASEND_BASE}/api/v1/send-money/approve/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${INTASEND_SECRET_KEY}`,
        },
        body: JSON.stringify({
          nonce: initiateData.nonce,
          tracking_id: initiateData.tracking_id,
        }),
      });

      if (!approveRes.ok) {
        const approveData = (await approveRes.json()) as Record<string, unknown>;
        await supabase.rpc("refund_failed_withdrawal", { p_transaction_id: transaction_id });
        console.error("[withdraw] approve failed:", {
          status: approveRes.status,
          body: approveData,
        });
        return res.status(400).json({
          success: false,
          message: "Approval failed — balance refunded",
        });
      }
    }

    // ── Mark transaction row as settled ───────────────────
    const { error: updErr } = await supabase
      .from("transactions")
      .update({
        status: "settled",
        method: "mpesa_b2c",
        kind: "withdrawal",
        note: `Withdrawal to M-PESA · KSH ${Math.round(Number(amount)).toLocaleString("en-KE")}`,
        metadata: {
          provider: "intasend",
          phone: phone_number,
          tracking_id: initiateData?.tracking_id || null,
          requires_approval: "NO",
          final_status: initiateData?.status || "Processing"
        },
      })
      .eq("id", transaction_id);
    
    if (updErr) console.error("[withdraw] tx update error:", updErr);

    return res.status(200).json({ success: true, message: "Funds sent to M-PESA!" });

  } catch (err) {
    // Network crash — refund
    await supabase.rpc("refund_failed_withdrawal", { p_transaction_id: transaction_id });
    console.error("[withdraw] handler error:", err);
    return res.status(500).json({ success: false, message: "Internal server error — balance refunded" });
  }
}
