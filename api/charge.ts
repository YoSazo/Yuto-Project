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
        method: "MPESA_STK_PUSH",
        amount: Number(amount),
        currency: "KES",
        phone_number,
        email: `${user_id}@yuto.app`,
        api_ref,
        host: "https://yuto-project.vercel.app",
        public_key: process.env.INTASEND_PUBLISHABLE_KEY,
      }),
    });

    const data = (await response.json()) as {
      invoice_id?: string;
      detail?: string;
      message?: string;
      [key: string]: unknown;
    };

    if (response.ok && data.invoice_id) {
      return res.status(200).json({
        success: true,
        invoice_id: data.invoice_id,
        api_ref,
        message: "Check your phone for the M-PESA PIN prompt",
      });
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
