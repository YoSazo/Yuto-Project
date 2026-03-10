import type { VercelRequest, VercelResponse } from "@vercel/node";

const INTASEND_BASE =
  process.env.INTASEND_HOST || "https://sandbox.intasend.com";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { amount, payment_type, phone_number, till_number, business_no, account_no } =
    req.body as {
      amount?: number;
      payment_type?: "phone" | "buygoods" | "paybill";
      phone_number?: string;
      till_number?: string;
      business_no?: string;
      account_no?: string;
    };

  if (!amount || !payment_type) {
    return res.status(400).json({ success: false, message: "Missing required fields" });
  }

  // Build the transaction object based on payment type
  let transaction: Record<string, unknown>;

  if (payment_type === "phone") {
    if (!phone_number) {
      return res.status(400).json({ success: false, message: "Missing phone number" });
    }
    transaction = {
      name: "Driver",
      account: phone_number,
      amount: Number(amount),
      narrative: "Fare payment via Yuto",
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
      narrative: "Fare payment via Yuto",
    };
  } else if (payment_type === "paybill") {
    if (!business_no || !account_no) {
      return res
        .status(400)
        .json({ success: false, message: "Missing business or account number" });
    }
    transaction = {
      name: "Business",
      account: business_no,
      account_type: "Paybill",
      account_reference: account_no,
      amount: Number(amount),
      narrative: "Fare payment via Yuto",
    };
  } else {
    return res.status(400).json({ success: false, message: "Invalid payment type" });
  }

  try {
    console.log(
      "IntaSend payout request:",
      JSON.stringify({ amount, payment_type, transaction }),
    );

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
      console.error(
        "IntaSend payout initiate non-OK:",
        initiateRes.status,
        JSON.stringify(initiateData),
      );
      return res.status(400).json({
        success: false,
        message: initiateData.detail || initiateData.message || "Failed to initiate payout",
      });
    }

    console.log("IntaSend payout initiated:", JSON.stringify(initiateData));

    // If requires_approval is NO, the transaction is auto-approved.
    // If IntaSend still returns a nonce/tracking_id requiring approval, approve it.
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

      const approveData = (await approveRes.json()) as {
        detail?: string;
        message?: string;
        [key: string]: unknown;
      };

      if (!approveRes.ok) {
        console.error(
          "IntaSend payout approve non-OK:",
          approveRes.status,
          JSON.stringify(approveData),
        );
        return res.status(400).json({
          success: false,
          message: approveData.detail || approveData.message || "Failed to approve payout",
        });
      }

      console.log("IntaSend payout approved:", JSON.stringify(approveData));
    }

    return res.status(200).json({
      success: true,
      message: "Payment sent successfully",
    });
  } catch (err) {
    console.error("IntaSend payout error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}
