import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const INTASEND_BASE = process.env.INTASEND_HOST || "https://sandbox.intasend.com";

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

  const supabase = getSupabase();

  // ── Verify caller is the group host ───────────────
  const { data: group, error: groupError } = await supabase
    .from("groups")
    .select("id, created_by, total_amount, status")
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

  // ── Deduct from host's Yuto Balance ───────────────
  const { error: deductError } = await supabase.rpc("deduct_payout_balance", {
    p_user_id: user_id,
    p_amount: amount,
    p_group_id: group_id,
  });

  if (deductError) {
    return res.status(400).json({
      success: false,
      message: deductError.message || "Insufficient Yuto Balance to pay out",
    });
  }

  // ── Build IntaSend transaction ────────────────────
  let transaction: Record<string, unknown>;

  if (payment_type === "phone") {
    if (!phone_number) {
      return res.status(400).json({ success: false, message: "Missing phone number" });
    }
    transaction = {
      name: "Payee",
      account: phone_number,
      amount: Number(amount),
      narrative: "Yuto split payout",
    };
  } else if (payment_type === "buygoods") {
    if (!till_number) {
      return res.status(400).json({ success: false, message: "Missing till number" });
    }
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
    const initiateRes = await fetch(`${INTASEND_BASE}/api/v1/send-money/initiate/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.INTASEND_SECRET_KEY!}`,
      },
      body: JSON.stringify({
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
      [key: string]: unknown;
    };

    if (!initiateRes.ok) {
      // IntaSend failed — refund the host's balance
      await supabase.rpc("refund_payout_balance", {
        p_user_id: user_id,
        p_amount: amount,
        p_group_id: group_id,
      });
      return res.status(400).json({
        success: false,
        message: initiateData.detail || initiateData.message || "IntaSend payout failed — balance refunded",
      });
    }

    // Auto-approve if nonce returned
    if (initiateData.nonce && initiateData.tracking_id) {
      const approveRes = await fetch(`${INTASEND_BASE}/api/v1/send-money/approve/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.INTASEND_SECRET_KEY!}`,
        },
        body: JSON.stringify({
          nonce: initiateData.nonce,
          tracking_id: initiateData.tracking_id,
        }),
      });

      if (!approveRes.ok) {
        const approveData = (await approveRes.json()) as { detail?: string; message?: string };
        await supabase.rpc("refund_payout_balance", {
          p_user_id: user_id,
          p_amount: amount,
          p_group_id: group_id,
        });
        return res.status(400).json({
          success: false,
          message: approveData.detail || approveData.message || "Approval failed — balance refunded",
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
    // Network crash — refund
    await supabase.rpc("refund_payout_balance", {
      p_user_id: user_id,
      p_amount: amount,
      p_group_id: group_id,
    });
    console.error("IntaSend payout error:", err);
    return res.status(500).json({ success: false, message: "Network error — balance refunded" });
  }
}