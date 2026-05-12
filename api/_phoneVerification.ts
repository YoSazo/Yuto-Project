import { createHmac, randomInt, timingSafeEqual } from "crypto";

export function generateOtpDigits(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function hashOtpCode(phone: string, code: string): string {
  const secret = process.env.PHONE_VERIFICATION_SECRET || "";
  return createHmac("sha256", secret).update(`otp:${phone}:${code}`).digest("hex");
}

export function safeEqualHex(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, "hex");
    const bb = Buffer.from(b, "hex");
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

function safeEqualB64Url(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export interface PhoneSignupTokenPayload {
  phone: string;
  purpose: "signup";
  exp: number;
}

export function signPhoneSignupToken(phone: string, ttlSeconds: number): string {
  const secret = process.env.PHONE_VERIFICATION_SECRET!;
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload: PhoneSignupTokenPayload = { phone, purpose: "signup", exp };
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyPhoneSignupToken(token: string): PhoneSignupTokenPayload | null {
  const secret = process.env.PHONE_VERIFICATION_SECRET;
  if (!secret || !token) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  if (!safeEqualB64Url(sig, expected)) return null;
  try {
    const json = Buffer.from(body, "base64url").toString("utf8");
    const data = JSON.parse(json) as PhoneSignupTokenPayload;
    if (data.purpose !== "signup" || typeof data.phone !== "string" || typeof data.exp !== "number") {
      return null;
    }
    if (data.exp < Math.floor(Date.now() / 1000)) return null;
    return data;
  } catch {
    return null;
  }
}
