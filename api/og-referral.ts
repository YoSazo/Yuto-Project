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
      `Missing Supabase env in og-referral: ${missing.join(", ")}. Use service role key (not anon) for server-side.`,
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
      <stop offset="0" stop-color="#7C3AED"/>
      <stop offset="1" stop-color="#EC4899"/>
    </linearGradient>
    <linearGradient id="card" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#000000" stop-opacity="0.35"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0.55"/>
    </linearGradient>
    <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="18" stdDeviation="18" flood-color="#000" flood-opacity="0.6"/>
    </filter>
  </defs>

  <rect x="0" y="0" width="${W}" height="${H}" fill="url(#bg)"/>
  <circle cx="200" cy="100" r="200" fill="#FFFFFF" opacity="0.08"/>
  <circle cx="1000" cy="500" r="280" fill="#FFFFFF" opacity="0.06"/>

  <g filter="url(#shadow)">
    <rect x="72" y="72" rx="36" ry="36" width="${W - 144}" height="${H - 144}" fill="url(#card)" stroke="#FFFFFF" stroke-opacity="0.15" stroke-width="2"/>
  </g>

  <text x="110" y="170" font-size="28" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial" fill="#FFFFFF" opacity="0.85">
    😏 Challenge accepted?
  </text>

  <text x="110" y="260" font-size="62" font-weight="900" letter-spacing="-1.5" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial" fill="#FFFFFF">
    ${escapeXml(name)} is about to
  </text>

  <text x="110" y="335" font-size="62" font-weight="900" letter-spacing="-1.5" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial" fill="#FFFFFF">
    earn KSH 10 from you
  </text>

  <g>
    <rect x="110" y="380" rx="22" ry="22" width="${W - 220}" height="74" fill="#FFFFFF" fill-opacity="0.12" stroke="#FFFFFF" stroke-opacity="0.18"/>
    <text x="145" y="428" font-size="28" font-weight="700" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial" fill="#FFFFFF">
      Sign up and earn KSH 10 too by inviting YOUR friends
    </text>
  </g>

  <g>
    <rect x="110" y="${H - 155}" rx="22" ry="22" width="340" height="60" fill="#000000" fill-opacity="0.45" stroke="#FFFFFF" stroke-opacity="0.18"/>
    <text x="140" y="${H - 115}" font-size="26" font-weight="900" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial" fill="#FFFFFF">
      yuto.social/r/${escapeXml(username)}
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
    console.error("og-referral error:", err);
    return res.status(500).send("Internal server error");
  }
}
