/**
 * ═══════════════════════════════════════════════════════════════
 * YUTO — ARCHITECTURE CHEAT SHEET
 * ═══════════════════════════════════════════════════════════════
 *
 * BALANCE: Always read from `wallets` table. Never `profiles.balance`.
 *   fetchYutoBalance() → wallets.balance
 *
 * PAYMENT FLOW (functions):
 *   joinFunction → payForFunctionWithLedger (RPC) → if fails → computeTopUpGap → top-up modal
 *
 * PAYMENT FLOW (splits):
 *   payForPlanWithLedger (RPC) → if fails → top-up modal
 *
 * CANCEL FLOW:
 *   cancel = refund each member + debit host. BOTH sides reversed.
 *
 * MESSAGE TYPES: 'text' | 'share' | 'charge'
 * SHARE PAYLOAD KINDS: plan | function | listing | group | wallet_offer | profile | highlight
 *
 * LISTING SENTINELS:
 *   location = '__SELL__' → marketplace listing
 *   location = '__SERVICE__' → service booking
 *   Regular string → event function
 *
 * AUTH: All /api/* calls use authFetch() which attaches Bearer token.
 * MONEY RPCs: All SECURITY DEFINER. Client cannot bypass.
 * AMOUNTS: Always Math.round() before passing to RPCs.
 *
 * DEV USER: f5f5da38-c839-4ce4-94fc-10f3854674e0
 * ═══════════════════════════════════════════════════════════════
 */

import { createClient } from "@supabase/supabase-js";
import { analytics } from "./analytics";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "placeholder-key";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Authenticated fetch wrapper for API calls.
 * Automatically includes the Supabase auth token so server-side
 * endpoints can verify the caller's identity.
 */
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(url, { ...options, headers });
}

// ─── Auth ────────────────────────────────────────────

export async function signUp(username: string, password: string, displayName: string) {
  const clean = username.toLowerCase().trim();
  const { data, error } = await supabase.auth.signUp({
    email: `${clean}@yuto.app`,
    password,
    options: { data: { username: clean, display_name: displayName.trim() } },
  });
  if (error) throw error;

  // Catch referral from sessionStorage redirect URL OR query parameter
  if (typeof window !== "undefined" && data.user) {
    let refUsername: string | null = null;
    
    // Check URL parameters first (e.g., ?ref=salah)
    const params = new URLSearchParams(window.location.search);
    refUsername = params.get("ref");
    
    // If no query param, check if they came from an invite screen redirect
    if (!refUsername) {
      const storedRedirect = sessionStorage.getItem("joinAfterAuth");
      if (storedRedirect && storedRedirect.startsWith("/invite/")) {
        refUsername = storedRedirect.split("/invite/")[1];
        sessionStorage.removeItem("joinAfterAuth");
      }
    }

    if (refUsername) {
      // Find the referrer by username
      const { data: refUser } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", refUsername.toLowerCase())
        .single();
        
      if (refUser) {
        // Log the referral (converted: false by default)
        // We use insert without throwing to avoid crashing signup if it fails
        await supabase.from("referrals").insert({
          referrer_id: refUser.id,
          referred_id: data.user.id
        });
      }
    }
  }

  return data;
}

export async function signIn(username: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: `${username.toLowerCase().trim()}@yuto.app`,
    password,
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

// ─── Profiles ────────────────────────────────────────

export async function getProfile(userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  if (error) throw error;
  return data;
}

/** Spendable ledger: reads `wallets` first (`user_id`, then row `id`); falls back to legacy `profiles.balance`. */
export async function fetchYutoBalance(userId: string): Promise<number> {
  const { data, error } = await supabase
    .from("wallets")
    .select("balance")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) console.error("[fetchYutoBalance]", error);
  const n = Number(data?.balance ?? 0);
  return Number.isFinite(n) ? n : 0;
}

const PHONE_STORAGE_PREFIX = "yuto_phone_number:";

export function getSavedPhoneNumber(userId: string) {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(`${PHONE_STORAGE_PREFIX}${userId}`);
}

/**
 * Normalize Kenyan phone numbers to 254XXXXXXXXX format.
 * Handles: 0712..., +254712..., 254712..., 712...
 */
export function normalizeMpesaNumber(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("0") && digits.length === 10) return "254" + digits.slice(1);
  if (digits.startsWith("254")) return digits;
  if (digits.length === 9) return "254" + digits;
  return digits;
}

export function setSavedPhoneNumber(userId: string, phoneNumber: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(`${PHONE_STORAGE_PREFIX}${userId}`, phoneNumber);
}

export async function saveProfilePhoneNumber(userId: string, phoneNumber: string) {
  const { error } = await supabase
    .from("profiles")
    .update({ phone_number: phoneNumber })
    .eq("id", userId);
  if (error) throw error;
  setSavedPhoneNumber(userId, phoneNumber);
}

export async function searchProfiles(query: string, currentUserId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .ilike("username", `%${query}%`)
    .neq("id", currentUserId)
    .limit(20);
  if (error) throw error;
  return data || [];
}

// ─── Friends ─────────────────────────────────────────

export async function getFriends(userId: string) {
  const { data, error } = await supabase
    .from("friendships")
    .select(
      `id, requester_id, addressee_id, status,
       requester:profiles!friendships_requester_id_fkey(id, username, display_name, avatar_url),
       addressee:profiles!friendships_addressee_id_fkey(id, username, display_name, avatar_url)`
    )
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
    .eq("status", "accepted");
  if (error) throw error;
  return data || [];
}

export async function getPendingRequests(userId: string) {
  const { data, error } = await supabase
    .from("friendships")
    .select(
      `id, requester_id, created_at,
       requester:profiles!friendships_requester_id_fkey(id, username, display_name, avatar_url)`
    )
    .eq("addressee_id", userId)
    .eq("status", "pending");
  if (error) throw error;
  return data || [];
}

// ─── Notifications ─────────────────────────────────────

export type AppNotification = {
  id: string;
  user_id: string;
  actor_id: string | null;
  type: string;
  title: string;
  body: string | null;
  reference_kind: string | null;
  reference_id: string | null;
  amount_kes: number | null;
  cta_label: string | null;
  cta_action: string | null;
  is_read: boolean;
  created_at: string;
  actor?: { id: string; username: string; display_name: string; avatar_url: string | null } | null;
};

export async function getMyNotifications(userId: string, limit = 60): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("*, actor:profiles!notifications_actor_id_fkey(id, username, display_name, avatar_url)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []) as any;
}

export async function getMyNotificationUnreadCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_read", false);
  if (error) throw error;
  return count || 0;
}

export async function markNotificationRead(notificationId: string, userId: string) {
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", notificationId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function markAllNotificationsRead(userId: string) {
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", userId)
    .eq("is_read", false);
  if (error) throw error;
}

export async function sendFriendRequest(fromId: string, toId: string) {
  const { data: existing } = await supabase
    .from("friendships")
    .select("id")
    .or(
      `and(requester_id.eq.${fromId},addressee_id.eq.${toId}),and(requester_id.eq.${toId},addressee_id.eq.${fromId})`
    )
    .limit(1);

  if (existing && existing.length > 0) {
    throw new Error("Friend request already exists");
  }

  const { error } = await supabase
    .from("friendships")
    .insert({ requester_id: fromId, addressee_id: toId });
  if (error) throw error;
}

export async function respondToFriendRequest(friendshipId: string, accept: boolean) {
  const { error } = await supabase
    .from("friendships")
    .update({ status: accept ? "accepted" : "declined" })
    .eq("id", friendshipId);
  if (error) throw error;
}

// ─── Groups ──────────────────────────────────────────

export async function createGroup(
  name: string,
  totalAmount: number,
  perPerson: number,
  createdBy: string,
  memberIds: string[],
  groupType: "single" | "multi" = "single"
) {
  // Step 1: Insert the group
  const { data: group, error: groupError } = await supabase
    .from("groups")
    .insert({
      name,
      total_amount: totalAmount,
      per_person: perPerson,
      created_by: createdBy,
      group_type: groupType,
      status: "active",
    })
    .select()
    .single();

  if (groupError) throw groupError;

  // Step 3: Insert creator first so RLS on group_members select works for future queries
  const creatorMember = {
    group_id: group.id,
    user_id: createdBy,
    has_joined: true,
    joined_at: new Date().toISOString(),
  };
  const { error: creatorError } = await supabase.from("group_members").insert(creatorMember);
  if (creatorError) throw creatorError;

  // Step 4: Insert remaining members
  const otherMembers = memberIds
    .filter((uid) => uid !== createdBy)
    .map((uid) => ({
      group_id: group.id,
      user_id: uid,
      has_joined: false,
      joined_at: null,
    }));

  if (otherMembers.length > 0) {
    const { error: membersError } = await supabase.from("group_members").insert(otherMembers);
    if (membersError) throw membersError;
  }

  return group;
}

export async function submitRideAmount(groupId: string, userId: string, rideAmount: number) {
  // Update this member's ride_amount
  const { error: memberError } = await supabase
    .from("group_members")
    .update({ ride_amount: rideAmount })
    .eq("group_id", groupId)
    .eq("user_id", userId);
  if (memberError) throw memberError;

  // Recalculate total and per_person from all submitted ride amounts
  const { data: members, error: fetchError } = await supabase
    .from("group_members")
    .select("ride_amount")
    .eq("group_id", groupId);
  if (fetchError) throw fetchError;

  const submitted = members.filter((m) => m.ride_amount !== null);
  const total = submitted.reduce((sum, m) => sum + (m.ride_amount || 0), 0);
  const perPerson = members.length > 0 ? Math.ceil(total / members.length) : 0;

  // Update the group totals (any member can trigger this, but only creator RLS allows group update)
  // We use service-side logic: the update will silently succeed if user is creator, or be ignored if not
  // The correct fix is an RLS policy that allows any group member to update total_amount/per_person
  await supabase
    .from("groups")
    .update({ total_amount: total, per_person: perPerson })
    .eq("id", groupId);
}

export async function cancelSplitGroup(groupId: string) {
  const { data, error } = await supabase.rpc("cancel_split_group", {
    p_group_id: groupId,
  });
  if (error) throw error;
  return data;
}

export async function leaveSplitGroup(groupId: string, userId: string) {
  const { data, error } = await supabase.rpc("leave_split_group", {
    p_group_id: groupId,
    p_user_id: userId,
  });
  if (error) throw error;
  return data;
}

export async function getMyGroups() {
  const { data, error } = await supabase
    .from("groups")
    .select(
      `*, group_members(user_id, has_joined, has_paid, profiles(id, username, display_name))`
    )
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getMyTicketsAndPurchases(userId: string) {
  const { data, error } = await supabase
    .from("function_members")
    .select(
      `
      id,
      function_id,
      user_id,
      has_paid,
      joined_at,
      paid_at,
      functions!inner(
        *,
        host:profiles!functions_host_id_fkey(id, username, display_name, avatar_url),
        function_members(id, user_id, has_paid, joined_at, paid_at, buyer_confirmed_at, profiles(id, username, display_name, avatar_url))
      )
    `,
    )
    .eq("user_id", userId)
    .eq("has_paid", true)
    .order("paid_at", { ascending: false });
  if (error) throw error;

  const rows = (data || []) as any[];
  const byFunctionId: Record<string, { count: number; functionItem: any }> = {};
  rows.forEach((r) => {
    const f = r.functions;
    const fid = String(r.function_id || f?.id || "");
    if (!fid || !f) return;
    if (!byFunctionId[fid]) byFunctionId[fid] = { count: 0, functionItem: f };
    byFunctionId[fid]!.count += 1;
  });

  return Object.entries(byFunctionId).map(([functionId, v]) => ({
    function_id: functionId,
    count: v.count,
    functionItem: v.functionItem,
  }));
}

export async function confirmListingReceipt(functionId: string, userId: string) {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("function_members")
    .update({ buyer_confirmed_at: now })
    .eq("function_id", functionId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function getGroup(groupId: string) {
  const { data, error } = await supabase
    .from("groups")
    .select(
      `*, group_members(id, user_id, has_joined, has_paid, ride_amount, profiles(id, username, display_name, avatar_url))`
    )
    .eq("id", groupId)
    .single();
  if (error) throw error;
  return data;
}

export async function joinGroup(groupId: string, userId: string) {
  const { error } = await supabase
    .from("group_members")
    .update({ has_joined: true, joined_at: new Date().toISOString() })
    .eq("group_id", groupId)
    .eq("user_id", userId);
  if (error) throw error;
}

// DO NOT REVIVE: a manual "I paid in cash" toggle was intentionally removed.
// Yuto's business model relies on liquidity moving through the platform —
// either Yuto Balance or an M-Pesa STK push. Letting users self-report cash
// settlement bleeds float, breaks the audit trail, and invites disputes
// inside group chats. If a user paid outside the app, that's between them
// and their friend; the platform does not record it. Splits are only
// cleared by a real on-platform transfer (which sets has_paid via the
// pay_for_function_group RPC or wallet group payment flow).

// ─── Avatar Upload ────────────────────────────────────

export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop();
  const path = `${userId}/avatar.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  const avatarUrl = `${data.publicUrl}?t=${Date.now()}`;

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ avatar_url: avatarUrl })
    .eq("id", userId);
  if (updateError) throw updateError;

  return avatarUrl;
}

export async function uploadPlanImage(creatorId: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${creatorId}/${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("plan-images")
    .upload(path, file, { upsert: false, contentType: file.type });
  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from("plan-images").getPublicUrl(path);
  return `${data.publicUrl}?t=${Date.now()}`;
}

export async function uploadPlanOrFunctionMedia(ownerId: string, kind: "plan" | "function" | "group", file: File): Promise<string> {
  const ext = file.name.split(".").pop() || "bin";
  const path = `${ownerId}/${kind}/${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from("plan-images")
    .upload(path, file, { upsert: false, contentType: file.type });
  if (uploadError) throw uploadError;
  const { data } = supabase.storage.from("plan-images").getPublicUrl(path);
  return `${data.publicUrl}?t=${Date.now()}`;
}

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Failed to encode image"))), type, quality);
  });
}

async function createImageThumb(file: File, maxSize = 420): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Image load failed"));
    });
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    const scale = Math.min(1, maxSize / Math.max(w, h));
    const tw = Math.max(1, Math.round(w * scale));
    const th = Math.max(1, Math.round(h * scale));
    const canvas = document.createElement("canvas");
    canvas.width = tw;
    canvas.height = th;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No 2D context");
    ctx.drawImage(img, 0, 0, tw, th);
    return await canvasBlob(canvas, "image/webp", 0.78);
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function createVideoPoster(file: File, maxSize = 420): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    v.playsInline = true;
    v.src = url;
    await new Promise<void>((resolve, reject) => {
      v.onloadedmetadata = () => resolve();
      v.onerror = () => reject(new Error("Video metadata load failed"));
    });
    const t = Math.min(0.2, Number.isFinite(v.duration) && v.duration > 0 ? v.duration * 0.02 : 0.2);
    v.currentTime = t;
    await new Promise<void>((resolve, reject) => {
      v.onseeked = () => resolve();
      v.onerror = () => reject(new Error("Video seek failed"));
    });
    const w = v.videoWidth || 640;
    const h = v.videoHeight || 360;
    const scale = Math.min(1, maxSize / Math.max(w, h));
    const tw = Math.max(1, Math.round(w * scale));
    const th = Math.max(1, Math.round(h * scale));
    const canvas = document.createElement("canvas");
    canvas.width = tw;
    canvas.height = th;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No 2D context");
    ctx.drawImage(v, 0, 0, tw, th);
    return await canvasBlob(canvas, "image/webp", 0.78);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function uploadHighlightAsset(
  userId: string,
  file: File,
): Promise<{ url: string; thumb_url: string; poster_url: string | null }> {
  const ext = file.name.split(".").pop() || "bin";
  const base = `${userId}/highlights/${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const fullPath = `${base}.${ext}`;
  const { error: uploadError } = await supabase.storage.from("plan-images").upload(fullPath, file, { upsert: false, contentType: file.type });
  if (uploadError) throw uploadError;
  const { data: fullPub } = supabase.storage.from("plan-images").getPublicUrl(fullPath);
  const fullUrl = `${fullPub.publicUrl}?t=${Date.now()}`;

  const isVideo = file.type.startsWith("video/");
  const posterBlob = isVideo ? await createVideoPoster(file) : await createImageThumb(file);
  const posterPath = `${base}.thumb.webp`;
  const { error: thumbErr } = await supabase.storage.from("plan-images").upload(posterPath, posterBlob, {
    upsert: false,
    contentType: "image/webp",
  });
  if (thumbErr) throw thumbErr;
  const { data: thumbPub } = supabase.storage.from("plan-images").getPublicUrl(posterPath);
  const thumbUrl = `${thumbPub.publicUrl}?t=${Date.now()}`;

  // For videos, also treat thumb as poster for the ring/viewer placeholder.
  return { url: fullUrl, thumb_url: thumbUrl, poster_url: isVideo ? thumbUrl : null };
}

// ─── Functions ───────────────────────────────────────

const FUNCTIONS_SELECT = `
  *,
  host:profiles!functions_host_id_fkey(id, username, display_name, avatar_url),
  function_members(id, user_id, has_paid, joined_at, paid_at, buyer_confirmed_at, profiles(id, username, display_name, avatar_url)),
  media:function_media(id, media_url, media_type, sort_index)
`;

export async function getFunctionsPublic() {
  const { data, error } = await supabase
    .from("functions")
    .select(FUNCTIONS_SELECT)
    .eq("is_public", true)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getFunctionById(functionId: string) {
  const { data, error } = await supabase.from("functions").select(FUNCTIONS_SELECT).eq("id", functionId).single();
  if (error) throw error;
  return data;
}

export type FunctionMediaRow = {
  id: string;
  media_url: string;
  media_type: string;
  sort_index: number;
};

export type HostedFunctionItem = {
  id: string;
  title: string;
  date: string | null;
  location: string | null;
  amount_per_person: number;
  image_url: string | null;
  status: string;
  media: FunctionMediaRow[];
};

/** Hosted *event* functions (not __SELL__/__SERVICE__) for profile "Functions" tab. */
export async function getUserHostedFunctions(userId: string): Promise<HostedFunctionItem[]> {
  const { data, error } = await supabase
    .from("functions")
    .select(
      "id, title, date, location, amount_per_person, image_url, status, is_public, host_id, media:function_media(id, media_url, media_type, sort_index)",
    )
    .eq("host_id", userId)
    .in("status", ["open", "funded", "cancelled"])
    .neq("location", "__SELL__")
    .neq("location", "__SERVICE__")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data || []) as any[]).map((r) => ({
    id: r.id,
    title: r.title,
    date: r.date ?? null,
    location: r.location ?? null,
    amount_per_person: Number(r.amount_per_person) || 0,
    image_url: r.image_url ?? null,
    status: r.status ?? "open",
    media: ((r.media || []) as FunctionMediaRow[])
      .slice()
      .sort((a, b) => (a.sort_index ?? 0) - (b.sort_index ?? 0)),
  }));
}

export async function createFunction(
  hostId: string,
  title: string,
  description: string | null,
  date: string | null,
  location: string | null,
  amountPerPerson: number,
  maxCapacity: number | null,
  imageUrl?: string | null,
  mediaFiles?: File[],
) {
  const { data, error } = await supabase
    .from("functions")
    .insert({
      host_id: hostId,
      title,
      description,
      date,
      location,
      amount_per_person: amountPerPerson,
      max_capacity: maxCapacity,
      image_url: imageUrl || null,
      mode: "pay",
      is_public: true,
    })
    .select()
    .single();
  if (error) throw error;

  const files = (mediaFiles || []).slice(0, 3);
  if (data?.id && files.length > 0) {
    const urls = await Promise.all(files.map((f) => uploadPlanOrFunctionMedia(hostId, "function", f)));
    const { error: mErr } = await supabase.from("function_media").insert(
      urls.map((u, i) => ({
        function_id: data.id,
        media_url: u,
        media_type: files[i]!.type || "application/octet-stream",
        sort_index: i,
      })),
    );
    if (mErr) throw mErr;
    // Back-compat for places still reading image_url.
    if (!imageUrl) {
      await supabase.from("functions").update({ image_url: urls[0] }).eq("id", data.id);
      (data as any).image_url = urls[0];
    }
    (data as any).media = urls.map((u, i) => ({ id: "", media_url: u, media_type: files[i]!.type, sort_index: i }));
  }
  return data;
}

/**
 * Host tooling: re-run a Function with one tap.
 *
 * Most successful hosts run the same function weekly (Sunday lunch, Friday
 * football, Wednesday game night). Re-typing the title, description, capacity,
 * price, and re-uploading media every time was creating real drop-off — hosts
 * are *supply*, and supply that quits is the most expensive churn.
 *
 * This copies the source row's metadata and reuses the existing media URLs
 * (no re-upload, no extra storage cost). Date is bumped by `daysFromNow`
 * (default +7 = next week) and members reset; the new function is published
 * fresh so RSVP/payment state starts clean.
 */
export async function duplicateFunction(
  hostId: string,
  sourceFunctionId: string,
  daysFromNow = 7,
): Promise<{ id: string }> {
  const { data: src, error: srcErr } = await supabase
    .from("functions")
    .select(
      `id, host_id, title, description, location, amount_per_person, max_capacity, image_url, mode, is_public, date,
       media:function_media(media_url, media_type, sort_index)`,
    )
    .eq("id", sourceFunctionId)
    .single();
  if (srcErr) throw srcErr;
  if (!src) throw new Error("Function not found.");
  if (src.host_id !== hostId) throw new Error("Only the host can duplicate this function.");

  const newDate = src.date
    ? new Date(new Date(src.date).getTime() + daysFromNow * 24 * 60 * 60 * 1000).toISOString()
    : null;

  const { data: created, error: insErr } = await supabase
    .from("functions")
    .insert({
      host_id: hostId,
      title: src.title,
      description: src.description,
      date: newDate,
      location: src.location,
      amount_per_person: src.amount_per_person,
      max_capacity: src.max_capacity,
      image_url: src.image_url,
      mode: (src as any).mode || "pay",
      is_public: (src as any).is_public ?? true,
    })
    .select("id")
    .single();
  if (insErr) throw insErr;

  const media = ((src as any).media || []) as Array<{ media_url: string; media_type: string | null; sort_index: number }>;
  if (created?.id && media.length > 0) {
    const rows = media
      .slice(0, 3)
      .map((m, i) => ({
        function_id: created.id,
        media_url: m.media_url,
        media_type: m.media_type || "application/octet-stream",
        sort_index: m.sort_index ?? i,
      }));
    const { error: mErr } = await supabase.from("function_media").insert(rows);
    if (mErr) throw mErr;
  }

  return { id: created.id };
}

export async function joinFunction(functionId: string, userId: string) {
  const { error } = await supabase.from("function_members").upsert(
    {
      function_id: functionId,
      user_id: userId,
      joined_at: new Date().toISOString(),
    },
    { onConflict: "function_id,user_id" },
  );
  if (error) throw error;
}

export async function leaveFunction(functionId: string, userId: string) {
  const { error } = await supabase
    .from("function_members")
    .delete()
    .eq("function_id", functionId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function getFunctionMessages(functionId: string) {
  const { data, error } = await supabase
    .from("function_messages")
    .select(
      `id, function_id, user_id, content, created_at,
       profiles(id, username, display_name, avatar_url)`
    )
    .eq("function_id", functionId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function sendFunctionMessage(functionId: string, userId: string, content: string) {
  const response = await authFetch("/api/function-message", {
    method: "POST",
    body: JSON.stringify({ function_id: functionId, user_id: userId, content }),
  });

  const data = (await response.json()) as { success?: boolean; message?: string };
  if (!response.ok || !data.success) {
    throw new Error(data.message || "Couldn't send message. Try again.");
  }
}

export async function transferYutoBalance(fromUserId: string, toUserId: string, amountKes: number, note?: string | null) {
  const amount = Math.round(Number(amountKes || 0));
  const { error } = await supabase.rpc("transfer_yuto_balance", {
    p_to_user_id: toUserId,
    p_amount_kes: amount,
    p_note: note ?? null,
  });
  if (error) throw error;
  analytics.walletTransferSent({ amountKes: amount, toUserId });
}

// ─── Highlights ──────────────────────────────────────

export type Highlight = {
  id: string;
  user_id: string;
  slot: 1 | 2;
  created_at: string;
  photos: Array<{ id: string; url: string; thumb_url: string | null; poster_url: string | null; sort_index: 1 | 2 }>;
  commerce_payload?: any | null;
};

type HighlightDbRow = {
  id: string;
  user_id: string;
  slot: number;
  created_at: string;
  commerce_payload?: any | null;
  highlight_photos?: Array<{ id: string; url: string; thumb_url?: string | null; poster_url?: string | null; sort_index: number }>;
};

function mapHighlightRow(h: HighlightDbRow): Highlight {
  return {
    id: h.id,
    user_id: h.user_id,
    slot: (h.slot === 2 ? 2 : 1) as 1 | 2,
    created_at: h.created_at,
    commerce_payload: (h as any).commerce_payload ?? null,
    photos: (h.highlight_photos || [])
      .slice()
      .sort((a, b) => (a.sort_index ?? 1) - (b.sort_index ?? 1))
      .map((p) => ({
        id: p.id,
        url: p.url,
        thumb_url: p.thumb_url ?? null,
        poster_url: p.poster_url ?? null,
        sort_index: (p.sort_index === 2 ? 2 : 1) as 1 | 2,
      })),
  };
}

export async function getHighlightsByUser(userId: string): Promise<Highlight[]> {
  const { data, error } = await supabase
    .from("highlights")
    .select("id, user_id, slot, created_at, commerce_payload, highlight_photos(id, url, thumb_url, poster_url, sort_index)")
    .eq("user_id", userId)
    .order("slot", { ascending: true });
  if (error) throw error;
  const rows = (data || []) as HighlightDbRow[];
  return rows.map(mapHighlightRow);
}

export async function getHighlightById(highlightId: string): Promise<Highlight | null> {
  const { data, error } = await supabase
    .from("highlights")
    .select("id, user_id, slot, created_at, commerce_payload, highlight_photos(id, url, thumb_url, poster_url, sort_index)")
    .eq("id", highlightId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return mapHighlightRow(data as HighlightDbRow);
}

export async function createHighlight(
  userId: string,
  photos: [
    { url: string; thumb_url: string | null; poster_url: string | null },
    { url: string; thumb_url: string | null; poster_url: string | null },
  ],
  commercePayload?: any | null,
) {
  const existing = await getHighlightsByUser(userId);
  const used = new Set(existing.map((h) => h.slot));
  const slot: 1 | 2 = used.has(1) ? 2 : 1;
  if (used.has(slot)) throw new Error("You can only have 2 highlights.");

  const { data: highlight, error: hErr } = await supabase
    .from("highlights")
    .insert({ user_id: userId, slot, commerce_payload: commercePayload ?? null })
    .select("id, user_id, slot, created_at")
    .single();
  if (hErr) throw hErr;

  const { error: pErr } = await supabase.from("highlight_photos").insert([
    { highlight_id: highlight.id, url: photos[0].url, thumb_url: photos[0].thumb_url, poster_url: photos[0].poster_url, sort_index: 1 },
    { highlight_id: highlight.id, url: photos[1].url, thumb_url: photos[1].thumb_url, poster_url: photos[1].poster_url, sort_index: 2 },
  ]);
  if (pErr) throw pErr;

  return highlight;
}

/** Open sell/service listings on someone's profile storefront. */
export type StorefrontListingItem = {
  id: string;
  title: string;
  kind: "sell" | "service";
  amount_per_person: number;
  image_url: string | null;
  media: FunctionMediaRow[];
  listing_status?: "active" | "sold" | "paused" | null;
};

export async function getUserListings(userId: string, viewerId?: string | null): Promise<StorefrontListingItem[]> {
  let q = supabase
    .from("functions")
    .select(
      "id, title, location, amount_per_person, image_url, listing_status, media:function_media(id, media_url, media_type, sort_index)",
    )
    .eq("host_id", userId)
    .eq("status", "open")
    .in("location", ["__SELL__", "__SERVICE__"]);

  const { data, error } = await q.order("created_at", { ascending: false });
  if (error) throw error;
  const rows = ((data || []) as any[]).map((row) => ({
    id: row.id,
    title: row.title,
    kind: row.location === "__SELL__" ? ("sell" as const) : ("service" as const),
    amount_per_person: row.amount_per_person ?? 0,
    image_url: row.image_url ?? null,
    listing_status: (row.listing_status as StorefrontListingItem["listing_status"]) ?? "active",
    media: ((row.media || []) as FunctionMediaRow[])
      .slice()
      .sort((a, b) => (a.sort_index ?? 0) - (b.sort_index ?? 0)),
  }));
  if (viewerId && viewerId !== userId) {
    return rows.filter((r) => (r.listing_status ?? "active") === "active");
  }
  return rows;
}

export async function updateFunctionListingStatus(hostId: string, functionId: string, listingStatus: "active" | "sold" | "paused") {
  const { error } = await supabase.rpc("update_function_listing_status", {
    p_function_id: functionId,
    p_listing_status: listingStatus,
  });
  if (error) throw error;
}

/** Host marks a sell/service listing inactive (schema: `cancelled`). */
export async function cancelHostListing(hostId: string, functionId: string) {
  const { error } = await supabase.from("functions").update({ status: "cancelled" }).eq("id", functionId).eq("host_id", hostId);
  if (error) throw error;
}

/** One payer covers unpaid tickets for themselves + friends (event pay functions only). Pass friend user ids only; server merges payer. */
export async function payForFunctionGroup(functionId: string, coveredFriendUserIds: string[]) {
  const { error } = await supabase.rpc("pay_for_function_group", {
    p_function_id: functionId,
    p_covered_user_ids: coveredFriendUserIds,
  });
  if (error) throw error;
}

/**
 * Pays for a single function ticket via Yuto Balance.
 *
 * The RPC writes the wallet debit AND the canonical buyer/host transaction
 * rows in the same DB transaction (see migration
 * 20260608030000_transactions_full_receipt_metadata.sql, section F.1) so
 * either both succeed or neither does. The wrapper only exists for naming
 * symmetry with the rest of the codebase.
 */
export async function payForFunctionWithLedger(functionId: string): Promise<void> {
  const { error } = await supabase.rpc("pay_for_function", { p_function_id: functionId });
  if (error) throw error;
}

/**
 * Pays one share of a Yuto split via Yuto Balance.
 *
 * As with `payForFunctionWithLedger`, the RPC writes the payer outflow + group
 * owner inflow rows in the same DB transaction as the wallet debit, so the
 * receipt is guaranteed on success.
 */
export async function payForPlanWithLedger(
  groupId: string,
  amount: number,
  // Kept for source compatibility with old call sites; ignored — the RPC
  // derives plan/group context from group_id directly now.
  _ctx?: { planId?: string | null; planTitle?: string | null },
): Promise<void> {
  void _ctx;
  const { error } = await supabase.rpc("pay_for_plan", {
    p_group_id: groupId,
    p_amount: Math.round(amount),
  });
  if (error) throw error;
}

// ─── Plans ───────────────────────────────────────────

const PLANS_SELECT = `
  *,
  creator:profiles!plans_creator_id_fkey(id, username, display_name, avatar_url),
  plan_members(id, user_id, profiles(id, username, display_name, avatar_url)),
  media:plan_media(id, media_url, media_type, sort_index)
`;

/** All plans (public tab) */
export async function getPlansPublic() {
  const { data, error } = await supabase
    .from("plans")
    .select(PLANS_SELECT)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

/** Plans from you and your friends (friends tab) */
export async function getPlansFriends(userId: string) {
  const friends = await getFriends(userId);
  const friendIds = friends.map((f: { requester_id: string; addressee_id: string }) =>
    f.requester_id === userId ? f.addressee_id : f.requester_id
  );
  const creatorIds = [userId, ...friendIds];
  const { data, error } = await supabase
    .from("plans")
    .select(PLANS_SELECT)
    .in("creator_id", creatorIds)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

/** @deprecated Use getPlansPublic or getPlansFriends */
export async function getPlans(userId: string) {
  return getPlansFriends(userId);
}

export async function createPlan(
  creatorId: string,
  title: string,
  amount: number | null,
  slots: number | null,
  imageUrl?: string | null,
  mediaFiles?: File[],
) {
  const { data, error } = await supabase
    .from("plans")
    .insert({ creator_id: creatorId, title, amount, slots, image_url: imageUrl || null })
    .select()
    .single();
  if (error) throw error;

  const files = (mediaFiles || []).slice(0, 3);
  if (data?.id && files.length > 0) {
    const urls = await Promise.all(files.map((f) => uploadPlanOrFunctionMedia(creatorId, "plan", f)));
    const { error: mErr } = await supabase.from("plan_media").insert(
      urls.map((u, i) => ({
        plan_id: data.id,
        media_url: u,
        media_type: files[i]!.type || "application/octet-stream",
        sort_index: i,
      })),
    );
    if (mErr) throw mErr;
    if (!imageUrl) {
      await supabase.from("plans").update({ image_url: urls[0] }).eq("id", data.id);
      (data as any).image_url = urls[0];
    }
    (data as any).media = urls.map((u, i) => ({ id: "", media_url: u, media_type: files[i]!.type, sort_index: i }));
  }
  return data;
}

export async function joinPlan(planId: string, userId: string, joinerName: string, creatorId: string) {
  // Enforce slot limit before inserting
  const { data: plan } = await supabase
    .from("plans")
    .select("slots, plan_members(id)")
    .eq("id", planId)
    .single();
  
  if (plan?.slots != null) {
    const currentCount = (plan.plan_members || []).length;
    if (currentCount >= plan.slots) {
      throw new Error("This plan is full — no spots left.");
    }
  }

  const { error } = await supabase
    .from("plan_members")
    .insert({ plan_id: planId, user_id: userId });
  if (error) throw error;

  // Notify plan creator
  if (creatorId !== userId) {
    try {
      await authFetch("/api/notify", {
        method: "POST",
        body: JSON.stringify({
          userId: creatorId,
          title: "Yuto 🎉",
          body: `${joinerName} joined your Yuto!`,
        }),
      });
    } catch {
      // Notification failure shouldn't block join
    }
  }
}

export async function leavePlan(planId: string, userId: string) {
  const { error } = await supabase
    .from("plan_members")
    .delete()
    .eq("plan_id", planId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function yutoItPlan(planId: string, creatorId: string, title: string, amount: number, memberIds: string[]) {
  // Guard: check if plan was already "Yuto'd" (prevents duplicate splits)
  const { data: planCheck } = await supabase
    .from("plans")
    .select("yuto_group_id, status")
    .eq("id", planId)
    .single();
  
  if (planCheck?.yuto_group_id) {
    // Already has a group — return the existing one
    return { id: planCheck.yuto_group_id };
  }
  if (planCheck?.status === "completed") {
    throw new Error("This plan has already been locked in.");
  }

  // Create the group
  const group = await createGroup(title, amount, Math.ceil(amount / memberIds.length), creatorId, memberIds);
  // Mark plan as completed
  await supabase.from("plans").update({ status: "completed", yuto_group_id: group.id }).eq("id", planId);

  // Notify + DM members (best-effort)
  await Promise.all(
    memberIds
      .filter((uid) => uid && uid !== creatorId)
      .map(async (uid) => {
        try {
          await authFetch("/api/notify", {
            method: "POST",
            body: JSON.stringify({
              userId: uid,
              title: "Plan locked in 🎉",
              body: `"${title}" is locked in. Pay your share now.`,
            }),
          });
        } catch {
          // ignore
        }

        try {
          const convo = await getOrCreateDmConversation(creatorId, uid);
          await sendDmMessage(convo.id, creatorId, `The plan "${title}" is locked in! Pay your share here.`);
          await sendDmShareMessage(convo.id, creatorId, { kind: "group", group_id: group.id } as any);
        } catch {
          // ignore
        }
      }),
  );

  return group;
}

export async function deletePlan(planId: string) {
  const { error } = await supabase.from("plans").delete().eq("id", planId);
  if (error) throw error;
}

export async function addPlanUpdate(planId: string, creatorId: string, content: string) {
  const { error } = await supabase
    .from("plan_updates")
    .insert({ plan_id: planId, creator_id: creatorId, content });
  if (error) throw error;
}

export async function getPlanUpdates(planId: string) {
  const { data, error } = await supabase
    .from("plan_updates")
    .select("id, content, created_at, creator_id, profiles(display_name, avatar_url)")
    .eq("plan_id", planId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

export async function deletePlanUpdate(updateId: string) {
  const { error } = await supabase.from("plan_updates").delete().eq("id", updateId);
  if (error) throw error;
}

// ─── Push Notifications ──────────────────────────────

export async function savePushToken(userId: string, token: string) {
  const { error } = await supabase
    .from("push_tokens")
    .upsert({ user_id: userId, token, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) throw error;
}

// ─── Waitlist (existing) ─────────────────────────────

export async function addToWaitlist(phone: string, email?: string) {
  const { data, error } = await supabase.from("waitlist").insert([{ phone, email }]).select();
  if (error) throw error;
  return data;
}

export async function getWaitlistPosition(phone: string) {
  const { data, error } = await supabase
    .from("waitlist")
    .select("id")
    .eq("phone", phone)
    .single();
  if (error) throw error;
  return data?.id || 0;
}

export async function getPlanMessages(planId: string) {
  const { data, error } = await supabase
    .from("plan_messages")
    .select(`id, plan_id, user_id, content, created_at,
       profiles(id, username, display_name, avatar_url)`)
    .eq("plan_id", planId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function sendPlanMessage(planId: string, userId: string, content: string) {
  const response = await authFetch("/api/plan-message", {
    method: "POST",
    body: JSON.stringify({ plan_id: planId, user_id: userId, content }),
  });
  const data = (await response.json()) as { success?: boolean; message?: string };
  if (!response.ok || !data.success) {
    throw new Error(data.message || "Couldn't send message. Try again.");
  }
}

// ─── Direct Messages (1:1) ────────────────────────────

export type DmConversation = {
  id: string;
  user_low: string;
  user_high: string;
  created_at: string;
};

export type DmMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  message_type?: "text" | "share" | "charge";
  payload?: unknown;
  sender?: { id: string; username: string; display_name: string; avatar_url: string | null };
};

function canonicalPair(a: string, b: string) {
  return a < b ? { user_low: a, user_high: b } : { user_low: b, user_high: a };
}

export async function getOrCreateDmConversation(meId: string, otherUserId: string): Promise<DmConversation> {
  const { user_low, user_high } = canonicalPair(meId, otherUserId);

  const existing = await supabase
    .from("dm_conversations")
    .select("id, user_low, user_high, created_at")
    .eq("user_low", user_low)
    .eq("user_high", user_high)
    .maybeSingle();

  if (existing.error) throw existing.error;
  if (existing.data) return existing.data as DmConversation;

  const created = await supabase
    .from("dm_conversations")
    .insert({ user_low, user_high })
    .select("id, user_low, user_high, created_at")
    .single();
  if (created.error) throw created.error;
  return created.data as DmConversation;
}

export async function listMyDmConversations(meId: string) {
  const { data, error } = await supabase
    .from("dm_conversations")
    .select("id, user_low, user_high, created_at")
    .or(`user_low.eq.${meId},user_high.eq.${meId}`)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as DmConversation[];
}

export async function getDmMessages(conversationId: string) {
  const { data, error } = await supabase
    .from("dm_messages")
    .select(
      `id, conversation_id, sender_id, content, created_at, message_type, payload,
       sender:profiles!dm_messages_sender_id_fkey(id, username, display_name, avatar_url)`
    )
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data || []) as DmMessage[];
}

export async function sendDmMessage(conversationId: string, senderId: string, content: string, clientMessageId?: string) {
  const trimmed = content.trim();
  if (!trimmed) return;
  const row: Record<string, unknown> = {
    conversation_id: conversationId,
    sender_id: senderId,
    content: trimmed,
    message_type: "text",
  };
  if (clientMessageId) row.id = clientMessageId;
  const { error } = await supabase.from("dm_messages").insert(row);
  if (error) throw error;
}

export async function deleteDmMessage(messageId: string, senderId: string) {
  const { error } = await supabase.from("dm_messages").delete().eq("id", messageId).eq("sender_id", senderId);
  if (error) throw error;
}

export type DmSharePayload =
  | { kind: "plan"; plan_id: string }
  | { kind: "function"; function_id: string }
  | { kind: "listing"; function_id: string; listing_kind: "sell" | "service" }
  | { kind: "group"; group_id: string; amount_kes?: number; memo?: string; media_url?: string; media_type?: string }
  | { kind: "wallet_offer"; offer_id: string }
  | { kind: "profile"; user_id: string }
  | { kind: "highlight"; highlight_id: string; user_id: string };

export async function createWalletOffer(args: {
  amountKes: number;
  note?: string | null;
  dmConversationId?: string | null;
  groupChatId?: string | null;
  recipientUserId?: string | null;
}): Promise<string> {
  const { data, error } = await supabase.rpc("create_wallet_offer", {
    p_amount_kes: args.amountKes,
    p_note: args.note ?? null,
    p_dm_conversation_id: args.dmConversationId ?? null,
    p_group_chat_id: args.groupChatId ?? null,
    p_recipient_user_id: args.recipientUserId ?? null,
  });
  if (error) throw error;
  analytics.walletOfferCreated({
    amountKes: args.amountKes,
    surface: args.dmConversationId ? "dm" : "group",
  });
  return String(data);
}

export async function acceptWalletOffer(offerId: string) {
  const { error } = await supabase.rpc("accept_wallet_offer", { p_offer_id: offerId });
  if (error) throw error;
  // Amount unknown at this layer; we capture the event as a count signal.
  analytics.walletOfferAccepted({ amountKes: 0 });
}

export type WalletOfferRow = {
  id: string;
  sender_id: string;
  recipient_user_id: string | null;
  dm_conversation_id: string | null;
  group_chat_id: string | null;
  amount_kes: number;
  note: string | null;
  status: "pending" | "accepted" | "cancelled" | string;
  accepted_by: string | null;
  accepted_at: string | null;
  created_at: string;
  sender?: { id: string; username: string; display_name: string; avatar_url: string | null } | null;
  accepted_by_profile?: { id: string; username: string; display_name: string; avatar_url: string | null } | null;
};

export async function getWalletOfferById(offerId: string): Promise<WalletOfferRow | null> {
  const { data, error } = await supabase
    .from("wallet_offers")
    .select(
      `
      id,
      sender_id,
      recipient_user_id,
      dm_conversation_id,
      group_chat_id,
      amount_kes,
      note,
      status,
      accepted_by,
      accepted_at,
      created_at,
      sender:profiles!wallet_offers_sender_id_fkey(id,username,display_name,avatar_url),
      accepted_by_profile:profiles!wallet_offers_accepted_by_fkey(id,username,display_name,avatar_url)
    `,
    )
    .eq("id", offerId)
    .maybeSingle();
  if (error) throw error;
  return (data as any) || null;
}

export type PublicPost = {
  id: string;
  user_id: string;
  content_text: string;
  media_url: string | null;
  media_type: "image" | "video" | null;
  media_thumb_url: string | null;
  tag_payload: any | null;
  created_at: string;
  author: { id: string; username: string; display_name: string; avatar_url: string | null };
  media?: Array<{
    id: string;
    idx: number;
    media_url: string;
    media_type: "image" | "video";
    media_thumb_url: string | null;
  }>;
};

async function uploadPostMediaAsset(userId: string, file: File): Promise<{
  media_url: string;
  media_type: "image" | "video";
  media_thumb_url: string | null;
}> {
  const isVideo = file.type.startsWith("video/");
  const ext = file.name.split(".").pop() || (isVideo ? "mp4" : "jpg");
  const base = `${userId}/posts/${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const mediaPath = `${base}.${ext}`;

  const { error: uploadError } = await supabase.storage.from("plan-images").upload(mediaPath, file, {
    upsert: false,
    contentType: file.type,
  });
  if (uploadError) throw uploadError;

  const { data: fullPub } = supabase.storage.from("plan-images").getPublicUrl(mediaPath);
  const media_url = `${fullPub.publicUrl}?t=${Date.now()}`;

  const thumbBlob = isVideo ? await createVideoPoster(file) : await createImageThumb(file);
  const thumbPath = `${base}.thumb.webp`;
  const { error: thumbErr } = await supabase.storage.from("plan-images").upload(thumbPath, thumbBlob, {
    upsert: false,
    contentType: "image/webp",
  });
  if (thumbErr) throw thumbErr;

  const { data: thumbPub } = supabase.storage.from("plan-images").getPublicUrl(thumbPath);
  const media_thumb_url = `${thumbPub.publicUrl}?t=${Date.now()}`;

  return {
    media_url,
    media_type: isVideo ? "video" : "image",
    media_thumb_url,
  };
}

export async function createPublicPost(input: {
  userId: string;
  contentText: string;
  mediaFile?: File | null;
  mediaFiles?: File[] | null;
  tagPayload?: any | null;
}) {
  const content_text = input.contentText.trim();
  if (!content_text) throw new Error("Post text is required.");

  const files = (input.mediaFiles && input.mediaFiles.length > 0 ? input.mediaFiles : input.mediaFile ? [input.mediaFile] : [])
    .filter(Boolean)
    .slice(0, 5) as File[];

  // Keep legacy single-media columns populated for backward compat (first item only).
  let first_media_url: string | null = null;
  let first_media_type: "image" | "video" | null = null;
  let first_media_thumb_url: string | null = null;

  const uploadedItems = files.length
    ? await Promise.all(files.map((f) => uploadPostMediaAsset(input.userId, f)))
    : [];

  if (uploadedItems.length > 0) {
    first_media_url = uploadedItems[0].media_url;
    first_media_type = uploadedItems[0].media_type;
    first_media_thumb_url = uploadedItems[0].media_thumb_url;
  }

  const { data: postRow, error: postErr } = await supabase
    .from("public_posts")
    .insert({
      user_id: input.userId,
      content_text,
      media_url: first_media_url,
      media_type: first_media_type,
      media_thumb_url: first_media_thumb_url,
      tag_payload: input.tagPayload ?? null,
    })
    .select("id")
    .single();
  if (postErr) throw postErr;

  if (uploadedItems.length > 0) {
    const { error: mediaErr } = await supabase.from("public_post_media").insert(
      uploadedItems.map((u, idx) => ({
        post_id: postRow.id,
        idx,
        media_url: u.media_url,
        media_type: u.media_type,
        media_thumb_url: u.media_thumb_url,
      })),
    );
    if (mediaErr) throw mediaErr;
  }
}

export async function getPublicPosts(limit = 50): Promise<PublicPost[]> {
  const { data, error } = await supabase
    .from("public_posts")
    .select(
      "*, author:profiles!public_posts_user_id_fkey(id, username, display_name, avatar_url), media:public_post_media(id, idx, media_url, media_type, media_thumb_url)",
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;

  const rows = (data || []) as PublicPost[];
  // Ensure deterministic ordering of media array.
  rows.forEach((p) => {
    if (Array.isArray(p.media)) {
      p.media = [...p.media].sort((a, b) => (a.idx ?? 0) - (b.idx ?? 0));
    }
  });
  return rows;
}

export async function deletePublicPost(postId: string) {
  const { error } = await supabase.from("public_posts").delete().eq("id", postId);
  if (error) throw error;
}

export async function sendDmShareMessage(conversationId: string, senderId: string, payload: DmSharePayload) {
  const { error } = await supabase.from("dm_messages").insert({
    conversation_id: conversationId,
    sender_id: senderId,
    content: "",
    message_type: "share",
    payload,
  });
  if (error) throw error;
}

export type ListingDmChargeRow = {
  id: string;
  conversation_id: string;
  seller_id: string;
  buyer_id: string;
  amount_kes: number;
  release_mode: "trust" | "held";
  function_id: string | null;
  note: string | null;
  status: "pending" | "paid" | "released" | "cancelled";
  created_at: string;
  paid_at: string | null;
  released_at: string | null;
};

export async function createListingDmCharge(args: {
  conversationId: string;
  buyerId: string;
  amountKes: number;
  releaseMode: "trust" | "held";
  functionId?: string | null;
  note?: string | null;
}): Promise<string> {
  const { data, error } = await supabase.rpc("create_listing_dm_charge", {
    p_conversation_id: args.conversationId,
    p_buyer_id: args.buyerId,
    p_amount_kes: Math.round(args.amountKes),
    p_release_mode: args.releaseMode,
    p_function_id: args.functionId ?? null,
    p_note: args.note ?? null,
  });
  if (error) throw error;
  return String(data);
}

export async function sendDmChargeMessage(conversationId: string, senderId: string, chargeId: string) {
  const { error } = await supabase.from("dm_messages").insert({
    conversation_id: conversationId,
    sender_id: senderId,
    content: "",
    message_type: "charge",
    payload: { charge_id: chargeId },
  });
  if (error) throw error;
}

export async function getListingDmCharge(chargeId: string): Promise<ListingDmChargeRow | null> {
  const { data, error } = await supabase.from("listing_dm_charges").select("*").eq("id", chargeId).maybeSingle();
  if (error) throw error;
  return data as ListingDmChargeRow | null;
}

export async function payListingDmCharge(chargeId: string) {
  const { error } = await supabase.rpc("pay_listing_dm_charge", { p_charge_id: chargeId });
  if (error) throw error;
}

export async function releaseListingDmCharge(chargeId: string) {
  const { error } = await supabase.rpc("release_listing_dm_charge", { p_charge_id: chargeId });
  if (error) throw error;
}

export async function cancelListingDmCharge(chargeId: string) {
  const { error } = await supabase.rpc("cancel_listing_dm_charge", { p_charge_id: chargeId });
  if (error) throw error;
}

export async function getDmConversationContexts(conversationId: string) {
  const { data, error } = await supabase
    .from("dm_conversation_context")
    .select("id, conversation_id, provider_id, buyer_id, function_id, listing_kind, listing_title, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(5);
  if (error) throw error;
  return (data || []) as Array<{
    id: string;
    conversation_id: string;
    provider_id: string;
    buyer_id: string;
    function_id: string;
    listing_kind: "sell" | "service";
    listing_title: string;
    created_at: string;
  }>;
}

export async function countMutualFriends(userId: string, otherUserId: string): Promise<number> {
  const [a, b] = await Promise.all([getFriends(userId), getFriends(otherUserId)]);
  const setA = new Set<string>();
  for (const row of a as { requester_id: string; addressee_id: string }[]) {
    setA.add(row.requester_id === userId ? row.addressee_id : row.requester_id);
  }
  let n = 0;
  for (const row of b as { requester_id: string; addressee_id: string }[]) {
    const oid = row.requester_id === otherUserId ? row.addressee_id : row.requester_id;
    if (setA.has(oid)) n++;
  }
  return n;
}

/** Rough sold signal: settled purchase/booking received txs for this host. */
export async function countListingSalesForHost(hostId: string): Promise<number> {
  const { count, error } = await supabase
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", hostId)
    .in("kind", ["purchase_received", "booking_received"]);
  if (error) return 0;
  return count ?? 0;
}

export async function submitUserReport(targetUserId: string | null, reason: string, context?: string) {
  const { data: u } = await supabase.auth.getUser();
  const uid = u?.user?.id;
  if (!uid) throw new Error("Not signed in");
  const { error } = await supabase.from("user_reports").insert({
    reporter_id: uid,
    target_user_id: targetUserId,
    reason: reason.slice(0, 500),
    context: context?.slice(0, 2000) ?? null,
  });
  if (error) throw error;
}

export async function blockUser(blockedId: string) {
  const { data: u } = await supabase.auth.getUser();
  const uid = u?.user?.id;
  if (!uid) throw new Error("Not signed in");
  const { error } = await supabase.from("user_blocks").insert({ blocker_id: uid, blocked_id: blockedId });
  if (error) throw error;
}

export async function isUserBlockedEitherWay(userId: string, otherUserId: string): Promise<boolean> {
  const { data } = await supabase
    .from("user_blocks")
    .select("blocker_id")
    .or(
      `and(blocker_id.eq.${userId},blocked_id.eq.${otherUserId}),and(blocker_id.eq.${otherUserId},blocked_id.eq.${userId})`,
    )
    .maybeSingle();
  return !!data;
}

export type DmBusinessContext = {
  id: string;
  conversation_id: string;
  provider_id: string;
  buyer_id: string;
  function_id: string;
  listing_kind: "sell" | "service";
  listing_title: string;
  created_at: string;
};

export async function upsertDmBusinessContext(input: {
  conversation_id: string;
  provider_id: string;
  buyer_id: string;
  function_id: string;
  listing_kind: "sell" | "service";
  listing_title: string;
}) {
  const { error } = await supabase
    .from("dm_conversation_context")
    .upsert(input, { onConflict: "conversation_id,function_id" });
  if (error) throw error;
}

export async function listMyBusinessDmContexts(providerId: string) {
  const { data, error } = await supabase
    .from("dm_conversation_context")
    .select("id, conversation_id, provider_id, buyer_id, function_id, listing_kind, listing_title, created_at")
    .eq("provider_id", providerId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as DmBusinessContext[];
}

export async function markDmRead(conversationId: string, userId: string) {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("dm_reads")
    .upsert(
      { conversation_id: conversationId, user_id: userId, last_read_at: now, updated_at: now },
      { onConflict: "conversation_id,user_id" },
    );
  if (error) throw error;
}

/**
 * Mark a plan chat as read up to "now" for the current user. Mirrors markDmRead;
 * the inbox + bottom-nav badge consume `plan_reads.last_read_at` to decide
 * whether to show the unread dot, so this call is what dismisses it across
 * every device.
 */
export async function markPlanRead(planId: string, userId: string) {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("plan_reads")
    .upsert(
      { plan_id: planId, user_id: userId, last_read_at: now, updated_at: now },
      { onConflict: "plan_id,user_id" },
    );
  if (error) throw error;
}

/**
 * Function-chat counterpart of markPlanRead. Same shape, same semantics.
 */
export async function markFunctionRead(functionId: string, userId: string) {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("function_reads")
    .upsert(
      { function_id: functionId, user_id: userId, last_read_at: now, updated_at: now },
      { onConflict: "function_id,user_id" },
    );
  if (error) throw error;
}

export async function getMyDmUnreadCounts(userId: string) {
  const convos = await listMyDmConversations(userId);
  if (convos.length === 0) return { total: 0, byConversationId: {} as Record<string, number> };

  const convoIds = convos.map((c) => c.id);
  const { data: reads, error: readsErr } = await supabase
    .from("dm_reads")
    .select("conversation_id, last_read_at")
    .eq("user_id", userId)
    .in("conversation_id", convoIds);
  if (readsErr) throw readsErr;

  const lastReadByConvo: Record<string, string> = {};
  (reads || []).forEach((r) => {
    lastReadByConvo[r.conversation_id] = r.last_read_at;
  });

  // Pull recent messages and compute unread in JS (fast enough for MVP).
  const { data: msgs, error: msgsErr } = await supabase
    .from("dm_messages")
    .select("id, conversation_id, sender_id, created_at")
    .in("conversation_id", convoIds)
    .neq("sender_id", userId)
    .order("created_at", { ascending: false })
    .limit(400);
  if (msgsErr) throw msgsErr;

  const byConversationId: Record<string, number> = {};
  (msgs || []).forEach((m) => {
    const lastRead = lastReadByConvo[m.conversation_id];
    if (lastRead && new Date(m.created_at).getTime() <= new Date(lastRead).getTime()) return;
    byConversationId[m.conversation_id] = (byConversationId[m.conversation_id] || 0) + 1;
  });

  const total = Object.values(byConversationId).reduce((a, b) => a + b, 0);
  return { total, byConversationId };
}

// ─── Group chats ───────────────────────────────────────

export type GroupChatRow = {
  id: string;
  created_by: string;
  title: string | null;
  wallet_group_id?: string | null;
  created_at: string;
};

export type GroupChatMessage = {
  id: string;
  group_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  message_type?: "text" | "share";
  payload?: unknown;
  sender?: { id: string; username: string; display_name: string; avatar_url: string | null };
};

export async function createGroupChat(
  creatorId: string,
  memberIds: string[],
  title = "Group chat",
  walletGroupId?: string | null,
) {
  const unique = Array.from(new Set([creatorId, ...memberIds]));
  if (unique.length < 2) throw new Error("Pick at least one friend.");

  const { data: chat, error: cErr } = await supabase
    .from("group_chats")
    .insert({ created_by: creatorId, title: title.trim() || "Group chat", wallet_group_id: walletGroupId ?? null })
    .select("id, created_by, title, wallet_group_id, created_at")
    .single();
  if (cErr) throw cErr;

  const rows = unique.map((uid) => ({ group_id: chat.id, user_id: uid }));
  const { error: mErr } = await supabase.from("group_chat_members").insert(rows);
  if (mErr) throw mErr;

  return chat as GroupChatRow;
}

export async function ensureWalletGroupChat(walletGroupId: string, currentUserId: string): Promise<string> {
  // Try to find an existing companion chat (only visible if you're a member).
  const existing = await supabase
    .from("group_chats")
    .select("id")
    .eq("wallet_group_id", walletGroupId)
    .limit(1)
    .maybeSingle();
  if (!existing.error && existing.data?.id) return existing.data.id as string;

  // Otherwise create it using the wallet group's members.
  const g = await getGroup(walletGroupId);
  const memberIds = (g.group_members ?? []).map((m: any) => m.user_id).filter(Boolean) as string[];
  const others = memberIds.filter((id) => id !== currentUserId);
  const chat = await createGroupChat(currentUserId, others, (g as any).name || "Group chat", walletGroupId);
  return chat.id;
}

export async function listMyGroupChats(userId: string) {
  const { data: memberships, error: memErr } = await supabase
    .from("group_chat_members")
    .select("group_id, joined_at")
    .eq("user_id", userId);
  if (memErr) throw memErr;
  const groupIds = (memberships || []).map((m) => m.group_id);
  if (groupIds.length === 0) return [] as GroupChatRow[];

  const { data: chats, error: chErr } = await supabase
    .from("group_chats")
    .select("id, created_by, title, created_at")
    .in("id", groupIds)
    .order("created_at", { ascending: false });
  if (chErr) throw chErr;
  return (chats || []) as GroupChatRow[];
}

export async function setGroupChatTitle(groupId: string, title: string) {
  const { error } = await supabase.rpc("set_group_chat_title", { p_group_id: groupId, p_title: title });
  if (error) throw error;
}

export async function getGroupChatMessages(groupId: string) {
  const { data, error } = await supabase
    .from("group_chat_messages")
    .select(
      `id, group_id, sender_id, content, created_at, message_type, payload,
       sender:profiles!group_chat_messages_sender_id_fkey(id, username, display_name, avatar_url)`,
    )
    .eq("group_id", groupId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data || []) as GroupChatMessage[];
}

export async function sendGroupChatMessage(groupId: string, senderId: string, content: string) {
  const trimmed = content.trim();
  if (!trimmed) return;
  const { error } = await supabase.from("group_chat_messages").insert({
    group_id: groupId,
    sender_id: senderId,
    content: trimmed,
  });
  if (error) throw error;
}

export async function deleteGroupChatMessage(messageId: string, senderId: string) {
  const { error } = await supabase.from("group_chat_messages").delete().eq("id", messageId).eq("sender_id", senderId);
  if (error) throw error;
}

export async function sendGroupChatShareMessage(groupId: string, senderId: string, payload: DmSharePayload) {
  const { error } = await supabase.from("group_chat_messages").insert({
    group_id: groupId,
    sender_id: senderId,
    content: "",
    message_type: "share",
    payload,
  });
  if (error) throw error;
}

/** Create or join the paid-attendee group chat for a function. Requires latest migration. */
export async function ensureFunctionAttendeeChat(functionId: string): Promise<string> {
  const { data, error } = await supabase.rpc("ensure_function_attendee_chat", { p_function_id: functionId });
  if (error) throw error;
  if (!data || typeof data !== "string") throw new Error("Couldn't open attendee chat.");
  return data;
}

export async function getBusinessDashboard(userId: string) {
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  const monthStart = start.toISOString();

  const [{ data: paidRows, error: paidErr }, { data: listingRows, error: listingErr }] = await Promise.all([
    supabase
      .from("function_members")
      .select("has_paid, paid_at, functions!inner(amount_per_person, location, host_id)")
      .eq("has_paid", true)
      .gte("paid_at", monthStart)
      .eq("functions.host_id", userId)
      .in("functions.location", ["__SELL__", "__SERVICE__"]),
    supabase
      .from("functions")
      .select("id, title, location, status, host_id, max_capacity")
      .eq("host_id", userId)
      .in("location", ["__SELL__", "__SERVICE__"])
      .eq("status", "open"),
  ]);
  if (paidErr) throw paidErr;
  if (listingErr) throw listingErr;

  const rows = (paidRows || []) as { functions?: { amount_per_person?: number | null } | null }[];
  const revenue = rows.reduce((sum, r) => sum + (r.functions?.amount_per_person || 0), 0);
  const orders = rows.length;
  const avgOrderKes = orders > 0 ? Math.round(revenue / orders) : 0;

  const listings = (listingRows || []) as { id: string; title: string; location: string | null; max_capacity: number | null }[];
  const activeListings = listings.length;
  const sellActive = listings.filter((l) => l.location === "__SELL__").length;
  const serviceActive = listings.filter((l) => l.location === "__SERVICE__").length;

  // For "1 left / 3 spots" chips.
  const listingIds = listings.map((l) => l.id);
  let paidByListing: Record<string, number> = {};
  if (listingIds.length > 0) {
    const { data: paidCounts, error: paidCountsErr } = await supabase
      .from("function_members")
      .select("function_id")
      .eq("has_paid", true)
      .in("function_id", listingIds);
    if (paidCountsErr) throw paidCountsErr;
    (paidCounts || []).forEach((r: any) => {
      const id = String(r.function_id);
      paidByListing[id] = (paidByListing[id] || 0) + 1;
    });
  }

  const activeListingItems = listings.map((l) => {
    const paidCount = paidByListing[l.id] || 0;
    const cap = l.max_capacity;
    const remaining = cap != null ? Math.max(0, cap - paidCount) : null;
    return {
      id: l.id,
      title: l.title,
      kind: l.location === "__SELL__" ? ("sell" as const) : ("service" as const),
      remaining,
    };
  });

  // Best listing: choose most paid this month (approx).
  // We didn't fetch titles per payment row to keep query light; infer by active listing if possible.
  // If no active listings, fall back to the first activeListingItems.
  const bestListingTitle = activeListingItems[0]?.title ?? null;

  return {
    revenueThisMonthKes: revenue,
    ordersThisMonth: orders,
    activeListings,
    sellActive,
    serviceActive,
    listings: activeListingItems,
  };
}

export async function markGroupChatRead(groupId: string, userId: string) {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("group_chat_reads")
    .upsert(
      { group_id: groupId, user_id: userId, last_read_at: now, updated_at: now },
      { onConflict: "group_id,user_id" },
    );
  if (error) throw error;
}

/** Member user ids for a group; requires `group_chat_member_ids` RPC (see migration). */
export async function getGroupMemberIds(groupId: string): Promise<string[]> {
  const { data, error } = await supabase.rpc("group_chat_member_ids", { p_group_id: groupId });
  if (error) throw error;
  return ((data as string[] | null) || []).filter(Boolean);
}

export async function getMyGroupUnreadCounts(userId: string) {
  const groups = await listMyGroupChats(userId);
  if (groups.length === 0) return { total: 0, byGroupId: {} as Record<string, number> };

  const groupIds = groups.map((g) => g.id);
  const { data: reads, error: readsErr } = await supabase
    .from("group_chat_reads")
    .select("group_id, last_read_at")
    .eq("user_id", userId)
    .in("group_id", groupIds);
  if (readsErr) throw readsErr;

  const lastReadByGroup: Record<string, string> = {};
  (reads || []).forEach((r) => {
    lastReadByGroup[r.group_id] = r.last_read_at;
  });

  const { data: msgs, error: msgsErr } = await supabase
    .from("group_chat_messages")
    .select("id, group_id, sender_id, created_at")
    .in("group_id", groupIds)
    .neq("sender_id", userId)
    .order("created_at", { ascending: false })
    .limit(400);
  if (msgsErr) throw msgsErr;

  const byGroupId: Record<string, number> = {};
  (msgs || []).forEach((m) => {
    const lastRead = lastReadByGroup[m.group_id];
    if (lastRead && new Date(m.created_at).getTime() <= new Date(lastRead).getTime()) return;
    byGroupId[m.group_id] = (byGroupId[m.group_id] || 0) + 1;
  });

  const total = Object.values(byGroupId).reduce((a, b) => a + b, 0);
  return { total, byGroupId };
}

export async function getMyDmAndGroupUnreadTotal(userId: string) {
  const [dm, gr] = await Promise.all([
    getMyDmUnreadCounts(userId),
    getMyGroupUnreadCounts(userId).catch(() => ({ total: 0, byGroupId: {} as Record<string, number> })),
  ]);
  return dm.total + gr.total;
}

// ─── Unified inbox: DMs + group chats + plan/function chats ──────────────
//
// The "Personal" tab in MessagesScreen used to render DMs and group chats as
// two separate stacks while plan and function chats lived only behind their
// home-feed cards. Users were missing chats they were actually a part of.
// `listMyThreads` rolls every conversation surface a user belongs to into one
// stream, sorted by recency, so the inbox is the single source of truth.
//
// We keep plan/function "seen" state in localStorage for now (see
// pages/home/threadStorage.ts) — it ships now without a migration. When we
// promote it to a server-side tracker we'll just swap the source here.

export type UnifiedThreadKind = "dm" | "group" | "plan" | "function";

export type UnifiedThreadRow = {
  kind: UnifiedThreadKind;
  // Stable id for the thread itself (conversation_id / group_chat_id / plan_id / function_id).
  id: string;
  title: string;
  subtitle: string;
  // Primary peer info for DMs; first member for groups; host for plan/function.
  peerUserId: string | null;
  peerAvatarUrl: string | null;
  peerName: string | null;
  // For groups + plans + functions, all member ids (used by stacked avatars).
  memberIds: string[];
  // Latest activity timestamp used for sorting.
  lastActivityAt: string;
  // Optional preview snippet (last message text). May be empty for plan/function
  // surfaces if we have no message yet — we still surface them with subtitle.
  lastMessagePreview: string | null;
  lastSenderId: string | null;
  // Whether the latest message qualifies as unread for the current user.
  unread: boolean;
  // Used by the inbox to render context badges.
  contextLabel: "Plan" | "Function" | "Group" | null;
};

/**
 * One-shot pull of every chat surface the user can see. We only run lightweight
 * queries — most heavy lifting (message fetch + unread compute) reuses the
 * existing dm/group helpers, then we splice in plan/function threads using the
 * same shape so the inbox can render them homogeneously.
 */
export async function listMyThreads(userId: string): Promise<UnifiedThreadRow[]> {
  const [dmConvos, groupChats] = await Promise.all([
    listMyDmConversations(userId).catch(() => [] as DmConversation[]),
    listMyGroupChats(userId).catch(() => [] as GroupChatRow[]),
  ]);

  // Plan threads: every plan you created OR are a member of (active only).
  const [createdPlans, memberPlans] = await Promise.all([
    supabase
      .from("plans")
      .select("id, title, creator_id, created_at, plan_members(user_id)")
      .eq("creator_id", userId),
    supabase
      .from("plan_members")
      .select("plan_id, plans!inner(id, title, creator_id, created_at, plan_members(user_id))")
      .eq("user_id", userId),
  ]);

  type PlanLite = { id: string; title: string; creator_id: string; created_at: string; plan_members: { user_id: string }[] };
  const planMap = new Map<string, PlanLite>();
  ((createdPlans.data || []) as any[]).forEach((p) => planMap.set(p.id, p));
  ((memberPlans.data || []) as any[]).forEach((row) => {
    const p = row.plans;
    if (p?.id) planMap.set(p.id, p);
  });
  const plans = Array.from(planMap.values());

  // Function threads: every function you host OR are a paid/joined member of.
  const [hostedFunctions, memberFunctions] = await Promise.all([
    supabase
      .from("functions")
      .select("id, title, host_id, created_at, function_members(user_id)")
      .eq("host_id", userId),
    supabase
      .from("function_members")
      .select("function_id, functions!inner(id, title, host_id, created_at, function_members(user_id))")
      .eq("user_id", userId),
  ]);

  type FunctionLite = {
    id: string;
    title: string;
    host_id: string;
    created_at: string;
    function_members: { user_id: string }[];
  };
  const fnMap = new Map<string, FunctionLite>();
  ((hostedFunctions.data || []) as any[]).forEach((f) => fnMap.set(f.id, f));
  ((memberFunctions.data || []) as any[]).forEach((row) => {
    const f = row.functions;
    if (f?.id) fnMap.set(f.id, f);
  });
  const functions = Array.from(fnMap.values());

  // Latest message per plan/function (one round trip each, capped) so we can
  // compute unread + sort the whole inbox by true last-activity time.
  const planIds = plans.map((p) => p.id);
  const fnIds = functions.map((f) => f.id);
  const [planMsgs, fnMsgs] = await Promise.all([
    planIds.length === 0
      ? Promise.resolve({ data: [] as any[] })
      : supabase
          .from("plan_messages")
          .select("plan_id, user_id, content, created_at")
          .in("plan_id", planIds)
          .order("created_at", { ascending: false })
          .limit(planIds.length * 5),
    fnIds.length === 0
      ? Promise.resolve({ data: [] as any[] })
      : supabase
          .from("function_messages")
          .select("function_id, user_id, content, created_at")
          .in("function_id", fnIds)
          .order("created_at", { ascending: false })
          .limit(fnIds.length * 5),
  ]);

  const latestPlanMsgByPlan: Record<string, { content: string; user_id: string; created_at: string }> = {};
  ((planMsgs.data || []) as any[]).forEach((m) => {
    if (!latestPlanMsgByPlan[m.plan_id]) latestPlanMsgByPlan[m.plan_id] = m;
  });
  const latestFnMsgByFn: Record<string, { content: string; user_id: string; created_at: string }> = {};
  ((fnMsgs.data || []) as any[]).forEach((m) => {
    if (!latestFnMsgByFn[m.function_id]) latestFnMsgByFn[m.function_id] = m;
  });

  // DMs + groups: latest message lookup so we can show previews and sort
  // by true recency (currently we sort by created_at of the conversation row).
  const dmIds = dmConvos.map((c) => c.id);
  const groupIds = groupChats.map((g) => g.id);
  const [dmLatest, groupLatest] = await Promise.all([
    dmIds.length === 0
      ? Promise.resolve({ data: [] as any[] })
      : supabase
          .from("dm_messages")
          .select("conversation_id, sender_id, content, created_at, message_type")
          .in("conversation_id", dmIds)
          .order("created_at", { ascending: false })
          .limit(dmIds.length * 3),
    groupIds.length === 0
      ? Promise.resolve({ data: [] as any[] })
      : supabase
          .from("group_chat_messages")
          .select("group_id, sender_id, content, created_at, message_type")
          .in("group_id", groupIds)
          .order("created_at", { ascending: false })
          .limit(groupIds.length * 3),
  ]);

  const latestDmByConvo: Record<string, { content: string; sender_id: string; created_at: string; message_type?: string }> = {};
  ((dmLatest.data || []) as any[]).forEach((m) => {
    if (!latestDmByConvo[m.conversation_id]) latestDmByConvo[m.conversation_id] = m;
  });
  const latestGroupByGroup: Record<string, { content: string; sender_id: string; created_at: string; message_type?: string }> = {};
  ((groupLatest.data || []) as any[]).forEach((m) => {
    if (!latestGroupByGroup[m.group_id]) latestGroupByGroup[m.group_id] = m;
  });

  // Pull the unread maps we already had — these query dm_reads / group_chat_reads
  // and compare to recent message timestamps. Authoritative source for DM/group.
  const [dmUnread, groupUnread] = await Promise.all([
    getMyDmUnreadCounts(userId).catch(() => ({ total: 0, byConversationId: {} as Record<string, number> })),
    getMyGroupUnreadCounts(userId).catch(() => ({ total: 0, byGroupId: {} as Record<string, number> })),
  ]);

  // Resolve all profile ids (DM peers + group members + plan/function members + hosts)
  // in one batched call so the inbox doesn't N+1 the profiles table.
  const profileIds = new Set<string>();
  dmConvos.forEach((c) => {
    const other = c.user_low === userId ? c.user_high : c.user_low;
    if (other) profileIds.add(other);
  });
  // Group member ids — one lookup so we can render stacked avatars.
  const groupMemberRows = groupIds.length
    ? await supabase.from("group_chat_members").select("group_id, user_id").in("group_id", groupIds)
    : { data: [] as any[] };
  const memberIdsByGroup: Record<string, string[]> = {};
  ((groupMemberRows.data || []) as any[]).forEach((r) => {
    (memberIdsByGroup[r.group_id] ||= []).push(r.user_id);
    profileIds.add(r.user_id);
  });
  plans.forEach((p) => {
    profileIds.add(p.creator_id);
    (p.plan_members || []).forEach((m) => profileIds.add(m.user_id));
  });
  functions.forEach((f) => {
    profileIds.add(f.host_id);
    (f.function_members || []).forEach((m) => profileIds.add(m.user_id));
  });

  const profilesById: Record<string, ProfileRow> = {};
  if (profileIds.size > 0) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .in("id", Array.from(profileIds));
    (profs || []).forEach((p: any) => (profilesById[p.id] = p));
  }

  const rows: UnifiedThreadRow[] = [];

  // DMs
  for (const c of dmConvos) {
    const otherId = c.user_low === userId ? c.user_high : c.user_low;
    const peer = profilesById[otherId];
    const last = latestDmByConvo[c.id];
    rows.push({
      kind: "dm",
      id: c.id,
      title: peer?.display_name || "User",
      subtitle: peer?.username ? `@${peer.username}` : "",
      peerUserId: otherId,
      peerAvatarUrl: peer?.avatar_url ?? null,
      peerName: peer?.display_name || peer?.username || null,
      memberIds: [otherId],
      lastActivityAt: last?.created_at || c.created_at,
      lastMessagePreview: last?.content?.trim() || null,
      lastSenderId: last?.sender_id ?? null,
      unread: (dmUnread.byConversationId[c.id] || 0) > 0,
      contextLabel: null,
    });
  }

  // Group chats
  for (const g of groupChats) {
    const last = latestGroupByGroup[g.id];
    const memberIds = memberIdsByGroup[g.id] || [];
    const otherIds = memberIds.filter((id) => id !== userId);
    const firstOther = otherIds[0] ? profilesById[otherIds[0]] : null;
    const title =
      g.title?.trim() ||
      otherIds.slice(0, 3).map((id) => profilesById[id]?.display_name || "Member").join(", ") ||
      "Group chat";
    rows.push({
      kind: "group",
      id: g.id,
      title,
      subtitle: `${memberIds.length} people`,
      peerUserId: otherIds[0] ?? null,
      peerAvatarUrl: firstOther?.avatar_url ?? null,
      peerName: firstOther?.display_name || null,
      memberIds,
      lastActivityAt: last?.created_at || g.created_at,
      lastMessagePreview: last?.content?.trim() || null,
      lastSenderId: last?.sender_id ?? null,
      unread: (groupUnread.byGroupId[g.id] || 0) > 0,
      contextLabel: g.wallet_group_id ? "Group" : null,
    });
  }

  // Server-side read state for plan + function chats. We pull both maps in
  // parallel so the inbox can compute unread the same way as DMs/groups —
  // every device sees the same truth, no more "I read it on my phone but my
  // laptop still shows the dot."
  const planIdsList = plans.map((p) => p.id);
  const fnIdsList = functions.map((f) => f.id);
  const [planReadsRes, fnReadsRes] = await Promise.all([
    planIdsList.length === 0
      ? Promise.resolve({ data: [] as any[] })
      : supabase
          .from("plan_reads")
          .select("plan_id, last_read_at")
          .eq("user_id", userId)
          .in("plan_id", planIdsList),
    fnIdsList.length === 0
      ? Promise.resolve({ data: [] as any[] })
      : supabase
          .from("function_reads")
          .select("function_id, last_read_at")
          .eq("user_id", userId)
          .in("function_id", fnIdsList),
  ]);
  const planLastReadByPlan: Record<string, string> = {};
  ((planReadsRes.data || []) as any[]).forEach((r) => {
    planLastReadByPlan[r.plan_id] = r.last_read_at;
  });
  const fnLastReadByFn: Record<string, string> = {};
  ((fnReadsRes.data || []) as any[]).forEach((r) => {
    fnLastReadByFn[r.function_id] = r.last_read_at;
  });

  // Plan chats
  for (const p of plans) {
    const last = latestPlanMsgByPlan[p.id];
    const lastReadAt = planLastReadByPlan[p.id];
    const lastAt = last?.created_at || p.created_at;
    const unread =
      !!last &&
      last.user_id !== userId &&
      (!lastReadAt || new Date(last.created_at).getTime() > new Date(lastReadAt).getTime());
    const host = profilesById[p.creator_id];
    const memberIds = (p.plan_members || []).map((m) => m.user_id);
    rows.push({
      kind: "plan",
      id: p.id,
      title: p.title,
      subtitle: host ? `Hosted by ${host.display_name || host.username}` : "Plan",
      peerUserId: p.creator_id,
      peerAvatarUrl: host?.avatar_url ?? null,
      peerName: host?.display_name || null,
      memberIds: memberIds.length > 0 ? memberIds : [p.creator_id],
      lastActivityAt: lastAt,
      lastMessagePreview: last?.content?.trim() || null,
      lastSenderId: last?.user_id ?? null,
      unread,
      contextLabel: "Plan",
    });
  }

  // Function chats
  for (const f of functions) {
    const last = latestFnMsgByFn[f.id];
    const lastReadAt = fnLastReadByFn[f.id];
    const lastAt = last?.created_at || f.created_at;
    const unread =
      !!last &&
      last.user_id !== userId &&
      (!lastReadAt || new Date(last.created_at).getTime() > new Date(lastReadAt).getTime());
    const host = profilesById[f.host_id];
    const memberIds = (f.function_members || []).map((m) => m.user_id);
    rows.push({
      kind: "function",
      id: f.id,
      title: f.title,
      subtitle: host ? `Hosted by ${host.display_name || host.username}` : "Function",
      peerUserId: f.host_id,
      peerAvatarUrl: host?.avatar_url ?? null,
      peerName: host?.display_name || null,
      memberIds: memberIds.length > 0 ? memberIds : [f.host_id],
      lastActivityAt: lastAt,
      lastMessagePreview: last?.content?.trim() || null,
      lastSenderId: last?.user_id ?? null,
      unread,
      contextLabel: "Function",
    });
  }

  rows.sort(
    (a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime(),
  );
  return rows;
}

/**
 * Truthful unread total for the bottom-nav badge: includes DMs, group chats,
 * AND plan/function chats. The plan/function portion is per-device for now.
 */
export async function getMyAllUnreadTotal(userId: string): Promise<number> {
  try {
    const rows = await listMyThreads(userId);
    return rows.reduce((acc, r) => acc + (r.unread ? 1 : 0), 0);
  } catch {
    // Fallback so a transient hiccup doesn't crash the badge.
    return getMyDmAndGroupUnreadTotal(userId).catch(() => 0);
  }
}

// ─── Money Inbox ────────────────────────────────────────
//
// One pane that surfaces every piece of money in motion the user actually has
// to act on (or recently acted on). Backstops the strategic call to keep
// liquidity inside the platform: the inbox is the place that nags you to
// settle, accept, or send — instead of asking "did Sara pay?" in WhatsApp.

export type MoneyInboxOffer = {
  id: string;
  amount_kes: number;
  note: string | null;
  created_at: string;
  sender: { id: string; username: string; display_name: string; avatar_url: string | null } | null;
  // Where to deep-link the "Open chat" CTA. Filled when the offer was created
  // inside a DM or group chat.
  dm_conversation_id: string | null;
  group_chat_id: string | null;
};

export type MoneyInboxSplitOwed = {
  group_id: string;
  group_name: string | null;
  per_person_kes: number;
  function_id: string | null;
  function_title: string | null;
  // The user the host should ping for payment. Group is created by the host.
  host: { id: string; username: string; display_name: string; avatar_url: string | null } | null;
};

export type MoneyInboxSplitOwedToMe = {
  group_id: string;
  group_name: string | null;
  per_person_kes: number;
  function_id: string | null;
  function_title: string | null;
  unpaid_count: number;
  unpaid_members: { id: string; username: string; display_name: string; avatar_url: string | null }[];
};

export type MoneyInboxTransfer = {
  id: string;
  amount: number;
  kind: string | null;
  note: string | null;
  created_at: string;
  counterparty: { id: string; username: string; display_name: string; avatar_url: string | null } | null;
};

export type MoneyInbox = {
  pendingOffersForMe: MoneyInboxOffer[];
  splitsIOwe: MoneyInboxSplitOwed[];
  splitsOwedToMe: MoneyInboxSplitOwedToMe[];
  recentTransfers: MoneyInboxTransfer[];
};

/**
 * Aggregates every "act on me" money item for the user in one round trip-ish
 * call. Designed to be cheap enough to call on tab open + every wallet realtime
 * tick without paginating.
 */
export async function getMoneyInbox(userId: string): Promise<MoneyInbox> {
  // 1. Pending wallet offers I can accept.
  // Either explicitly addressed to me (DM offer) OR a group offer in a chat I'm in.
  const myGroupChatIds = await supabase
    .from("group_chat_members")
    .select("group_id")
    .eq("user_id", userId)
    .then((r) => (r.data || []).map((x) => x.group_id as string));

  // Build the filter safely — Supabase's .or() with .in() needs the format:
// group_chat_id.in.(id1,id2) — confirmed working, but let's be defensive
const orParts: string[] = [`recipient_user_id.eq.${userId}`];
if (myGroupChatIds.length > 0) {
  // Supabase PostgREST handles UUID arrays fine with this format
  orParts.push(`group_chat_id.in.(${myGroupChatIds.join(",")})`);
}
const orFilters = orParts.join(",");

  let pendingOffersForMe: MoneyInboxOffer[] = [];
  if (orFilters) {
    const { data: offers } = await supabase
      .from("wallet_offers")
      .select(
        `id, amount_kes, note, created_at, dm_conversation_id, group_chat_id,
         sender:profiles!wallet_offers_sender_id_fkey(id, username, display_name, avatar_url)`,
      )
      .eq("status", "pending")
      .neq("sender_id", userId)
      .or(orFilters)
      .order("created_at", { ascending: false })
      .limit(40);
    pendingOffersForMe = ((offers || []) as any[]).map((o) => ({
      id: o.id,
      amount_kes: Number(o.amount_kes) || 0,
      note: o.note,
      created_at: o.created_at,
      sender: o.sender || null,
      dm_conversation_id: o.dm_conversation_id,
      group_chat_id: o.group_chat_id,
    }));
  }

  // 2. Splits I owe — group_members rows where I haven't paid yet.
  // Includes both standalone splits and function-attached groups.
  const { data: owedRows } = await supabase
    .from("group_members")
    .select(
      `group_id,
       groups!inner(id, name, per_person, created_by, function_id,
         host:profiles!groups_created_by_fkey(id, username, display_name, avatar_url),
         functions(id, title))`,
    )
    .eq("user_id", userId)
    .eq("has_paid", false);

  const splitsIOwe: MoneyInboxSplitOwed[] = ((owedRows || []) as any[])
    .filter((r) => r.groups && r.groups.created_by !== userId)
    .map((r) => ({
      group_id: r.groups.id,
      group_name: r.groups.name ?? null,
      per_person_kes: Number(r.groups.per_person) || 0,
      function_id: r.groups.function_id ?? null,
      function_title: r.groups.functions?.title ?? null,
      host: r.groups.host ?? null,
    }));

  // 3. Splits owed TO me — groups I created that still have unpaid members.
  const { data: myGroups } = await supabase
    .from("groups")
    .select(
      `id, name, per_person, function_id,
       group_members(user_id, has_paid, profiles(id, username, display_name, avatar_url)),
       functions(id, title)`,
    )
    .eq("created_by", userId);

  const splitsOwedToMe: MoneyInboxSplitOwedToMe[] = ((myGroups || []) as any[])
    .map((g) => {
      const unpaid = (g.group_members || []).filter((m: any) => !m.has_paid && m.user_id !== userId);
      if (unpaid.length === 0) return null;
      return {
        group_id: g.id,
        group_name: g.name ?? null,
        per_person_kes: Number(g.per_person) || 0,
        function_id: g.function_id ?? null,
        function_title: g.functions?.title ?? null,
        unpaid_count: unpaid.length,
        unpaid_members: unpaid.map((m: any) => m.profiles).filter(Boolean),
      } as MoneyInboxSplitOwedToMe;
    })
    .filter((x): x is MoneyInboxSplitOwedToMe => !!x);

  // 4. Recent transfers — last 5 wallet movements with counterparty profile.
  const { data: txs } = await supabase
    .from("transactions")
    .select("id, amount, kind, note, counterparty_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(5);

  const counterIds = Array.from(
    new Set(((txs || []) as any[]).map((t) => t.counterparty_id).filter(Boolean)),
  );
  let counterMap: Record<string, { id: string; username: string; display_name: string; avatar_url: string | null }> = {};
  if (counterIds.length > 0) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .in("id", counterIds);
    (profs || []).forEach((p: any) => (counterMap[p.id] = p));
  }
  const recentTransfers: MoneyInboxTransfer[] = ((txs || []) as any[]).map((t) => ({
    id: t.id,
    amount: Number(t.amount) || 0,
    kind: t.kind ?? null,
    note: t.note ?? null,
    created_at: t.created_at,
    counterparty: t.counterparty_id ? counterMap[t.counterparty_id] || null : null,
  }));

  return { pendingOffersForMe, splitsIOwe, splitsOwedToMe, recentTransfers };
}
