/**
 * Africa's Talking SMS (Kenya). Uses env:
 *   AFRICASTALKING_USERNAME
 *   AFRICASTALKING_API_KEY
 * Optional: AFRICASTALKING_BASE_URL (default https://api.africastalking.com)
 */

const DEFAULT_BASE = "https://api.africastalking.com";

export async function sendAfricasTalkingSms(to: string, message: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const username = process.env.AFRICASTALKING_USERNAME;
  const apiKey = process.env.AFRICASTALKING_API_KEY;
  const base = (process.env.AFRICASTALKING_BASE_URL || DEFAULT_BASE).replace(/\/$/, "");

  if (!username || !apiKey) {
    return { ok: false, error: "SMS not configured (missing AFRICASTALKING_USERNAME or AFRICASTALKING_API_KEY)" };
  }

  const params = new URLSearchParams();
  params.set("username", username);
  params.set("to", to.startsWith("+") ? to : `+${to}`);
  params.set("message", message);
  const fromId = process.env.AFRICASTALKING_SENDER_ID;
  if (fromId) params.set("from", fromId);

  try {
    const res = await fetch(`${base}/version1/messaging`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
        ApiKey: apiKey,
      },
      body: params.toString(),
    });

    const text = await res.text();
    let data: unknown;
    try {
      data = JSON.parse(text) as Record<string, unknown>;
    } catch {
      data = { raw: text };
    }

    if (!res.ok) {
      const msg =
        typeof data === "object" && data && "errorMessage" in data
          ? String((data as { errorMessage?: string }).errorMessage)
          : text.slice(0, 200);
      return { ok: false, error: msg || `HTTP ${res.status}` };
    }

    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}
