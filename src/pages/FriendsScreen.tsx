import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  searchProfiles,
  getFriends,
  getPendingRequests,
  sendFriendRequest,
  respondToFriendRequest,
} from "../lib/supabase";
import UserAvatar from "../components/UserAvatar";

interface ProfileResult {
  id: string;
  username: string;
  display_name: string;
}

export default function FriendsScreen() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ProfileResult[]>([]);
  const [friends, setFriends] = useState<ProfileResult[]>([]);
  const [pending, setPending] = useState<{ id: string; requester: ProfileResult }[]>([]);
  const [friendIds, setFriendIds] = useState<Set<string>>(new Set());
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState("");

  const loadData = useCallback(async () => {
    if (!user) return;
    const [friendsData, pendingData] = await Promise.all([
      getFriends(user.id),
      getPendingRequests(user.id),
    ]);

    const list: ProfileResult[] = (friendsData as any[]).map((f) =>
      f.requester_id === user.id ? f.addressee : f.requester
    );
    setFriends(list);
    setFriendIds(new Set(list.map((f) => f.id)));
    setPending(
      (pendingData as any[]).map((r) => ({ id: r.id, requester: r.requester }))
    );
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!searchQuery.trim() || !user) {
      setSearchResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      const results = await searchProfiles(searchQuery, user.id);
      setSearchResults(results as ProfileResult[]);
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery, user]);

  const handleSend = async (toId: string) => {
    if (!user) return;
    try {
      await sendFriendRequest(user.id, toId);
      setSentIds((prev) => new Set(prev).add(toId));
      setToast("Request sent!");
    } catch (err: unknown) {
      setToast(err instanceof Error ? err.message : "Failed");
    }
    setTimeout(() => setToast(""), 2000);
  };

  const handleRespond = async (friendshipId: string, accept: boolean) => {
    await respondToFriendRequest(friendshipId, accept);
    await loadData();
    setToast(accept ? "Friend added!" : "Request declined");
    setTimeout(() => setToast(""), 2000);
  };

  return (
    <div className="flex flex-col min-h-full px-6 pt-10 pb-6">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate("/profile")}
          className="text-gray-400 hover:text-black bg-transparent border-none cursor-pointer text-base"
        >
          ← Back
        </button>
        <span className="text-2xl font-bold text-black">Friends</span>
        <button
          onClick={() => {
            const link = `${window.location.origin}/invite/${profile?.username || ""}`;
            if (navigator.share) {
              navigator.share({ title: "Join me on Yuto!", text: "Pay together with me on Yuto 🚗", url: link });
            } else {
              navigator.clipboard.writeText(link);
              setToast("Invite link copied!");
              setTimeout(() => setToast(""), 2000);
            }
          }}
          className="ml-auto px-4 py-1.5 bg-black text-white text-xs font-semibold rounded-full border-none cursor-pointer"
        >
          Invite Friends
        </button>
      </div>

      <input
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Search by username..."
        autoCapitalize="none"
        className="w-full h-12 border border-gray-300 rounded-full px-5 text-base outline-none focus:border-black transition-colors mb-5"
      />

      {toast && (
        <p className="text-center text-sm text-green-600 font-semibold mb-4">{toast}</p>
      )}

      {searchResults.length > 0 && (
        <div className="mb-6">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Search Results
          </p>
          <div className="flex flex-col gap-2">
            {searchResults.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between bg-white border border-gray-200 rounded-xl p-3"
              >
                <div className="flex items-center gap-3">
                  <UserAvatar name={p.display_name} avatarUrl={p.avatar_url} size="sm" />
                  <div>
                    <p className="font-semibold text-sm text-black">{p.display_name}</p>
                    <p className="text-xs text-gray-400">@{p.username}</p>
                  </div>
                </div>
                {friendIds.has(p.id) ? (
                  <span className="text-xs text-green-600 font-semibold">Friends</span>
                ) : sentIds.has(p.id) ? (
                  <span className="text-xs text-gray-400 font-semibold">Sent</span>
                ) : (
                  <button
                    onClick={() => handleSend(p.id)}
                    className="px-4 py-1.5 bg-black text-white text-xs font-semibold rounded-full border-none cursor-pointer hover:bg-gray-800"
                  >
                    Add
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {pending.length > 0 && (
        <div className="mb-6">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Pending Requests
          </p>
          <div className="flex flex-col gap-2">
            {pending.map((req) => (
              <div
                key={req.id}
                className="flex items-center justify-between bg-white border border-gray-200 rounded-xl p-3"
              >
                <div className="flex items-center gap-3">
                  <UserAvatar name={req.requester.display_name} avatarUrl={req.requester.avatar_url} size="sm" />
                  <div>
                    <p className="font-semibold text-sm text-black">
                      {req.requester.display_name}
                    </p>
                    <p className="text-xs text-gray-400">@{req.requester.username}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleRespond(req.id, true)}
                    className="px-4 py-1.5 bg-black text-white text-xs font-semibold rounded-full border-none cursor-pointer"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => handleRespond(req.id, false)}
                    className="px-4 py-1.5 bg-gray-100 text-gray-500 text-xs font-semibold rounded-full border-none cursor-pointer"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Your Friends ({friends.length})
        </p>
        {friends.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">
            Search for friends by their username
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {friends.map((f) => (
              <div
                key={f.id}
                className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl p-3 cursor-pointer hover:border-gray-300 transition-colors"
                onClick={() => navigate(`/user/${f.username}`)}
              >
                <UserAvatar name={f.display_name} avatarUrl={f.avatar_url} size="sm" />
                <div>
                  <p className="font-semibold text-sm text-black">{f.display_name}</p>
                  <p className="text-xs text-gray-400">@{f.username}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
