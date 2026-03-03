import type { VercelRequest, VercelResponse } from "@vercel/node";

const INTASEND_BASE = process.env.INTASEND_HOST || "https://payment.intasend.com";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { phone_number, amount, group_id, user_id } = req.body;

  if (!phone_number || !amount || !group_id || !user_id) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const api_ref = `yuto__${group_id}__${user_id}__${Date.now()}`;

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

    const data = (await response.json()) as {
      invoice_id?: string;
      invoice?: { invoice_id?: string };
      detail?: string;
      message?: string;
      [key: string]: unknown;
    };

    const invoiceId = data.invoice_id ?? data.invoice?.invoice_id;

    if (response.ok && invoiceId) {
      return res.status(200).json({
        success: true,
        invoice_id: invoiceId,
        api_ref,
        message: "Check your phone for the M-PESA PIN prompt",
      });
    }

    // Log so Vercel logs show why charge failed (IntaSend status + body)
    if (!response.ok) {
      console.error("IntaSend charge non-OK:", response.status, JSON.stringify(data));
    } else {
      console.error("IntaSend charge OK but no invoice_id in response:", JSON.stringify(data));
    }

    return res.status(400).json({
      success: false,
      message: data.detail || data.message || "Failed to initiate payment",
    });
  } catch (err) {
    console.error("IntaSend charge error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}
