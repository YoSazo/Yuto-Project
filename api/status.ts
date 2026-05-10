import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuthenticatedUserId } from "./_auth.js";

const INTASEND_BASE = process.env.INTASEND_HOST || "https://sandbox.intasend.com";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Auth: require a logged-in user
  const authUserId = await getAuthenticatedUserId(req);
  if (!authUserId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { invoice_id } = req.body as { invoice_id?: string };
  if (!invoice_id) {
    return res.status(400).json({ error: "Missing invoice_id" });
  }

  try {
    const response = await fetch(`${INTASEND_BASE}/api/v1/payment/status/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.INTASEND_SECRET_KEY!}`,
      },
      body: JSON.stringify({ invoice_id }),
    });

    const data = (await response.json()) as {
      invoice?: { state?: string; [key: string]: unknown };
      detail?: string;
      [key: string]: unknown;
    };

    if (!response.ok) {
      return res.status(400).json({ error: data.detail || "Failed to check status" });
    }

    const state = data.invoice?.state;
    return res.status(200).json({ state, raw: data });
  } catch (err) {
    console.error("IntaSend status error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
