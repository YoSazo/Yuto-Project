import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getSupabaseClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Missing Supabase env vars");
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

function escapeHtml(input: string) {
  return input.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const planId = String(req.query.planId || "");
  if (!planId) return res.status(400).send("Missing planId");

  const origin = (req.headers["x-forwarded-proto"] ? `${req.headers["x-forwarded-proto"]}://` : "https://") + (req.headers["x-forwarded-host"] || req.headers.host || "yuto.social");
  const canonicalUrl = `${origin}/plan/${encodeURIComponent(planId)}`;

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("plans")
      .select(`id, title, amount, slots, creator:profiles!plans_creator_id_fkey(display_name, username), plan_members(id)`)
      .eq("id", planId)
      .single();

    const creatorName = data?.creator?.display_name || data?.creator?.username || "Someone";
    const title = data?.title || "A plan on Yuto";
    const memberCount = Array.isArray(data?.plan_members) ? data.plan_members.length : 0;
    const ogTitle = `${creatorName} is planning "${title}" 🎉`;
    const ogDesc = data?.amount
      ? `${memberCount} people in · KSH ${Number(data.amount).toLocaleString("en-KE")} · Join the crew on Yuto`
      : `${memberCount} people in · Join the crew on Yuto`;

    const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(ogTitle)}</title>
    <meta name="description" content="${escapeHtml(ogDesc)}" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${escapeHtml(ogTitle)}" />
    <meta property="og:description" content="${escapeHtml(ogDesc)}" />
    <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
    <meta property="og:image" content="${origin}/icon-512.png" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${escapeHtml(ogTitle)}" />
    <meta name="twitter:description" content="${escapeHtml(ogDesc)}" />
    <meta name="theme-color" content="#000000" />
    <meta http-equiv="refresh" content="0; url=${escapeHtml(canonicalUrl)}" />
    <script>window.location.replace("${escapeHtml(canonicalUrl)}");</script>
  </head>
  <body></body>
</html>`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400");
    return res.status(200).send(html);
  } catch (err) {
    console.error("share-plan error:", err);
    return res.status(500).send("Internal server error");
  }
}
