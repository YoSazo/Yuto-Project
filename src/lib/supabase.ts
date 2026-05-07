import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "placeholder-key";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
        // Extract the username from "/invite/salah"
        refUsername = storedRedirect.split("/invite/")[1]; 
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
  const byFk = await supabase.from("wallets").select("balance").eq("user_id", userId).maybeSingle();
  let raw = byFk.data?.balance;
  if (!byFk.error && raw !== null && raw !== undefined) {
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  }
  const byId = await supabase.from("wallets").select("balance").eq("id", userId).maybeSingle();
  raw = byId.data?.balance;
  if (!byId.error && raw !== null && raw !== undefined) {
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  }
  const profile = await supabase.from("profiles").select("balance").eq("id", userId).maybeSingle();
  raw = profile.data?.balance;
  if (raw !== null && raw !== undefined) {
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

const PHONE_STORAGE_PREFIX = "yuto_phone_number:";

export function getSavedPhoneNumber(userId: string) {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(`${PHONE_STORAGE_PREFIX}${userId}`);
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
  const { error: groupError } = await supabase
    .from("groups")
    .insert({ name, total_amount: totalAmount, per_person: perPerson, created_by: createdBy, group_type: groupType });
  if (groupError) throw groupError;

  // Step 2: Fetch the group we just created (creator can select via created_by = auth.uid())
  const { data: group, error: fetchError } = await supabase
    .from("groups")
    .select("*")
    .eq("created_by", createdBy)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  if (fetchError) throw fetchError;

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

export async function markPaid(groupId: string, userId: string) {
  const { error } = await supabase
    .from("group_members")
    .update({ has_paid: true, paid_at: new Date().toISOString() })
    .eq("group_id", groupId)
    .eq("user_id", userId);
  if (error) throw error;
}

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
  function_members(id, user_id, has_paid, joined_at, profiles(id, username, display_name, avatar_url))
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

export type HostedFunctionItem = {
  id: string;
  title: string;
  date: string | null;
  location: string | null;
  amount_per_person: number;
  image_url: string | null;
};

/** Hosted *event* functions (not __SELL__/__SERVICE__) for profile “Functions” tab. */
export async function getUserHostedFunctions(userId: string): Promise<HostedFunctionItem[]> {
  const { data, error } = await supabase
    .from("functions")
    .select("id, title, date, location, amount_per_person, image_url, status, is_public, host_id")
    .eq("host_id", userId)
    .eq("status", "open")
    .neq("location", "__SELL__")
    .neq("location", "__SERVICE__")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data || []) as HostedFunctionItem[]).map((r) => ({
    id: r.id,
    title: r.title,
    date: r.date ?? null,
    location: r.location ?? null,
    amount_per_person: Number((r as any).amount_per_person) || 0,
    image_url: (r as any).image_url ?? null,
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
  return data;
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
  const response = await fetch("/api/function-message", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ function_id: functionId, user_id: userId, content }),
  });

  const data = (await response.json()) as { success?: boolean; message?: string };
  if (!response.ok || !data.success) {
    throw new Error(data.message || "Couldn't send message. Try again.");
  }
}

// ─── Highlights ──────────────────────────────────────

export type Highlight = {
  id: string;
  user_id: string;
  slot: 1 | 2;
  created_at: string;
  photos: Array<{ id: string; url: string; thumb_url: string | null; poster_url: string | null; sort_index: 1 | 2 }>;
};

type HighlightDbRow = {
  id: string;
  user_id: string;
  slot: number;
  created_at: string;
  highlight_photos?: Array<{ id: string; url: string; thumb_url?: string | null; poster_url?: string | null; sort_index: number }>;
};

function mapHighlightRow(h: HighlightDbRow): Highlight {
  return {
    id: h.id,
    user_id: h.user_id,
    slot: (h.slot === 2 ? 2 : 1) as 1 | 2,
    created_at: h.created_at,
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
    .select("id, user_id, slot, created_at, highlight_photos(id, url, thumb_url, poster_url, sort_index)")
    .eq("user_id", userId)
    .order("slot", { ascending: true });
  if (error) throw error;
  const rows = (data || []) as HighlightDbRow[];
  return rows.map(mapHighlightRow);
}

export async function getHighlightById(highlightId: string): Promise<Highlight | null> {
  const { data, error } = await supabase
    .from("highlights")
    .select("id, user_id, slot, created_at, highlight_photos(id, url, thumb_url, poster_url, sort_index)")
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
) {
  const existing = await getHighlightsByUser(userId);
  const used = new Set(existing.map((h) => h.slot));
  const slot: 1 | 2 = used.has(1) ? 2 : 1;
  if (used.has(slot)) throw new Error("You can only have 2 highlights.");

  const { data: highlight, error: hErr } = await supabase
    .from("highlights")
    .insert({ user_id: userId, slot })
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

/** Open sell/service listings on someone’s profile storefront. */
export type StorefrontListingItem = {
  id: string;
  title: string;
  kind: "sell" | "service";
  amount_per_person: number;
  image_url: string | null;
};

export async function getUserListings(userId: string): Promise<StorefrontListingItem[]> {
  const { data, error } = await supabase
    .from("functions")
    .select("id, title, location, amount_per_person, image_url")
    .eq("host_id", userId)
    .eq("status", "open")
    .in("location", ["__SELL__", "__SERVICE__"])
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data || []) as { id: string; title: string; location: string | null; amount_per_person: number | null; image_url: string | null }[]).map(
    (row) => ({
      id: row.id,
      title: row.title,
      kind: row.location === "__SELL__" ? ("sell" as const) : ("service" as const),
      amount_per_person: row.amount_per_person ?? 0,
      image_url: row.image_url ?? null,
    }),
  );
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

// ─── Plans ───────────────────────────────────────────

const PLANS_SELECT = `
  *,
  creator:profiles!plans_creator_id_fkey(id, username, display_name, avatar_url),
  plan_members(id, user_id, profiles(id, username, display_name, avatar_url))
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
  imageUrl?: string | null
) {
  const { data, error } = await supabase
    .from("plans")
    .insert({ creator_id: creatorId, title, amount, slots, image_url: imageUrl || null })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function joinPlan(planId: string, userId: string, joinerName: string, creatorId: string) {
  const { error } = await supabase
    .from("plan_members")
    .insert({ plan_id: planId, user_id: userId });
  if (error) throw error;

  // Notify plan creator
  if (creatorId !== userId) {
    try {
      await fetch("/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
  // Create the group
  const group = await createGroup(title, amount, Math.ceil(amount / memberIds.length), creatorId, memberIds);
  // Mark plan as completed
  await supabase.from("plans").update({ status: "completed", yuto_group_id: group.id }).eq("id", planId);
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
  const response = await fetch("/api/plan-message", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
  message_type?: "text" | "share";
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

export async function sendDmMessage(conversationId: string, senderId: string, content: string) {
  const trimmed = content.trim();
  if (!trimmed) return;
  const { error } = await supabase.from("dm_messages").insert({ conversation_id: conversationId, sender_id: senderId, content: trimmed, message_type: "text" });
  if (error) throw error;
}

export type DmSharePayload =
  | { kind: "plan"; plan_id: string }
  | { kind: "function"; function_id: string }
  | { kind: "listing"; function_id: string; listing_kind: "sell" | "service" }
  | { kind: "profile"; user_id: string }
  | { kind: "highlight"; highlight_id: string; user_id: string };

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
