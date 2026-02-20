import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import imgYutoMascot from "figma:asset/28c11cb437762e8469db46974f467144b8299a8c.png";
import { useAuth } from "../contexts/AuthContext";
import { getFriends, createGroup } from "../lib/supabase";
import UserAvatar from "../components/UserAvatar";
import { Car } from "lucide-react";

interface Friend {
  id: string;
  username: string;
  display_name: string;
}

type RideType = "single" | "multi" | null;

export default function FareShareScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [rideType, setRideType] = useState<RideType>(null);
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
  const isValidSingle = rideType === "single" && fareAmount && parseInt(fareAmount) > 0 && selectedFriends.length > 0;
  const isValidMulti = rideType === "multi" && selectedFriends.length > 0;
  const isValid = isValidSingle || isValidMulti;

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
        rideType === "single" ? parseInt(fareAmount) : 0,
        rideType === "single" ? splitAmount : 0,
        user.id,
        [user.id, ...selectedFriends],
        rideType as "single" | "multi"
      );
      navigate(`/yuto/${group.id}`);
    } catch (err) {
      console.error("Failed to create group:", err);
      setError(err instanceof Error ? err.message : "Failed to create group. Try again.");
    } finally {
      setIsCreating(false);
    }
  };

  // ── Step 1: Pick ride type ───────────────────────────
  if (rideType === null) {
    return (
      <div className="flex flex-col min-h-full px-6 pt-14">
        <div className="flex items-center gap-3 mb-10">
          <img src={imgYutoMascot} alt="Yuto" className="w-10 h-10 object-contain" />
          <span className="text-xl font-bold text-black">Yuto</span>
        </div>

        <h2 className="text-2xl font-bold text-black mb-2">How are you riding?</h2>
        <p className="text-sm text-gray-400 mb-8">Choose how your group is getting there</p>

        <div className="flex flex-col gap-4">
          <button
            onClick={() => setRideType("single")}
            className="w-full p-5 rounded-2xl border-2 border-gray-200 text-left hover:border-black transition-all tap-scale bg-white"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center text-gray-600"><Car size={24} /></div>
              <div>
                <p className="font-bold text-base text-black">Same ride</p>
                <p className="text-sm text-gray-400 mt-0.5">One bolt, splitting the cost</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => setRideType("multi")}
            className="w-full p-5 rounded-2xl border-2 border-gray-200 text-left hover:border-black transition-all tap-scale bg-white"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center text-2xl">🚕</div>
              <div>
                <p className="font-bold text-base text-black">Separate rides</p>
                <p className="text-sm text-gray-400 mt-0.5">Everyone takes their own ride, split the total fairly</p>
              </div>
            </div>
          </button>
        </div>
      </div>
    );
  }

  // ── Step 2: Single or Multi ride form ───────────────
  return (
    <div className="flex flex-col min-h-full px-6 pt-14">
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={() => { setRideType(null); setFareAmount(""); setSelectedFriends([]); setError(""); }}
          className="text-gray-400 hover:text-black bg-transparent border-none cursor-pointer text-base mr-1"
        >
          ←
        </button>
        <img src={imgYutoMascot} alt="Yuto" className="w-10 h-10 object-contain" />
        <span className="text-xl font-bold text-black">
          {rideType === "single" ? "Same Ride" : "Separate Rides"}
        </span>
      </div>

      {rideType === "single" && (
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
      )}

      {rideType === "multi" && (
        <div className="flex flex-col items-center py-6">
          <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mb-3">
            <span className="text-3xl">🚕</span>
          </div>
          <p className="text-base font-semibold text-black text-center">Everyone enters their own fare</p>
          <p className="text-sm text-gray-400 text-center mt-1">Once the group is created, each person enters what their ride cost. The total gets split equally.</p>
        </div>
      )}

      <div className="mt-4">
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
                  <UserAvatar name={friend.display_name} avatarUrl={friend.avatar_url} size="sm" className={selected ? "ring-2 ring-white" : ""} />
                  <span className="font-medium text-sm">{friend.display_name}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {isValidSingle && (
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
            : isValidSingle
            ? `Split KSH ${splitAmount.toLocaleString()} each`
            : isValidMulti
            ? "Create Split"
            : rideType === "single"
            ? "Enter fare & select friends"
            : "Select friends to split with"}
        </button>
      </div>
    </div>
  );
}
