import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { sendAfricasTalkingSms } from "./_africastalking.js";
import { generateOtpDigits, hashOtpCode } from "./_phoneVerification.js";
import { isValidKeMobile, normalizeKePhone } from "./_normalizePhone.js";

const COOLDOWN_MS = 45_000;
const HOURLY_CAP = 5;
const OTP_TTL_MIN = 10;

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase server env");
  return createClient(url, key);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  if (!process.env.PHONE_VERIFICATION_SECRET) {
    return res.status(503).json({ error: "PHONE_VERIFICATION_SECRET is not configured" });
  }

  const rawPhone = typeof req.body?.phone === "string" ? req.body.phone : "";
  const phone = normalizeKePhone(rawPhone);

  if (!isValidKeMobile(phone)) {
    return res.status(400).json({ error: "Enter a valid Kenyan mobile number." });
  }

  try {
    const supabase = getSupabase();

    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: hourly } = await supabase
      .from("phone_otp_challenges")
      .select("id", { count: "exact", head: true })
      .eq("phone", phone)
      .gte("created_at", hourAgo);

    if ((hourly ?? 0) >= HOURLY_CAP) {
      return res.status(429).json({ error: "Too many codes requested. Try again in an hour." });
    }

    const { data: recent } = await supabase
      .from("phone_otp_challenges")
      .select("created_at")
      .eq("phone", phone)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (recent?.created_at) {
      const elapsed = Date.now() - new Date(recent.created_at).getTime();
      if (elapsed < COOLDOWN_MS) {
        const waitSec = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
        return res.status(429).json({ error: `Wait ${waitSec}s before requesting another code.` });
      }
    }

    await supabase.from("phone_otp_challenges").delete().eq("phone", phone);

    const code = generateOtpDigits();
    const digest = hashOtpCode(phone, code);
    const expiresAt = new Date(Date.now() + OTP_TTL_MIN * 60 * 1000).toISOString();

    const { error: insErr } = await supabase.from("phone_otp_challenges").insert({
      phone,
      code_digest: digest,
      expires_at: expiresAt,
      attempts: 0,
    });

    if (insErr) {
      console.error("[phone-request-code] insert:", insErr);
      return res.status(500).json({ error: "Could not start verification." });
    }

    const sms = await sendAfricasTalkingSms(
      phone,
      `Your Yuto verification code is ${code}. It expires in ${OTP_TTL_MIN} minutes.`,
    );

    if (!sms.ok) {
      await supabase.from("phone_otp_challenges").delete().eq("phone", phone);
      console.error("[phone-request-code] SMS failed:", sms.error);
      return res.status(502).json({ error: "Could not send SMS. Try again shortly." });
    }

    return res.status(200).json({ success: true });
  } catch (e) {
    console.error("[phone-request-code]", e);
    return res.status(500).json({ error: "Server error" });
  }
}
