import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { getFriends, createGroup } from "../lib/supabase";

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
  const [splitMode, setSplitMode] = useState<"equal" | "custom">("equal");
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});

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
      navigate(`/yuto/${group.id}`);
    } catch (err) {
      console.error("Failed to create split:", err);
      setError(err instanceof Error ? err.message : "Failed to create split. Try again.");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="flex flex-col min-h-full px-6 pt-14">
      {/* Header */}
      <div className="flex items-center gap-3 mb-10">
        <SplitIcon />
        <span className="text-xl font-bold text-black">Split Anything</span>
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
          className="text-[56px] font-bold text-center text-black bg-transparent border-none outline-none w-full placeholder-gray-200"
          style={{ caretColor: "#5493b3" }}
        />
        <div className="w-16 h-0.5 bg-gray-200 rounded-full mt-1" />
      </div>

      {/* Description */}
      <div className="mt-4 mb-6">
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What's this for? (chips, lunch, drinks...)"
          maxLength={40}
          className="w-full text-sm text-center text-gray-500 bg-gray-50 border-none outline-none rounded-full px-4 py-3 placeholder-gray-300"
        />
      </div>

      {/* Split mode toggle */}
      {selectedFriends.length > 0 && totalAmount > 0 && (
        <div className="flex items-center justify-center gap-2 mb-6">
          <button
            onClick={() => setSplitMode("equal")}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              splitMode === "equal"
                ? "bg-black text-white border-black"
                : "bg-white text-gray-400 border-gray-200"
            }`}
          >
            Equal split
          </button>
          <button
            onClick={() => setSplitMode("custom")}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              splitMode === "custom"
                ? "bg-black text-white border-black"
                : "bg-white text-gray-400 border-gray-200"
            }`}
          >
            Custom amounts
          </button>
        </div>
      )}

      {/* Friends */}
      <div className="mt-2">
        <p className="font-semibold text-sm text-gray-500 mb-3">Split with</p>
        {friends.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-sm text-gray-400 mb-2">No friends yet</p>
            <button
              onClick={() => navigate("/friends")}
              className="text-sm text-black font-semibold bg-transparent border-none cursor-pointer underline p-0"
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
                      ? "bg-black border-black text-white"
                      : "bg-white border-gray-200 text-black"
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                      selected ? "bg-white text-black" : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {friend.display_name.charAt(0)}
                  </div>
                  <span className="font-medium text-sm">{friend.display_name}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Custom amounts */}
      {splitMode === "custom" && selectedFriends.length > 0 && totalAmount > 0 && (
        <div className="mt-6">
          <p className="font-semibold text-sm text-gray-500 mb-3">Custom amounts</p>
          <div className="flex flex-col gap-3">
            {/* My amount */}
            <div className="flex items-center justify-between bg-gray-50 rounded-2xl px-4 py-3">
              <span className="text-sm font-semibold text-black">You</span>
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-400">KSH</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={customAmounts["me"] || ""}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "");
                    setCustomAmounts((prev) => ({ ...prev, me: val }));
                  }}
                  placeholder={String(equalShare)}
                  className="w-20 text-right text-sm font-bold text-black bg-transparent border-none outline-none"
                />
              </div>
            </div>
            {/* Friends amounts */}
            {selectedFriends.map((id) => {
              const friend = friends.find((f) => f.id === id);
              if (!friend) return null;
              return (
                <div key={id} className="flex items-center justify-between bg-gray-50 rounded-2xl px-4 py-3">
                  <span className="text-sm font-semibold text-black">{friend.display_name}</span>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-400">KSH</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={customAmounts[id] || ""}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, "");
                        setCustomAmounts((prev) => ({ ...prev, [id]: val }));
                      }}
                      placeholder={String(equalShare)}
                      className="w-20 text-right text-sm font-bold text-black bg-transparent border-none outline-none"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Per person summary */}
      {isValid && splitMode === "equal" && (
        <div className="mt-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-full">
            <span className="text-sm text-gray-500">Each person pays</span>
            <span className="font-bold text-lg text-black">KSH {equalShare.toLocaleString()}</span>
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
              ? "bg-black text-white active:scale-[0.98]"
              : "bg-gray-100 text-gray-400 cursor-not-allowed"
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

function SplitIcon() {
  return (
    <svg
      width="36"
      height="36"
      viewBox="-1.5 0 19 19"
      xmlns="http://www.w3.org/2000/svg"
      fill="#000000"
    >
      <path d="M14.533 2.953H9.53a.493.493 0 0 0-.325.79l1.049 1.36.15.194L8 7.137l-2.403-1.84.15-.194 1.048-1.36a.493.493 0 0 0-.325-.79H1.467a.496.496 0 0 0-.434.683L2.276 8.39a.493.493 0 0 0 .847.113l.935-1.211.281-.366 2.638 2.02-.006 6.074a1.026 1.026 0 0 0 2.05 0l.007-6.078 2.632-2.016.282.366.934 1.211a.493.493 0 0 0 .847-.113l1.244-4.755a.496.496 0 0 0-.434-.683z" />
    </svg>
  );
}
