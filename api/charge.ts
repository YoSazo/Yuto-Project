import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const INTASEND_BASE =
  process.env.INTASEND_HOST || "https://sandbox.intasend.com";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { phone_number, amount, group_id, user_id } = req.body;

  if (!phone_number || !amount || !group_id || !user_id) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  // IntaSend truncates api_ref beyond ~20 chars; full UUIDs exceed that limit.
  // Use short IDs so the ref is never truncated. Webhook routing relies on
  // payment_invoice_id (saved to DB below) as the primary identifier anyway.
  const shortGroupId = group_id.replace(/-/g, "").slice(0, 7);
  const shortUserId = user_id.replace(/-/g, "").slice(0, 7);
  const api_ref = `yuto-${shortGroupId}-${shortUserId}`;

  try {
    console.log(
      "IntaSend charge request:",
      JSON.stringify({ amount: Number(amount), phone_number, api_ref }),
    );
    const response = await fetch(
      `${INTASEND_BASE}/api/v1/payment/collection/`,
      {
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
      },
    );

    const data = (await response.json()) as {
      invoice_id?: string;
      invoice?: { invoice_id?: string };
      detail?: string;
      message?: string;
      [key: string]: unknown;
    };

    const invoiceId = data.invoice_id ?? data.invoice?.invoice_id;

    if (response.ok && invoiceId) {
      // Persist invoice_id so webhook can map payment → group member even if api_ref is absent in webhook payload
      try {
        const supabaseUrl =
          process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!supabaseUrl || !serviceRoleKey) {
          console.error(
            "Missing Supabase env for charge (need SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel)",
          );
        } else {
          const supabase = createClient(supabaseUrl, serviceRoleKey);
          const { error } = await supabase
            .from("group_members")
            .update({ payment_invoice_id: invoiceId, payment_api_ref: api_ref })
            .eq("group_id", group_id)
            .eq("user_id", user_id);
          if (error)
            console.error(
              "Failed to persist invoice_id on group_members:",
              error,
            );
        }
      } catch (err) {
        console.error("Failed to persist invoice_id on group_members:", err);
      }

      return res.status(200).json({
        success: true,
        invoice_id: invoiceId,
        api_ref,
        message: "Check your phone for the M-PESA PIN prompt",
      });
    }

    // Log so Vercel logs show why charge failed (IntaSend status + body)
    if (!response.ok) {
      console.error(
        "IntaSend charge non-OK:",
        response.status,
        JSON.stringify(data),
      );
    } else {
      console.error(
        "IntaSend charge OK but no invoice_id in response:",
        JSON.stringify(data),
      );
    }

    return res.status(400).json({
      success: false,
      message: data.detail || data.message || "Failed to initiate payment",
    });
  } catch (err) {
    console.error("IntaSend charge error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
}
