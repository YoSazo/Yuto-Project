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

// ─── Plans ───────────────────────────────────────────

export async function getPlans(userId: string) {
  const { data, error } = await supabase
    .from("plans")
    .select(`
      *,
      creator:profiles!plans_creator_id_fkey(id, username, display_name, avatar_url),
      plan_members(id, user_id, profiles(id, username, display_name, avatar_url))
    `)
    .eq("status", "open")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function createPlan(
  creatorId: string,
  title: string,
  amount: number | null,
  slots: number | null
) {
  const { data, error } = await supabase
    .from("plans")
    .insert({ creator_id: creatorId, title, amount, slots })
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
