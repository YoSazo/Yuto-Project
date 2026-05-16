import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { maybeSendMoneySmsAlert } from "./_moneySms.js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const INTASEND_BASE = process.env.INTASEND_HOST || "https://sandbox.intasend.com";

function getSupabaseClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    const missing = [
      !SUPABASE_URL && "SUPABASE_URL or VITE_SUPABASE_URL",
      !SUPABASE_SERVICE_ROLE_KEY && "SUPABASE_SERVICE_ROLE_KEY",
    ].filter(Boolean);
    throw new Error(
      `Missing Supabase env in webhook: ${missing.join(", ")}. Use service role key (not anon) for server-side.`,
    );
  }
  return createClient<any>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

const REFERRAL_BONUS_KES = 50;

function initWebPush() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails("mailto:support@yuto.app", publicKey, privateKey);
  return true;
}

async function sendPushNotification(
  supabase: any,
  userId: string,
  title: string,
  body: string,
) {
  try {
    if (!initWebPush()) return;
    const { data: tokenRow, error } = await supabase
      .from("push_tokens")
      .select("token")
      .eq("user_id", userId)
      .maybeSingle();
    if (error || !tokenRow?.token) return;
    const subscription = JSON.parse(tokenRow.token);
    await webpush.sendNotification(subscription, JSON.stringify({ title, body }));
  } catch (err) {
    console.error("[webhook] push notification error:", err);
  }
}

async function getDisplayName(supabase: any, userId: string) {
  try {
    const { data } = await supabase
      .from("profiles")
      .select("display_name, username")
      .eq("id", userId)
      .maybeSingle();
    return (data?.display_name || data?.username || "Someone") as string;
  } catch {
    return "Someone";
  }
}

async function creditWalletBalance(supabase: any, userId: string, amountKes: number) {
  // Avoid `topup_balance` RPC: some DBs have an enum mismatch (`transaction_type` missing "topup") which breaks credits.
  if (!Number.isFinite(amountKes) || amountKes <= 0) return { ok: false as const, reason: "invalid_amount" as const };

  for (let attempt = 0; attempt < 4; attempt++) {
    const { data: w, error: readErr } = await supabase
      .from("wallets")
      .select("id, balance")
      .eq("user_id", userId)
      .maybeSingle();

    if (readErr) {
      console.error("[webhook] wallets read error:", readErr);
      return { ok: false as const, reason: "read_error" as const };
    }

    const current = Number(w?.balance ?? 0) || 0;
    const next = current + amountKes;

    if (!w?.id) {
      const { error: insertErr } = await supabase.from("wallets").insert({ user_id: userId, balance: next });
      if (!insertErr) return { ok: true as const, previous: 0, next };
      console.error("[webhook] wallets insert error (retrying):", insertErr);
      continue;
    }

    const { error: updateErr } = await supabase
      .from("wallets")
      .update({ balance: next })
      .eq("id", w.id)
      // optimistic concurrency: retry if balance changed between read & write
      .eq("balance", w.balance as any);

    if (!updateErr) return { ok: true as const, previous: current, next };

    console.error("[webhook] wallets update error (retrying):", updateErr);
  }

  return { ok: false as const, reason: "retry_exhausted" as const };
}

function extractKesAmount(payload: Record<string, unknown>): number {
  const candidates: unknown[] = [
    payload.value,
    payload.amount,
    (payload.invoice as any)?.value,
    (payload.invoice as any)?.amount,
    (payload.data as any)?.value,
    (payload.data as any)?.amount,
    payload.net_amount,
  ];
  for (const v of candidates) {
    const n = typeof v === "string" ? Number(v.replace(/,/g, "")) : Number(v);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}

async function fetchAmountFromStatus(invoiceId: string): Promise<number> {
  try {
    const res = await fetch(`${INTASEND_BASE}/api/v1/payment/status/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.INTASEND_SECRET_KEY!}`,
      },
      body: JSON.stringify({ invoice_id: invoiceId }),
    });
    const data = (await res.json()) as any;
    if (!res.ok) return 0;
    const n = Number(data?.invoice?.value ?? data?.invoice?.amount ?? 0);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

async function maybeConvertReferralOnFirstTopUp(supabase: any, referredUserId: string) {
  // If this user has a referral row and it hasn't converted yet, convert it and credit the referrer once.
  const { data: ref, error } = await supabase
    .from("referrals")
    .select("id, referrer_id, referred_id, converted")
    .eq("referred_id", referredUserId)
    .maybeSingle();

  if (error) {
    console.error("[webhook] referral lookup error:", error);
    return;
  }
  if (!ref || ref.converted) return;

  try {
    // Credit referrer wallet
    const credited = await creditWalletBalance(supabase, ref.referrer_id, REFERRAL_BONUS_KES);
    if (!credited.ok) {
      console.error("[webhook] referral bonus credit failed:", credited);
      return;
    }
    // Mark referral converted
    await supabase.from("referrals").update({ converted: true }).eq("id", ref.id);
    // Canonical ledger entry — kind/note are the live columns; the DB trigger
    // back-fills the legacy type/description so old code paths still work.
    const { error: txErr } = await supabase.from("transactions").insert({
      user_id: ref.referrer_id,
      amount: REFERRAL_BONUS_KES,
      kind: "referral_bonus",
      note: `Friend's first top-up earned you KSH ${REFERRAL_BONUS_KES}`,
      method: "system",
      status: "settled",
      counterparty_id: ref.referred_id ?? null,
      metadata: {
        bonus_kes: REFERRAL_BONUS_KES,
        referral_id: ref.id,
        referred_user_id: ref.referred_id ?? null,
      },
    });
    if (txErr) console.error("[webhook] referral_bonus transaction insert error:", txErr);

    await sendPushNotification(
      supabase,
      ref.referrer_id,
      "Referral bonus",
      `You earned +KSH ${REFERRAL_BONUS_KES} from a friend's first top up.`,
    );
    await maybeSendMoneySmsAlert(
      supabase,
      ref.referrer_id,
      `Yuto: Referral bonus +KSH ${REFERRAL_BONUS_KES} — a friend topped up for the first time.`,
    );
  } catch (e) {
    console.error("[webhook] referral convert/credit error:", e);
  }
}

async function processIntaSendWebhook(payload: {
  invoice_id?: string;
  state?: string;
  currency?: string;
  api_ref?: string;
  provider?: string;
  [key: string]: unknown;
}) {
  const state = payload.state;
  if (String(payload.currency || "").toUpperCase() !== "KES") return;
  if (state !== "COMPLETE") {
    // Helpful diagnostics for FAILED / PENDING / PROCESSING, etc.
    const reason =
      (payload as any).failed_reason ??
      (payload as any).failedReason ??
      (payload as any).reason ??
      (payload as any).message ??
      (payload as any).detail ??
      null;
    const code =
      (payload as any).failed_code ??
      (payload as any).failedCode ??
      (payload as any).code ??
      null;
    console.log("[webhook] non-complete event:", JSON.stringify({
      state,
      invoice_id: payload.invoice_id,
      api_ref: payload.api_ref,
      provider: payload.provider,
      code,
      reason,
    }));
    return;
  }

  const supabase = getSupabaseClient();

  const apiref = (payload.api_ref as string) ?? "";
  if (apiref.startsWith("TOPUP")) {
    // apiref format: "TOPUP" (5 chars) + 32 hex user id + numeric timestamp (charge.ts)
    const raw = apiref.slice(5, 37);
    if (!/^[a-f0-9]{32}$/i.test(raw)) {
      console.error("[webhook] Invalid TOPUP api_ref (expected 32 hex chars after TOPUP)", apiref);
      return;
    }
    const uid = `${raw.slice(0,8)}-${raw.slice(8,12)}-${raw.slice(12,16)}-${raw.slice(16,20)}-${raw.slice(20)}`;
    let amount = extractKesAmount(payload as any);
    if (!amount && payload.invoice_id) {
      amount = await fetchAmountFromStatus(String(payload.invoice_id));
    }
    if (amount > 0) {
      // Idempotency: skip if this invoice_id was already processed
      if (payload.invoice_id) {
        const { data: existingTx } = await supabase
          .from("transactions")
          .select("id")
          .eq("user_id", uid)
          .eq("kind", "topup")
          .eq("status", "settled")
          .filter("metadata->>'invoice_id'", "eq", String(payload.invoice_id))
          .maybeSingle();
        if (existingTx?.id) {
          console.log("[webhook] TOPUP already processed, skipping:", payload.invoice_id);
          return;
        }
      }

      const credited = await creditWalletBalance(supabase, uid, amount);
      if (!credited.ok) {
        console.error("[webhook] wallet credit failed:", credited);
        return;
      }
      // Canonical ledger entry — kind/note are the live columns, plus rich
      // metadata so the receipt modal can show the M-Pesa invoice id and the
      // exact provider used. Without this, the wallet history was silently
      // dropping every top-up because the legacy (type, description) columns
      // didn't match the schema.
      const { error: topupTxErr } = await supabase.from("transactions").insert({
        user_id: uid,
        amount,
        kind: "topup",
        note: `Top-up via M-PESA · KSH ${Math.round(amount).toLocaleString("en-KE")}`,
        method: "mpesa_stk",
        status: "settled",
        metadata: {
          provider: "intasend",
          invoice_id: payload.invoice_id ?? null,
          api_ref: apiref || null,
          mpesa_receipt: (payload as any)?.mpesa_reference ?? (payload as any)?.account ?? null,
          phone: (payload as any)?.account ?? (payload as any)?.account_number ?? null,
        },
      });
      if (topupTxErr) console.error("[webhook] topup transaction insert error:", topupTxErr);
      // If this is their first ever top-up conversion, reward referrer.
      await maybeConvertReferralOnFirstTopUp(supabase, uid);

      // Creator commission: if this user is attributed to a creator, pay them
      try {
        await supabase.rpc("process_creator_commission", {
          p_user_id: uid,
          p_trigger_type: "topup",
          p_amount: amount,
        });
      } catch (e) {
        console.error("[webhook] creator commission error:", e);
      }

      // Transfer Credits: rebate 1% top-up fee as transfer credits
      try {
        // Airtime rebate removed — credits scrapped
      } catch (e) {
        console.error("[webhook] topup post-processing error:", e);
      }

      await sendPushNotification(
        supabase,
        uid,
        "Top up received",
        `Your Yuto Balance was credited with KSH ${Math.round(amount).toLocaleString("en-KE")}.`,
      );
      await maybeSendMoneySmsAlert(
        supabase,
        uid,
        `Yuto: Top-up received. KSH ${Math.round(amount).toLocaleString("en-KE")} added to your balance.`,
      );
    } else {
      console.error("[webhook] TOPUP amount missing/zero:", {
        invoice_id: payload.invoice_id,
        api_ref: apiref,
        keys: Object.keys(payload),
      });
    }
    return;

  }

  let membershipTable: "group_members" | "function_members" | null = null;
  let parentTable: "groups" | "functions" | null = null;
  let parentIdColumn: "group_id" | "function_id" | null = null;
  let groupId: string | null = null;
  let userId: string | null = null;

  const membershipTables: Array<{
    table: "group_members" | "function_members";
    idColumn: "group_id" | "function_id";
  }> = [
    { table: "group_members", idColumn: "group_id" },
    { table: "function_members", idColumn: "function_id" },
  ];

  for (const entry of membershipTables) {
    if (groupId && userId) break;

    if (payload.invoice_id) {
      const { data: match, error: matchError } = await supabase
        .from(entry.table)
        .select(`${entry.idColumn}, user_id`)
        .eq("payment_invoice_id", payload.invoice_id)
        .maybeSingle();
      if (matchError) throw matchError;
      if (match) {
        membershipTable = entry.table;
        parentTable = entry.table === "group_members" ? "groups" : "functions";
        parentIdColumn = entry.idColumn;
        groupId = (match as any)[entry.idColumn] as string;
        userId = match.user_id;
        break;
      }
    }

    if (payload.api_ref) {
      const { data: match, error: matchError } = await supabase
        .from(entry.table)
        .select(`${entry.idColumn}, user_id`)
        .eq("payment_api_ref", payload.api_ref)
        .maybeSingle();
      if (matchError) throw matchError;
      if (match) {
        membershipTable = entry.table;
        parentTable = entry.table === "group_members" ? "groups" : "functions";
        parentIdColumn = entry.idColumn;
        groupId = (match as any)[entry.idColumn] as string;
        userId = match.user_id;
        break;
      }
    }
  }

  if (!membershipTable || !parentTable || !parentIdColumn || !groupId || !userId) {
    throw new Error(
      `Could not resolve membership for invoice_id=${payload.invoice_id} api_ref=${payload.api_ref}`,
    );
  }

  // Check if already paid (idempotency for retried webhooks)
  const { data: currentMember } = await supabase
    .from(membershipTable)
    .select("has_paid")
    .eq(parentIdColumn, groupId)
    .eq("user_id", userId)
    .maybeSingle();

  if (currentMember?.has_paid) {
    console.log(`Webhook: already paid for ${membershipTable} parent_id=${groupId} user_id=${userId} — skipping`);
    return;
  }

  const { error: updateError } = await supabase
    .from(membershipTable)
    .update({ has_paid: true, paid_at: new Date().toISOString() })
    .eq(parentIdColumn, groupId)
    .eq("user_id", userId);

  if (updateError) throw updateError;
  console.log(
    `Webhook: set has_paid=true for ${membershipTable} parent_id=${groupId} user_id=${userId}`,
  );

  if (membershipTable === "function_members") {
    try {
      const { data: fnRow } = await supabase
        .from("functions")
        .select("id, title, host_id, location")
        .eq("id", groupId)
        .maybeSingle();

      if (fnRow && fnRow.location !== "__SELL__" && fnRow.location !== "__SERVICE__") {
        const { data: existingLink } = await supabase
          .from("function_attendee_chats")
          .select("group_id")
          .eq("function_id", groupId)
          .maybeSingle();

        let chatGroupId = existingLink?.group_id as string | undefined;

        if (!chatGroupId) {
          const chatTitle = `${String(fnRow.title || "").trim() || "Function"} • Attendees`;
          const { data: chat, error: chatInsErr } = await supabase
            .from("group_chats")
            .insert({ created_by: fnRow.host_id, title: chatTitle })
            .select("id")
            .single();
          if (chatInsErr) throw chatInsErr;
          chatGroupId = chat.id as string;

          const { error: linkErr } = await supabase.from("function_attendee_chats").insert({
            function_id: groupId,
            group_id: chatGroupId,
          });
          if (linkErr) throw linkErr;

          const { data: paidMembers } = await supabase
            .from("function_members")
            .select("user_id")
            .eq("function_id", groupId)
            .eq("has_paid", true);

          const uidSet = new Set<string>([fnRow.host_id as string]);
          for (const row of paidMembers || []) uidSet.add((row as { user_id: string }).user_id);
          const memberRows = Array.from(uidSet).map((uid) => ({ group_id: chatGroupId as string, user_id: uid }));
          if (memberRows.length > 0) {
            const { error: memErr } = await supabase.from("group_chat_members").upsert(memberRows, {
              onConflict: "group_id,user_id",
            });
            if (memErr) throw memErr;
          }
        } else {
          const { error: memErr } = await supabase.from("group_chat_members").upsert(
            { group_id: chatGroupId, user_id: userId },
            { onConflict: "group_id,user_id" },
          );
          if (memErr) throw memErr;
        }

        // ── "X just joined!" system message in attendee chat ──
        // This creates social proof inside the chat — every new attendee
        // triggers a visible event that makes the group feel alive.
        if (chatGroupId) {
          const joinerName = await getDisplayName(supabase, userId);
          const { data: paidNow } = await supabase
            .from("function_members")
            .select("user_id")
            .eq("function_id", groupId)
            .eq("has_paid", true);
          const attendeeCount = (paidNow || []).length;
          const spotsLeft = typeof (fnRow as any).max_capacity === "number" && (fnRow as any).max_capacity > 0
            ? Math.max(0, (fnRow as any).max_capacity - attendeeCount)
            : null;
          const urgency = spotsLeft !== null && spotsLeft <= 5 && spotsLeft > 0
            ? ` · 🔥 ${spotsLeft} spot${spotsLeft === 1 ? "" : "s"} left!`
            : "";
          
          await supabase.from("group_chat_messages").insert({
            group_id: chatGroupId,
            sender_id: fnRow.host_id,
            content: `🎉 ${joinerName} just joined! (${attendeeCount} going${urgency})`,
            message_type: "text",
          });
        }
      }
    } catch (e) {
      console.error("[webhook] attendee chat provisioning failed:", e);
    }
  }

  // Push notification for hosts — emotionally charged to make hosting addictive
  try {
    const payerName = await getDisplayName(supabase, userId);
    const amount = extractKesAmount(payload as any) || (payload.invoice_id ? await fetchAmountFromStatus(String(payload.invoice_id)) : 0);
    if (membershipTable === "group_members") {
      const { data: group } = await supabase.from("groups").select("id, name, created_by").eq("id", groupId).maybeSingle();
      if (group?.created_by && group.created_by !== userId) {
        const hostPushTitle = "💰 Money in!";
        const hostPushBody = `${payerName} just paid KSH ${Math.round(amount || 0).toLocaleString("en-KE")} for ${group.name}`;
        await sendPushNotification(supabase, group.created_by, hostPushTitle, hostPushBody);
        await maybeSendMoneySmsAlert(
          supabase,
          group.created_by,
          `Yuto: ${payerName} paid KSH ${Math.round(amount || 0).toLocaleString("en-KE")} for ${group.name}.`,
        );
      }
    } else {
      const { data: fn } = await supabase.from("functions").select("id, title, host_id, max_capacity").eq("id", groupId).maybeSingle();
      if (fn?.host_id && fn.host_id !== userId) {
        // Count total paid to show running total in notification
        const { data: paidMembers } = await supabase
          .from("function_members")
          .select("user_id")
          .eq("function_id", groupId)
          .eq("has_paid", true);
        const totalPaid = (paidMembers || []).length;
        const totalEarned = totalPaid * (amount || 0);
        const spotsLeft = typeof fn.max_capacity === "number" && fn.max_capacity > 0
          ? Math.max(0, fn.max_capacity - totalPaid)
          : null;
        
        // Emotionally escalating notifications based on momentum
        let title = "💰 Cha-ching!";
        let body = `${payerName} is in for "${fn.title}"`;
        
        if (totalPaid === 1) {
          title = "🎉 First one in!";
          body = `${payerName} just locked in for "${fn.title}" — you're live!`;
        } else if (spotsLeft !== null && spotsLeft === 0) {
          title = "🔥 SOLD OUT!";
          body = `${payerName} grabbed the last spot for "${fn.title}"! ${totalPaid} people, KSH ${totalEarned.toLocaleString("en-KE")} earned.`;
        } else if (spotsLeft !== null && spotsLeft <= 3) {
          title = "🔥 Almost full!";
          body = `${payerName} is in — only ${spotsLeft} spot${spotsLeft === 1 ? "" : "s"} left for "${fn.title}"!`;
        } else if (totalPaid >= 10) {
          title = `🚀 ${fn.title} is popping!`;
          body = `${payerName} makes ${totalPaid} people in. KSH ${totalEarned.toLocaleString("en-KE")} earned so far.`;
        }

        await sendPushNotification(supabase, fn.host_id, title, body);
        await maybeSendMoneySmsAlert(
          supabase,
          fn.host_id,
          `Yuto: ${body}`,
        );
      }
    }
  } catch (e) {
    console.error("[webhook] host push notify error:", e);
  }

  const { data: members, error: membersError } = await supabase
    .from(membershipTable)
    .select("has_paid")
    .eq(parentIdColumn, groupId);

  if (membersError) throw membersError;

  if (members?.length && members.every((m) => m.has_paid)) {
    const nextStatus = parentTable === "functions" ? "funded" : "completed";
    const { error: groupError } = await supabase
      .from(parentTable)
      .update({ status: nextStatus })
      .eq("id", groupId);
    if (groupError) throw groupError;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    // Webhook signature verification — IntaSend sends a challenge header
    // Set INTASEND_WEBHOOK_SECRET in Vercel env to match your IntaSend dashboard
    const webhookSecret = process.env.INTASEND_WEBHOOK_SECRET;
    if (webhookSecret) {
      const challenge = req.headers["x-intasend-signature"] || req.headers["x-webhook-challenge"] || (req.body as any)?.challenge;
      if (!challenge || challenge !== webhookSecret) {
        console.error("[webhook] Invalid signature — rejected");
        return res.status(401).json({ error: "Invalid webhook signature" });
      }
    }

    const payload = req.body as {
      invoice_id?: string;
      state?: string;
      currency?: string;
      api_ref?: string;
      provider?: string;
      [key: string]: unknown;
    };

    console.log(
      "IntaSend webhook received:",
      JSON.stringify({
        state: payload.state,
        currency: payload.currency,
        invoice_id: payload.invoice_id,
        api_ref: payload.api_ref,
      }),
    );

    try {
      await processIntaSendWebhook(payload);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const cause = err instanceof Error && err.cause ? String(err.cause) : "";
      console.error("Webhook processing error:", msg, cause || "", err);
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Webhook handler error:", err);
    return res.status(200).json({ ok: true });
  }
}