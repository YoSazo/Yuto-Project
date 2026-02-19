import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import imgYutoMascot from "figma:asset/28c11cb437762e8469db46974f467144b8299a8c.png";
import { useAuth } from "../contexts/AuthContext";
import { getFriends, createGroup } from "../lib/supabase";

interface Friend {
  id: string;
  username: string;
  display_name: string;
}

export default function FareShareScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [fareAmount, setFareAmount] = useState("");
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
  const splitAmount = fareAmount ? Math.ceil(parseInt(fareAmount) / totalPeople) : 0;
  const isValid = fareAmount && parseInt(fareAmount) > 0 && selectedFriends.length > 0;

  const toggleFriend = (id: string) => {
    setSelectedFriends((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
    );
  };

  const handleSplit = async () => {
    if (!isValid || !user) return;
    setIsCreating(true);
    setError("");
    try {
      const group = await createGroup(
        "Fare Share",
        parseInt(fareAmount),
        splitAmount,
        user.id,
        [user.id, ...selectedFriends]
      );
      navigate(`/yuto/${group.id}`);
    } catch (err) {
      console.error("Failed to create group:", err);
      setError(err instanceof Error ? err.message : "Failed to create group. Try again.");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="flex flex-col min-h-full px-6 pt-14">
      <div className="flex items-center gap-3 mb-8">
        <img src={imgYutoMascot} alt="Yuto" className="w-10 h-10 object-contain" />
        <span className="text-xl font-bold text-black">Yuto</span>
      </div>

      <div className="flex flex-col items-center py-6">
        <span className="text-sm font-medium text-gray-400 tracking-wider uppercase mb-2">
          KSH
        </span>
        <input
          type="text"
          inputMode="numeric"
          value={fareAmount}
          onChange={(e) => {
            const val = e.target.value.replace(/\D/g, "");
            if (val.length <= 6) setFareAmount(val);
          }}
          placeholder="0"
          className="text-[56px] font-bold text-center text-black bg-transparent border-none outline-none w-full placeholder-gray-200"
          style={{ caretColor: "#5493b3" }}
        />
        <div className="w-16 h-0.5 bg-gray-200 rounded-full mt-1" />
      </div>

      <div className="mt-6">
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

      {isValid && (
        <div className="mt-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-full">
            <span className="text-sm text-gray-500">Each person pays</span>
            <span className="font-bold text-lg text-black">
              KSH {splitAmount.toLocaleString()}
            </span>
          </div>
        </div>
      )}

      {error && (
        <p className="text-center text-sm text-red-500 font-semibold mt-4">{error}</p>
      )}

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
            ? `Split KSH ${splitAmount.toLocaleString()} each`
            : "Enter fare & select friends"}
        </button>
      </div>
    </div>
  );
}
