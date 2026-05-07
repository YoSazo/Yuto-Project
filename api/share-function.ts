import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getSupabaseClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    const missing = [
      !SUPABASE_URL && "SUPABASE_URL or VITE_SUPABASE_URL",
      !SUPABASE_SERVICE_ROLE_KEY && "SUPABASE_SERVICE_ROLE_KEY",
    ].filter(Boolean);
    throw new Error(
      `Missing Supabase env in share-function: ${missing.join(", ")}. Use service role key (not anon) for server-side.`,
    );
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

function escapeHtml(input: string) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatShareDate(dateValue: string | null) {
  if (!dateValue) return "Anytime";
  try {
    return new Date(dateValue).toLocaleDateString("en-KE", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "Anytime";
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const functionId = String(req.query.functionId || "");
  if (!functionId) {
    return res.status(400).send("Missing functionId");
  }

  const origin = (req.headers["x-forwarded-proto"] ? `${req.headers["x-forwarded-proto"]}://` : "https://") + (req.headers["x-forwarded-host"] || req.headers.host || "yuto.social");
  const canonicalUrl = `${origin}/function/${encodeURIComponent(functionId)}`;

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("functions")
      .select(
        `
        id,
        title,
        description,
        image_url,
        date,
        location,
        amount_per_person,
        max_capacity,
        host:profiles!functions_host_id_fkey ( id, display_name, username, avatar_url ),
        function_members ( id )
      `,
      )
      .eq("id", functionId)
      .single();

    if (error || !data) {
      const title = "Yuto";
      const description = "Pay together with friends using M-PESA";
      const fallbackOg = `${origin}/og/function/${encodeURIComponent(functionId)}.png`;
      const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
    <meta property="og:image" content="${escapeHtml(fallbackOg)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${escapeHtml(fallbackOg)}" />
    <meta http-equiv="refresh" content="0; url=${escapeHtml(canonicalUrl)}" />
  </head>
  <body></body>
</html>`;
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.status(200).send(html);
    }

    const hostName = data.host?.display_name || data.host?.username || "Someone";
    const titleLine = `🎉 ${hostName} is hosting a ${data.title}`;
    const joinedCount = Array.isArray(data.function_members) ? data.function_members.length : 0;
    const spotsLeft =
      typeof data.max_capacity === "number" && data.max_capacity > 0
        ? Math.max(0, data.max_capacity - joinedCount)
        : null;

    const subLine = `${formatShareDate(data.date)} · KSH ${Number(data.amount_per_person || 0).toLocaleString("en-KE")} ${
      spotsLeft != null ? `· ${spotsLeft} spots left` : ""
    }`.trim();

    const ogImageUrl = `${origin}/og/function/${encodeURIComponent(functionId)}.png`;

    const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(titleLine)}</title>
    <meta name="description" content="${escapeHtml(subLine)}" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${escapeHtml(titleLine)}" />
    <meta property="og:description" content="${escapeHtml(subLine)}" />
    <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
    <meta property="og:image" content="${escapeHtml(ogImageUrl)}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(titleLine)}" />
    <meta name="twitter:description" content="${escapeHtml(subLine)}" />
    <meta name="twitter:image" content="${escapeHtml(ogImageUrl)}" />
    <meta name="theme-color" content="#000000" />
    <meta http-equiv="refresh" content="0; url=${escapeHtml(canonicalUrl)}" />
  </head>
  <body></body>
</html>`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    // crawlers should refetch occasionally; HTML itself is tiny
    res.setHeader("Cache-Control", "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400");
    return res.status(200).send(html);
  } catch (err) {
    console.error("share-function error:", err);
    return res.status(500).send("Internal server error");
  }
}

