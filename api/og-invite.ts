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
      `Missing Supabase env in og-invite: ${missing.join(", ")}. Use service role key (not anon) for server-side.`,
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
      <stop offset="1" stop-color="#0F172A"/>
    </linearGradient>
    <linearGradient id="card" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#111827" stop-opacity="0.82"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0.55"/>
    </linearGradient>
    <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="18" stdDeviation="18" flood-color="#000" flood-opacity="0.6"/>
    </filter>
  </defs>

  <rect x="0" y="0" width="${W}" height="${H}" fill="url(#bg)"/>
  <circle cx="1020" cy="120" r="240" fill="#22c55e" opacity="0.12"/>
  <circle cx="980" cy="520" r="320" fill="#5493b3" opacity="0.12"/>

  <g filter="url(#shadow)">
    <rect x="72" y="72" rx="36" ry="36" width="${W - 144}" height="${H - 144}" fill="url(#card)" stroke="#FFFFFF" stroke-opacity="0.12" stroke-width="2"/>
  </g>

  <text x="110" y="170" font-size="28" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial" fill="#E5E7EB" opacity="0.95">
    🚗 Pay together on Yuto
  </text>

  <text x="110" y="255" font-size="74" font-weight="900" letter-spacing="-1.5" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial" fill="#FFFFFF">
    Join ${escapeXml(name)}
  </text>

  <text x="110" y="318" font-size="32" font-weight="700" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial" fill="#D1D5DB">
    and get started in 30 seconds
  </text>

  <g>
    <rect x="110" y="360" rx="22" ry="22" width="${W - 220}" height="84" fill="#FFFFFF" fill-opacity="0.10" stroke="#FFFFFF" stroke-opacity="0.14"/>
    <text x="145" y="414" font-size="30" font-weight="800" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial" fill="#F3F4F6">
      ${escapeXml(name)} earns KSH 10 when you top up
    </text>
  </g>

  <g>
    <rect x="110" y="${H - 160}" rx="22" ry="22" width="340" height="64" fill="#000000" fill-opacity="0.40" stroke="#FFFFFF" stroke-opacity="0.14"/>
    <text x="140" y="${H - 118}" font-size="28" font-weight="900" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial" fill="#FFFFFF">
      yuto.social/i/${escapeXml(username)}
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
    console.error("og-invite error:", err);
    return res.status(500).send("Internal server error");
  }
}

