import { useState } from "react";
import { useNavigate } from "react-router-dom";
import imgYutoMascot from "figma:asset/28c11cb437762e8469db46974f467144b8299a8c.png";

const friends = [
  { id: 1, name: "Jack", initial: "J" },
  { id: 2, name: "Jane", initial: "Ja" },
  { id: 3, name: "Mike", initial: "M" },
  { id: 4, name: "Sara", initial: "S" },
  { id: 5, name: "Alex", initial: "A" },
];

export default function FareShareScreen() {
  const navigate = useNavigate();
  const [fareAmount, setFareAmount] = useState("");
  const [selectedFriends, setSelectedFriends] = useState<number[]>([]);

  const totalPeople = selectedFriends.length + 1;
  const splitAmount = fareAmount ? Math.ceil(parseInt(fareAmount) / totalPeople) : 0;
  const isValid = fareAmount && parseInt(fareAmount) > 0 && selectedFriends.length > 0;

  const toggleFriend = (id: number) => {
    setSelectedFriends((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
    );
  };

  const handleSplit = () => {
    if (!isValid) return;
    const selectedNames = selectedFriends.map(
      (id) => friends.find((f) => f.id === id)!.name
    );
    navigate("/yuto/new", {
      state: {
        groupName: "Fare Share",
        amount: splitAmount,
        totalAmount: parseInt(fareAmount),
        members: ["You", ...selectedNames],
        peopleCount: totalPeople,
      },
    });
  };

  return (
    <div className="flex flex-col min-h-full px-6 pt-14">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <img src={imgYutoMascot} alt="Yuto" className="w-10 h-10 object-contain" />
        <span className="text-xl font-bold text-black">Yuto</span>
      </div>

      {/* Amount input */}
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

      {/* Friend picker */}
      <div className="mt-6">
        <p className="font-semibold text-sm text-gray-500 mb-3">Split with</p>
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
                  {friend.initial}
                </div>
                <span className="font-medium text-sm">{friend.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Split summary */}
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

      {/* Split button */}
      <div className="mt-auto pb-6 pt-8">
        <button
          onClick={handleSplit}
          disabled={!isValid}
          className={`w-full py-4 rounded-full font-bold text-lg transition-all tap-scale ${
            isValid
              ? "bg-black text-white active:scale-[0.98]"
              : "bg-gray-100 text-gray-400 cursor-not-allowed"
          }`}
        >
          {isValid ? `Split KSH ${splitAmount.toLocaleString()} each` : "Enter fare & select friends"}
        </button>
      </div>
    </div>
  );
}
