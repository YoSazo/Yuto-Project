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
      `Missing Supabase env in og-creator: ${missing.join(", ")}. Use service role key (not anon) for server-side.`,
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const username = String(req.query.username || "").toLowerCase().trim();
  if (!username) return res.status(400).send("Missing username");

  try {
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from("profiles")
      .select("display_name, username")
      .eq("username", username)
      .maybeSingle();

    const name = data?.display_name || username;

    const W = 1200;
    const H = 630;

    const base = sharp({
      create: { width: W, height: H, channels: 3, background: "#0b0b0c" },
    });

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0B0B0C"/>
      <stop offset="0.5" stop-color="#1A1A2E"/>
      <stop offset="1" stop-color="#0B0B0C"/>
    </linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#F59E0B"/>
      <stop offset="1" stop-color="#EF4444"/>
    </linearGradient>
    <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="18" stdDeviation="18" flood-color="#000" flood-opacity="0.6"/>
    </filter>
  </defs>

  <rect x="0" y="0" width="${W}" height="${H}" fill="url(#bg)"/>
  <circle cx="600" cy="315" r="400" fill="url(#gold)" opacity="0.06"/>
  <circle cx="150" cy="500" r="200" fill="#F59E0B" opacity="0.08"/>

  <g filter="url(#shadow)">
    <rect x="72" y="72" rx="36" ry="36" width="${W - 144}" height="${H - 144}" fill="#111827" fill-opacity="0.7" stroke="#F59E0B" stroke-opacity="0.3" stroke-width="2"/>
  </g>

  <text x="110" y="165" font-size="26" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial" fill="#F59E0B" font-weight="800">
    👑 CREATOR PROGRAM
  </text>

  <text x="110" y="250" font-size="64" font-weight="900" letter-spacing="-1.5" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial" fill="#FFFFFF">
    Join ${escapeXml(name)}
  </text>

  <text x="110" y="320" font-size="38" font-weight="700" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial" fill="#D1D5DB">
    Earn from every user you bring. Forever.
  </text>

  <g>
    <rect x="110" y="365" rx="18" ry="18" width="320" height="56" fill="#F59E0B" fill-opacity="0.15" stroke="#F59E0B" stroke-opacity="0.3"/>
    <text x="140" y="402" font-size="26" font-weight="800" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial" fill="#F59E0B">
      70% → 100% revenue
    </text>
  </g>

  <g>
    <rect x="460" y="365" rx="18" ry="18" width="380" height="56" fill="#8B5CF6" fill-opacity="0.15" stroke="#8B5CF6" stroke-opacity="0.3"/>
    <text x="490" y="402" font-size="26" font-weight="800" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial" fill="#A78BFA">
      +30% from your recruits
    </text>
  </g>

  <g>
    <rect x="110" y="${H - 155}" rx="22" ry="22" width="340" height="60" fill="#000000" fill-opacity="0.45" stroke="#FFFFFF" stroke-opacity="0.14"/>
    <text x="140" y="${H - 115}" font-size="26" font-weight="900" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial" fill="#FFFFFF">
      yuto.social/c/${escapeXml(username)}
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
    console.error("og-creator error:", err);
    return res.status(500).send("Internal server error");
  }
}
