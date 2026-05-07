import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { createGroupChat, getFriends } from "../lib/supabase";
import UserAvatar from "../components/UserAvatar";

interface FriendRow {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
}

export default function CreateGroupChatScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [friends, setFriends] = useState<FriendRow[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [groupName, setGroupName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!user) return;
    getFriends(user.id).then((data) => {
      const list = (data as any[]).map((f) => {
        const p = f.requester_id === user.id ? f.addressee : f.requester;
        return {
          id: p.id as string,
          username: p.username as string,
          display_name: p.display_name as string,
          avatar_url: (p.avatar_url as string | null) ?? null,
        };
      });
      setFriends(list);
    });
  }, [user]);

  const toggleFriend = (id: string) => {
    setSelectedFriends((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const valid = selectedFriends.length > 0;

  const handleCreate = async () => {
    if (!user || !valid) return;
    setCreating(true);
    try {
      const title = groupName.trim() || "Group chat";
      const chat = await createGroupChat(user.id, selectedFriends, title);
      navigate(`/messages/group/${chat.id}`, { replace: true });
    } catch (e) {
      console.error(e);
      const msg =
        (e as { message?: string })?.message ||
        (e as { details?: string })?.details ||
        (e as { hint?: string })?.hint ||
        (typeof e === "string" ? e : "");
      alert(msg || "Couldn't create group. Try again.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex flex-col min-h-full px-6 pt-14 pb-8">
      <div className="flex items-center justify-between gap-3 mb-8">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => navigate(-1)} className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center shrink-0" aria-label="Back">
            <ArrowLeft size={18} />
          </button>
          <span className="text-xl font-bold text-black">New group</span>
        </div>
      </div>

      <div className="mt-2 flex-1">
        <div className="mb-8">
          <p className="font-semibold text-sm text-gray-500 mb-3 text-center">Name your group</p>
          <input
            type="text"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value.slice(0, 40))}
            placeholder="Trip to Nanyuki, roomies, study crew…"
            maxLength={40}
            className="w-full text-sm text-center text-gray-600 bg-gray-50 border-none outline-none rounded-full px-4 py-3 placeholder-gray-300"
          />
        </div>

        <p className="font-semibold text-sm text-gray-500 mb-3">Add people</p>
        {friends.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-sm text-gray-400 mb-2">No friends yet</p>
            <button type="button" onClick={() => navigate("/friends")} className="text-sm text-black font-semibold bg-transparent border-none cursor-pointer underline p-0">
              Add friends to get started
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-3">
            {friends.map((friend) => {
              const selected = selectedFriends.includes(friend.id);
              return (
                <button
                  key={friend.id}
                  type="button"
                  onClick={() => toggleFriend(friend.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-full border-2 transition-all tap-scale ${
                    selected ? "bg-black border-black text-white" : "bg-white border-gray-200 text-black"
                  }`}
                >
                  <UserAvatar name={friend.display_name} avatarUrl={friend.avatar_url} size="sm" className={selected ? "ring-2 ring-white" : ""} />
                  <span className="font-medium text-sm">{friend.display_name}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-auto pb-6 pt-8">
        <button
          type="button"
          onClick={() => void handleCreate()}
          disabled={!valid || creating}
          className={`w-full py-4 rounded-full font-bold text-lg transition-all tap-scale ${
            valid && !creating ? "bg-black text-white active:scale-[0.98]" : "bg-gray-100 text-gray-400 cursor-not-allowed"
          }`}
        >
          {creating ? "Creating…" : "Create group"}
        </button>
      </div>
    </div>
  );
}
