import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import imgYutoMascot from "../assets/yuto-mascot.webp";
import { useAuth } from "../contexts/AuthContext";
import { getFriends, createGroup, createGroupChat } from "../lib/supabase";
import UserAvatar from "../components/UserAvatar";

interface Friend {
  id: string;
  username: string;
  display_name: string;
}

export default function SplitScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    getFriends(user.id).then((data) => {
      const list: Friend[] = (data as any[]).map((f) =>
        f.requester_id === user.id ? f.addressee : f.requester
      );
      setFriends(list);
    });
  }, [user]);

  const totalPeople = selectedFriends.length + 1;
  const totalAmount = amount ? parseInt(amount) : 0;
  const equalShare = totalAmount > 0 && totalPeople > 0 ? Math.ceil(totalAmount / totalPeople) : 0;

  const toggleFriend = (id: string) => {
    setSelectedFriends((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
    );
  };

  const isValid =
    totalAmount > 0 &&
    selectedFriends.length > 0;

  const handleSplit = async () => {
    if (!isValid || !user) return;
    setIsCreating(true);
    setError("");
    try {
      const group = await createGroup(
        description.trim() || "Split",
        totalAmount,
        equalShare,
        user.id,
        [user.id, ...selectedFriends],
        "single"
      );
      try {
        await createGroupChat(user.id, selectedFriends, description.trim() || "Split", group.id);
      } catch (e) {
        console.error("Companion group chat after split:", e);
      }
      navigate(`/yuto/${group.id}`);
    } catch (err) {
      console.error("Failed to create split:", err);
      setError(err instanceof Error ? err.message : "Failed to create split. Try again.");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="flex flex-col min-h-full px-6 pt-14 bg-white dark:bg-black text-black dark:text-white transition-colors">
      {/* Header */}
      <div className="flex items-center gap-3 mb-10">
        <img src={imgYutoMascot} alt="Yuto" className="w-10 h-10 object-contain" />
        <span className="text-xl font-bold text-black dark:text-white">Split Anything</span>
      </div>

      {/* Amount input */}
      <div className="flex flex-col items-center py-4">
        <span className="text-sm font-medium text-gray-400 tracking-wider uppercase mb-2">KSH</span>
        <input
          type="text"
          inputMode="numeric"
          value={amount}
          onChange={(e) => {
            const val = e.target.value.replace(/\D/g, "");
            if (val.length <= 7) setAmount(val);
          }}
          placeholder="0"
          className="text-[56px] font-bold text-center text-black dark:text-white bg-transparent border-none outline-none w-full placeholder-gray-200 dark:placeholder-gray-700"
          style={{ caretColor: "#5493b3" }}
        />
        <div className="w-16 h-0.5 bg-gray-200 dark:bg-zinc-800 rounded-full mt-1" />
      </div>

      {/* Description */}
      <div className="mt-4 mb-6">
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What's this for? (chipo, lunch, drinks...)"
          maxLength={40}
          className="w-full text-sm text-center text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-zinc-900 border-none outline-none rounded-full px-4 py-3 placeholder-gray-300 dark:placeholder-zinc-600"
        />
      </div>

      {/* Friends */}
      <div className="mt-2">
        <p className="font-semibold text-sm text-gray-500 mb-3">Split with</p>
        {friends.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-sm text-gray-400 mb-2">No friends yet</p>
            <button
              onClick={() => navigate("/friends")}
              className="text-sm text-black dark:text-white font-semibold bg-transparent border-none cursor-pointer underline p-0"
            >
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
                  onClick={() => toggleFriend(friend.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-full border-2 transition-all tap-scale ${
                    selected
                      ? "bg-black dark:bg-white border-black dark:border-white text-white dark:text-black"
                      : "bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800 text-black dark:text-white"
                  }`}
                >
                  <UserAvatar name={friend.display_name} avatarUrl={(friend as any).avatar_url} size="sm" className={selected ? "ring-2 ring-white" : ""} />
                  <span className="font-medium text-sm">{friend.display_name}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>


      {/* Per person summary */}
      {isValid && (
        <div className="mt-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-50 dark:bg-zinc-900 rounded-full">
            <span className="text-sm text-gray-500 dark:text-gray-400">Each person pays</span>
            <span className="font-bold text-lg text-black dark:text-white">KSH {equalShare.toLocaleString()}</span>
          </div>
        </div>
      )}

      {error && (
        <p className="text-center text-sm text-red-500 font-semibold mt-4">{error}</p>
      )}

      {/* CTA Button */}
      <div className="mt-auto pb-6 pt-8">
        <button
          onClick={handleSplit}
          disabled={!isValid || isCreating}
          className={`w-full py-4 rounded-full font-bold text-lg transition-all tap-scale ${
            isValid && !isCreating
              ? "bg-black dark:bg-white text-white dark:text-black active:scale-[0.98]"
              : "bg-gray-100 dark:bg-zinc-800 text-gray-400 dark:text-gray-500 cursor-not-allowed"
          }`}
        >
          {isCreating
            ? "Creating..."
            : isValid
            ? `Split KSH ${totalAmount.toLocaleString()}`
            : "Enter amount & select friends"}
        </button>
      </div>
    </div>
  );
}
