import type { VercelRequest } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Extracts and verifies the Supabase auth token from the request.
 * Returns the authenticated user's ID, or null if not authenticated.
 * 
 * The client sends the token via:
 *   Authorization: Bearer <access_token>
 * 
 * This uses the service role key to verify the JWT without needing
 * the user's session — we just decode and validate.
 */
export async function getAuthenticatedUserId(req: VercelRequest): Promise<string | null> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) return null;
    
    const token = authHeader.slice(7);
    if (!token || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) return null;
    return user.id;
  } catch {
    return null;
  }
}
