import { sendAfricasTalkingSms } from "./_africastalking.js";

const SMS_MAX = 480;

/**
 * Sends a transactional money alert SMS if the user opted in and has a verified phone.
 */
export async function maybeSendMoneySmsAlert(supabase: any, userId: string, text: string): Promise<void> {
  try {
    const { data: p, error } = await supabase
      .from("profiles")
      .select("phone_number, phone_verified_at, sms_money_alerts")
      .eq("id", userId)
      .maybeSingle();

    if (error || !p?.sms_money_alerts || !p?.phone_verified_at || !p?.phone_number) return;

    const body = text.length > SMS_MAX ? `${text.slice(0, SMS_MAX - 1)}…` : text;
    const result = await sendAfricasTalkingSms(String(p.phone_number), body);
    if (!result.ok) {
      console.error("[moneySms] send failed:", result.error);
    }
  } catch (e) {
    console.error("[moneySms] error:", e);
  }
}
