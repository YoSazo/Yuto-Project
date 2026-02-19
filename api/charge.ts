import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { phone_number, amount, group_id, user_id } = req.body;

  if (!phone_number || !amount || !group_id || !user_id) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const tx_ref = `yuto--${group_id}--${user_id}--${Date.now()}`;

  try {
    const response = await fetch("https://api.flutterwave.com/v3/charges?type=mpesa", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tx_ref,
        amount: String(amount),
        currency: "KES",
        phone_number,
        email: `${user_id}@yuto.app`,
        fullname: "Yuto User",
      }),
    });

    const data = await response.json();

    if (data.status === "success") {
      return res.status(200).json({
        success: true,
        tx_ref,
        message: "Check your phone for the M-PESA PIN prompt",
      });
    }

    return res.status(400).json({
      success: false,
      message: data.message || "Failed to initiate payment",
    });
  } catch (err) {
    console.error("Charge error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}
