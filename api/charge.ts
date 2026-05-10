import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { getAuthenticatedUserId } from "./_auth.js";

const INTASEND_BASE = process.env.INTASEND_HOST || "https://sandbox.intasend.com";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { phone_number, amount, group_id, function_id, user_id, is_topup } = req.body;

  if (!phone_number || !amount || !user_id) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  // Auth: verify the caller is the user they claim to be
  const authUserId = await getAuthenticatedUserId(req);
  if (!authUserId || authUserId !== user_id) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  // Enforce minimum wallet top-up
  if (is_topup) {
    const n = Number(amount);
    if (!Number.isFinite(n) || n < 20) {
      return res.status(400).json({ success: false, message: "Minimum top-up is KSH 20." });
    }
  }

  // Generate the API Reference string based on the payment type
  let api_ref = "";
  let targetType: "group" | "function" | null = null;
  let targetId = group_id || function_id;

  if (is_topup) {
    // Top-up reference formatted as: TOPUP_uuid_timestamp
    api_ref = `TOPUP${user_id.replace(/-/g, "")}${Date.now()}`;
  } else {
    targetType = group_id ? "group" : function_id ? "function" : null;
    if (!targetId || !targetType) return res.status(400).json({ error: "Missing targets" });
    const shortTargetId = targetId.replace(/-/g, "").slice(0, 7);
    const shortUserId = user_id.replace(/-/g, "").slice(0, 7);
    api_ref = `yuto-${targetType}-${shortTargetId}-${shortUserId}`;
  }

  try {
    const response = await fetch(`${INTASEND_BASE}/api/v1/payment/collection/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.INTASEND_SECRET_KEY!}`,
      },
      body: JSON.stringify({
        public_key: process.env.INTASEND_PUBLISHABLE_KEY,
        currency: "KES",
        method: "M-PESA",
        amount: Number(amount),
        phone_number,
        api_ref,
        name: "Yuto User",
        email: "pay@yuto.app",
      }),
    });

    const data = await response.json() as any;
    const invoiceId = data.invoice_id ?? data.invoice?.invoice_id;

    if (response.ok && invoiceId) {
      const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      // Only save the invoice to the group_members table if this is NOT a top-up
      if (!is_topup && supabaseUrl && serviceRoleKey) {
        const supabase = createClient(supabaseUrl, serviceRoleKey);
        const membershipTable = targetType === "group" ? "group_members" : "function_members";
        const idColumn = targetType === "group" ? "group_id" : "function_id";
        await supabase
          .from(membershipTable)
          .update({ payment_invoice_id: invoiceId, payment_api_ref: api_ref })
          .eq(idColumn, targetId)
          .eq("user_id", user_id);
      }

      return res.status(200).json({
        success: true,
        invoice_id: invoiceId,
        api_ref,
        message: "Check your phone for the M-PESA PIN prompt",
      });
    }

    return res.status(400).json({
      success: false,
      message: data.detail || data.message || "Failed to initiate payment",
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}