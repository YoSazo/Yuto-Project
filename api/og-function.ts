import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getSupabaseClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    const missing = [
      !SUPABASE_URL && "SUPABASE_URL or VITE_SUPABASE_URL",
      !SUPABASE_SERVICE_ROLE_KEY && "SUPABASE_SERVICE_ROLE_KEY",
    ].filter(Boolean);
    throw new Error(
      `Missing Supabase env in og-function: ${missing.join(", ")}. Use service role key (not anon) for server-side.`,
    );
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

function escapeXml(input: string) {
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

async function fetchAsBuffer(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const ab = await res.arrayBuffer();
    return Buffer.from(ab);
  } catch {
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const functionId = String(req.query.functionId || "");
  if (!functionId) return res.status(400).send("Missing functionId");

  const origin =
    (req.headers["x-forwarded-proto"] ? `${req.headers["x-forwarded-proto"]}://` : "https://") +
    (req.headers["x-forwarded-host"] || req.headers.host || "yuto.social");

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("functions")
      .select(
        `
        id,
        title,
        image_url,
        date,
        location,
        amount_per_person,
        max_capacity,
        host:profiles!functions_host_id_fkey ( display_name, username ),
        function_members ( id )
      `,
      )
      .eq("id", functionId)
      .single();

    if (error || !data) {
      return res.status(404).send("Not found");
    }

    const W = 1200;
    const H = 630;
    const coverUrl = data.image_url || `${origin}/icon-512.png`;
    const coverBuf = await fetchAsBuffer(coverUrl);

    const base = coverBuf
      ? sharp(coverBuf).resize(W, H, { fit: "cover" })
      : sharp({
          create: { width: W, height: H, channels: 3, background: "#0b0b0c" },
        });

    const hostName = data.host?.display_name || data.host?.username || "Someone";
    const title = data.title || "Function";
    const joinedCount = Array.isArray(data.function_members) ? data.function_members.length : 0;
    const spotsLeft =
      typeof data.max_capacity === "number" && data.max_capacity > 0
        ? Math.max(0, data.max_capacity - joinedCount)
        : null;
    const metaLine = `${formatShareDate(data.date)} · KSH ${Number(data.amount_per_person || 0).toLocaleString("en-KE")}${
      spotsLeft != null ? ` · ${spotsLeft} spots left` : ""
    }${data.location ? ` · ${data.location}` : ""}`;

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#000" stop-opacity="0.05"/>
      <stop offset="0.55" stop-color="#000" stop-opacity="0.55"/>
      <stop offset="1" stop-color="#000" stop-opacity="0.82"/>
    </linearGradient>
    <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="18" stdDeviation="18" flood-color="#000" flood-opacity="0.55"/>
    </filter>
  </defs>

  <rect x="0" y="0" width="${W}" height="${H}" fill="url(#g)"/>

  <g filter="url(#shadow)">
    <rect x="72" y="72" rx="34" ry="34" width="${W - 144}" height="${H - 144}" fill="#0B0B0C" fill-opacity="0.35" stroke="#FFFFFF" stroke-opacity="0.12" stroke-width="2"/>
  </g>

  <text x="110" y="165" font-size="26" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial" fill="#E5E7EB" opacity="0.95">
    🎉 ${escapeXml(hostName)} is hosting a function
  </text>

  <text x="110" y="245" font-size="76" font-weight="800" letter-spacing="-1.5" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial" fill="#FFFFFF">
    ${escapeXml(title)}
  </text>

  <g>
    <rect x="110" y="288" rx="18" ry="18" width="${W - 220}" height="74" fill="#FFFFFF" fill-opacity="0.10" stroke="#FFFFFF" stroke-opacity="0.14"/>
    <text x="140" y="338" font-size="30" font-weight="700" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial" fill="#F3F4F6">
      ${escapeXml(metaLine)}
    </text>
  </g>

  <g>
    <rect x="110" y="${H - 160}" rx="22" ry="22" width="250" height="64" fill="#000000" fill-opacity="0.45" stroke="#FFFFFF" stroke-opacity="0.14"/>
    <text x="140" y="${H - 118}" font-size="28" font-weight="800" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial" fill="#FFFFFF">
      yuto.social
    </text>
  </g>
</svg>`;

    const png = await base
      .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
      .png({ quality: 90 })
      .toBuffer();

    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800");
    return res.status(200).send(png);
  } catch (err) {
    console.error("og-function error:", err);
    return res.status(500).send("Internal server error");
  }
}

