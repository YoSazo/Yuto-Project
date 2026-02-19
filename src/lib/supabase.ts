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

export async function searchProfiles(query: string, currentUserId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, display_name")
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
       requester:profiles!friendships_requester_id_fkey(id, username, display_name),
       addressee:profiles!friendships_addressee_id_fkey(id, username, display_name)`
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
       requester:profiles!friendships_requester_id_fkey(id, username, display_name)`
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
  memberIds: string[]
) {
  // Step 1: Insert the group (no .select() — RLS select policy requires group_members to exist first)
  const { error: groupError } = await supabase
    .from("groups")
    .insert({ name, total_amount: totalAmount, per_person: perPerson, created_by: createdBy });
  if (groupError) throw groupError;

  // Step 2: Fetch the group we just created (now created_by = auth.uid() so creator can find it via created_by)
  // We use created_by + order to get the latest one just inserted
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
      `*, group_members(id, user_id, has_joined, has_paid, profiles(id, username, display_name))`
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
