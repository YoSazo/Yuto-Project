/** Kenyan MSISDN → digits-only `254XXXXXXXXX` (no leading +). */
export function normalizeKePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("0") && digits.length === 10) return "254" + digits.slice(1);
  if (digits.startsWith("254")) return digits;
  if (digits.length === 9) return "254" + digits;
  return digits;
}

export function isValidKeMobile(phone254: string): boolean {
  return /^254\d{9}$/.test(phone254);
}
