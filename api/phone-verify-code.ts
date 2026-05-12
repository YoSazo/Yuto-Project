import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { hashOtpCode, safeEqualHex, signPhoneSignupToken } from "./_phoneVerification.js";
import { isValidKeMobile, normalizeKePhone } from "./_normalizePhone.js";

const MAX_ATTEMPTS = 8;
const TOKEN_TTL_SEC = 15 * 60;

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
  const rawCode = typeof req.body?.code === "string" ? req.body.code.replace(/\D/g, "") : "";
  const phone = normalizeKePhone(rawPhone);

  if (!isValidKeMobile(phone) || rawCode.length !== 6) {
    return res.status(400).json({ error: "Invalid phone or code." });
  }

  try {
    const supabase = getSupabase();
    const nowIso = new Date().toISOString();

    const { data: row, error: fetchErr } = await supabase
      .from("phone_otp_challenges")
      .select("id, code_digest, expires_at, attempts")
      .eq("phone", phone)
      .gt("expires_at", nowIso)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchErr || !row) {
      return res.status(400).json({ error: "No active code. Request a new one." });
    }

    if ((row.attempts ?? 0) >= MAX_ATTEMPTS) {
      await supabase.from("phone_otp_challenges").delete().eq("phone", phone);
      return res.status(429).json({ error: "Too many attempts. Request a new code." });
    }

    const expectedDigest = hashOtpCode(phone, rawCode);
    if (!safeEqualHex(expectedDigest, row.code_digest)) {
      await supabase
        .from("phone_otp_challenges")
        .update({ attempts: (row.attempts ?? 0) + 1 })
        .eq("id", row.id);
      return res.status(400).json({ error: "Incorrect code." });
    }

    await supabase.from("phone_otp_challenges").delete().eq("phone", phone);

    const verification_token = signPhoneSignupToken(phone, TOKEN_TTL_SEC);
    return res.status(200).json({ success: true, verification_token });
  } catch (e) {
    console.error("[phone-verify-code]", e);
    return res.status(500).json({ error: "Server error" });
  }
}
