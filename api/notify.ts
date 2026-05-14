import type { VercelRequest, VercelResponse } from "@vercel/node";
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";
import { getAuthenticatedUserId } from "./_auth.js";

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function initWebPush() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails("mailto:support@yuto.app", publicKey, privateKey);
  return true;
}

// ── Rate Limiting (in-memory, per-user, 10 req/min) ──────────

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(userId, { count: 1, windowStart: now });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }

  entry.count++;
  return true;
}

// ── Relationship Check ───────────────────────────────────────

async function hasTransactionRelationship(senderId: string, targetUserId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("transactions")
    .select("id")
    .or(
      `and(user_id.eq.${senderId},counterparty_id.eq.${targetUserId}),` +
      `and(user_id.eq.${targetUserId},counterparty_id.eq.${senderId})`
    )
    .limit(1);

  return !error && !!data && data.length > 0;
}

// ── Handler ──────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // Auth: require a valid logged-in user (prevents anonymous spam)
  const authUserId = await getAuthenticatedUserId(req);
  if (!authUserId) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  const { userId, title, body } = req.body;
  if (!userId || !title || !body) return res.status(400).json({ error: "Missing fields" });

  // Rate limiting: max 10 notifications per minute per user
  if (!checkRateLimit(authUserId)) {
    return res.status(429).json({ error: "Rate limit exceeded" });
  }

  // Relationship check: only notify users you've transacted with
  const hasRelationship = await hasTransactionRelationship(authUserId, userId);
  if (!hasRelationship) {
    return res.status(403).json({ error: "No transaction relationship with target user" });
  }

  if (!initWebPush()) return res.status(200).json({ message: "Push not configured" });

  try {
    const { data: tokenRow } = await supabase
      .from("push_tokens")
      .select("token")
      .eq("user_id", userId)
      .maybeSingle();

    if (!tokenRow?.token) return res.status(200).json({ message: "No token found" });

    const subscription = JSON.parse(tokenRow.token);
    await webpush.sendNotification(subscription, JSON.stringify({ title, body }));

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("Push notification error:", err);
    return res.status(500).json({ error: "Failed to send notification" });
  }
}
