import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { supabase, sendFriendRequest, getFriends } from "../lib/supabase";
import UserAvatar from "../components/UserAvatar";

interface UserProfile {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
}

export default function UserProfileScreen() {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFriend, setIsFriend] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [mutualCount, setMutualCount] = useState(0);
  const [groupCount, setGroupCount] = useState(0);
  const [totalSplits, setTotalSplits] = useState(0);
  const [totalKshPaid, setTotalKshPaid] = useState(0);
  const [friendsCount, setFriendsCount] = useState(0);

  useEffect(() => {
    if (!username || !user) return;

    const load = async () => {
      // Fetch the profile
      const { data: profileData, error } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .eq("username", username)
        .single();

      if (error || !profileData) {
        setLoading(false);
        return;
      }
      setProfile(profileData);

      // Check friendship status
      const { data: friendship } = await supabase
        .from("friendships")
        .select("id, status")
        .or(
          `and(requester_id.eq.${user.id},addressee_id.eq.${profileData.id}),and(requester_id.eq.${profileData.id},addressee_id.eq.${user.id})`
        )
        .limit(1)
        .single();

      if (friendship) {
        if (friendship.status === "accepted") setIsFriend(true);
        else if (friendship.status === "pending") setRequestSent(true);
      }

      // Count shared groups
      const { data: myGroups } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("user_id", user.id);

      const { data: theirGroups } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("user_id", profileData.id);

      if (myGroups && theirGroups) {
        const myGroupIds = new Set(myGroups.map((g) => g.group_id));
        const shared = theirGroups.filter((g) => myGroupIds.has(g.group_id));
        setGroupCount(shared.length);
      }

      // Their total splits + KSH paid
      const { data: theirMemberships } = await supabase
        .from("group_members")
        .select("has_paid, groups(per_person)")
        .eq("user_id", profileData.id);

      if (theirMemberships) {
        setTotalSplits(theirMemberships.length);
        const paid = theirMemberships.filter((m) => m.has_paid);
        const ksh = paid.reduce((sum, m) => sum + ((m.groups as any)?.per_person || 0), 0);
        setTotalKshPaid(ksh);
      }

      // Their friends count
      const theirFriends = await getFriends(profileData.id);
      setFriendsCount(theirFriends.length);

      // Mutual friends
      const myFriends = await getFriends(user.id);
      const myFriendIds = new Set(
        (myFriends as any[]).map((f) =>
          f.requester_id === user.id ? f.addressee_id : f.requester_id
        )
      );
      const mutuals = (theirFriends as any[]).filter((f) => {
        const otherId =
          f.requester_id === profileData.id ? f.addressee_id : f.requester_id;
        return myFriendIds.has(otherId);
      });
      setMutualCount(mutuals.length);

      setLoading(false);
    };

    load();
  }, [username, user]);

  const handleAddFriend = async () => {
    if (!profile || !user) return;
    setSending(true);
    try {
      await sendFriendRequest(user.id, profile.id);
      setRequestSent(true);
    } catch {
      // already sent
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col min-h-full items-center justify-center">
        <p className="text-gray-400">Loading...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex flex-col min-h-full items-center justify-center px-6">
        <p className="font-bold text-lg text-black mb-2">User not found</p>
        <button onClick={() => navigate(-1)} className="text-sm text-gray-400 bg-transparent border-none cursor-pointer">
          ← Go back
        </button>
      </div>
    );
  }

  const isMe = user?.id === profile.id;

  return (
    <div className="flex flex-col min-h-full px-6 pt-14">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={() => navigate(-1)}
          className="text-gray-400 hover:text-black bg-transparent border-none cursor-pointer text-base"
        >
          ← Back
        </button>
      </div>

      {/* Profile card */}
      <div className="flex flex-col items-center text-center mb-8">
        <UserAvatar name={profile.display_name} avatarUrl={profile.avatar_url} size="xl" className="mb-4" />
        <h1 className="text-2xl font-bold text-black">{profile.display_name}</h1>
        <p className="text-sm text-gray-400 mt-1">@{profile.username}</p>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 mt-6 w-full">
          <div className="bg-white border border-gray-200 rounded-xl py-4 px-3 text-center">
            <p className="font-bold text-xl text-black">{totalSplits}</p>
            <p className="text-xs text-gray-400 mt-1">Splits</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl py-4 px-3 text-center">
            <p className="font-bold text-lg text-black">{totalKshPaid.toLocaleString()}</p>
            <p className="text-xs text-gray-400 mt-1">KSH Paid</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl py-4 px-3 text-center">
            <p className="font-bold text-xl text-black">{friendsCount}</p>
            <p className="text-xs text-gray-400 mt-1">Friends</p>
          </div>
        </div>

        {/* Mutual / together stats */}
        {(mutualCount > 0 || groupCount > 0) && (
          <div className="flex items-center gap-4 mt-4">
            {groupCount > 0 && (
              <p className="text-xs text-gray-400">🤝 {groupCount} splits together</p>
            )}
            {mutualCount > 0 && (
              <p className="text-xs text-gray-400">👥 {mutualCount} mutual friends</p>
            )}
          </div>
        )}
      </div>

      {/* Action button */}
      {!isMe && (
        <div className="flex flex-col gap-3">
          {isFriend ? (
            <div className="w-full py-4 rounded-full font-bold text-base text-center bg-gray-100 text-gray-500">
              ✓ Friends
            </div>
          ) : requestSent ? (
            <div className="w-full py-4 rounded-full font-bold text-base text-center bg-gray-100 text-gray-400">
              Request sent
            </div>
          ) : (
            <button
              onClick={handleAddFriend}
              disabled={sending}
              className="w-full py-4 rounded-full font-bold text-base bg-black text-white hover:bg-gray-800 transition-colors tap-scale border-none cursor-pointer"
            >
              {sending ? "Sending..." : "Add Friend"}
            </button>
          )}

          {/* Invite to split */}
          <button
            onClick={() => navigate("/split")}
            className="w-full py-4 rounded-full font-bold text-base bg-white border-2 border-gray-200 text-black hover:border-black transition-colors tap-scale cursor-pointer"
          >
            Split with {profile.display_name.split(" ")[0]} ✂️
          </button>
        </div>
      )}

      {isMe && (
        <button
          onClick={() => navigate("/profile")}
          className="w-full py-4 rounded-full font-bold text-base bg-black text-white hover:bg-gray-800 transition-colors tap-scale border-none cursor-pointer"
        >
          Edit Profile
        </button>
      )}
    </div>
  );
}
