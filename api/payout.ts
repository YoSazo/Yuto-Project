import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { getAuthenticatedUserId } from "./_auth.js";

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

  const {
    group_id,
    user_id,
    amount,
    payment_type,
    phone_number,
    till_number,
    business_no,
    account_no,
  } = req.body as {
    group_id?: string;
    user_id?: string;
    amount?: number;
    payment_type?: "phone" | "buygoods" | "paybill";
    phone_number?: string;
    till_number?: string;
    business_no?: string;
    account_no?: string;
  };

  // ── Validate required fields ──────────────────────
  if (!group_id || !user_id || !amount || !payment_type) {
    return res.status(400).json({ success: false, message: "Missing required fields" });
  }
  if (!INTASEND_SECRET_KEY) {
    return res.status(500).json({ success: false, message: "Missing INTASEND_SECRET_KEY" });
  }

  // Auth: verify the caller is the user they claim to be
  const authUserId = await getAuthenticatedUserId(req);
  if (!authUserId || authUserId !== user_id) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  const supabase = getSupabase();

  // ── Verify caller is the group host ───────────────
  const { data: group, error: groupError } = await supabase
    .from("groups")
    .select("id, created_by, total_amount, collected_balance, status")
    .eq("id", group_id)
    .single();

  if (groupError || !group) {
    return res.status(404).json({ success: false, message: "Group not found" });
  }

  if (group.created_by !== user_id) {
    return res.status(403).json({ success: false, message: "Only the group host can pay out" });
  }

  if (group.status === "completed") {
    return res.status(400).json({ success: false, message: "This group has already been paid out" });
  }

  // ── Verify all members have paid ──────────────────
  const { data: members, error: membersError } = await supabase
    .from("group_members")
    .select("has_paid")
    .eq("group_id", group_id);

  if (membersError || !members?.length) {
    return res.status(400).json({ success: false, message: "Could not verify member payments" });
  }

  const allPaid = members.every((m) => m.has_paid);
  if (!allPaid) {
    return res.status(400).json({
      success: false,
      message: `Not everyone has paid yet (${members.filter((m) => m.has_paid).length}/${members.length})`,
    });
  }

  // ── Reserve the split pool; do not debit the host's personal wallet ──
  const collected = Number((group as { collected_balance?: number | string | null }).collected_balance ?? 0);
  if (collected < totalNeeded) {
    return res.status(400).json({
      success: false,
      message: `This split has KSH ${collected.toLocaleString("en-KE")} collected, but payout needs KSH ${totalNeeded.toLocaleString("en-KE")}${payoutFee > 0 ? ` (${Number(amount).toLocaleString("en-KE")} + ${payoutFee} fee)` : ""}.`,
    });
  }

  const { error: deductError } = await supabase
    .from("groups")
    .update({ collected_balance: collected - totalNeeded })
    .eq("id", group_id)
    .gte("collected_balance", totalNeeded);

  if (deductError) {
    return res.status(400).json({
      success: false,
      message: deductError.message || "Could not reserve the split payout funds",
    });
  }

  // ── Build IntaSend transaction ────────────────────
  // Apply payout fees based on payment type
  // Fee is absorbed by the group (deducted from collected_balance alongside the payout amount)
  let payoutFee = 0;
  if (payment_type === "phone") payoutFee = 25;
  // till and paybill = 0 fee

  // Check group has enough for amount + fee
  const totalNeeded = Number(amount) + payoutFee;

  let transaction: Record<string, unknown>;
  let provider: "MPESA-B2C" | "MPESA-B2B";

  if (payment_type === "phone") {
    if (!phone_number) {
      return res.status(400).json({ success: false, message: "Missing phone number" });
    }
    provider = "MPESA-B2C";
    transaction = {
      name: "Payee",
      account: phone_number,
      amount: Number(amount), // Recipient gets the full amount
      narrative: "Yuto split payout",
    };
  } else if (payment_type === "buygoods") {
    if (!till_number) {
      return res.status(400).json({ success: false, message: "Missing till number" });
    }
    provider = "MPESA-B2B";
    transaction = {
      name: "Merchant",
      account: till_number,
      account_type: "TillNumber",
      amount: Number(amount),
      narrative: "Yuto split payout",
    };
  } else if (payment_type === "paybill") {
    if (!business_no || !account_no) {
      return res.status(400).json({ success: false, message: "Missing business or account number" });
    }
    provider = "MPESA-B2B";
    transaction = {
      name: "Business",
      account: business_no,
      account_type: "Paybill",
      account_reference: account_no,
      amount: Number(amount),
      narrative: "Yuto split payout",
    };
  } else {
    return res.status(400).json({ success: false, message: "Invalid payment type" });
  }

  // ── Fire IntaSend B2C ─────────────────────────────
  try {
    const startedAt = Date.now();
    const initiateRes = await fetch(`${INTASEND_BASE}/api/v1/send-money/initiate/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${INTASEND_SECRET_KEY}`,
      },
      body: JSON.stringify({
        provider,
        currency: "KES",
        requires_approval: "NO",
        transactions: [transaction],
      }),
    });

    const initiateData = (await initiateRes.json()) as {
      tracking_id?: string;
      nonce?: string;
      status?: string;
      detail?: string;
      message?: string;
      errors?: unknown[];
      [key: string]: unknown;
    };

    if (!initiateRes.ok) {
      // Refund the host's balance
      await supabase
        .from("groups")
        .update({ collected_balance: collected })
        .eq("id", group_id);

      // Surface the actual IntaSend error details
      const errDetail =
        (initiateData as any)?.errors?.[0]?.detail ||
        (initiateData as any)?.errors?.[0]?.message ||
        (initiateData as any)?.errors?.[0] ||
        initiateData.detail ||
        initiateData.message ||
        JSON.stringify(initiateData);

      console.error("[payout] initiate failed:", {
        status: initiateRes.status,
        duration_ms: Date.now() - startedAt,
        provider,
        body: JSON.stringify(initiateData),
      });
      return res.status(400).json({
        success: false,
        message: typeof errDetail === "string" ? errDetail : "IntaSend payout failed — balance refunded",
      });
    }

    // Only approve when IntaSend explicitly requires it.
    // We set `requires_approval: "NO"`, so calling approve can 400 even if a nonce is present.
    const statusText = String(initiateData.status || "").toLowerCase();
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
        // Refund by restoring collected_balance
        await supabase
          .from("groups")
          .update({ collected_balance: collected })
          .eq("id", group_id);
        console.error("[payout] approve failed:", {
          status: approveRes.status,
          provider,
          body: approveData,
        });

        const msg =
          (approveData as any)?.detail ||
          (approveData as any)?.message ||
          ((approveData as any)?.errors?.[0]?.message as string | undefined) ||
          "Approval failed — balance refunded";

        return res.status(400).json({
          success: false,
          message: msg,
          intasend: approveData,
        });
      }
    }

    // ── Mark group as completed ───────────────────
    await supabase
      .from("groups")
      .update({ status: "completed" })
      .eq("id", group_id);

    return res.status(200).json({ success: true, message: "Payment sent successfully" });
  } catch (err) {
    // Network crash — restore collected_balance
    try {
      await supabase
        .from("groups")
        .update({ collected_balance: collected })
        .eq("id", group_id);
    } catch (refundErr) {
      console.error("[payout] refund on crash failed:", refundErr);
    }
    console.error("IntaSend payout error:", err);
    return res.status(500).json({ success: false, message: "Network error — balance refunded" });
  }
}
