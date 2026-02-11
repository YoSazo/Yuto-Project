import { useState } from "react";
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import imgYutoMascot from "figma:asset/28c11cb437762e8469db46974f467144b8299a8c.png";

export default function FareShareScreen() {
  const navigate = useNavigate();
  const { friends, addYutoGroup, venues } = useApp();
  const [fareAmount, setFareAmount] = useState("");
  const [selectedFriends, setSelectedFriends] = useState<number[]>([]);

  const toggleFriend = (id: number) => {
    setSelectedFriends(prev => 
      prev.includes(id) 
        ? prev.filter(f => f !== id) 
        : [...prev, id]
    );
  };

  const totalPeople = selectedFriends.length + 1; // +1 for yourself
  const splitAmount = fareAmount ? Math.ceil(parseInt(fareAmount) / totalPeople) : 0;
  const isValid = fareAmount && parseInt(fareAmount) > 0 && selectedFriends.length > 0;

  const handleSplit = () => {
    if (isValid) {
      // Create a fare share Yuto group
      const selectedFriendsList = friends.filter(f => selectedFriends.includes(f.id));
      const members = [
        { id: 'user-1', name: 'You', initial: 'Y', paid: false, amount: splitAmount },
        ...selectedFriendsList.map(f => ({
          id: `friend-${f.id}`,
          name: f.name,
          initial: f.initial,
          paid: false,
          amount: splitAmount,
        }))
      ];

      const newGroup = addYutoGroup({
        name: "Fare Share 🚗",
        venue: { ...venues[0], name: "Fare Share", price: splitAmount }, // Use a placeholder
        members,
        status: 'active',
        isFareShare: true,
      });

      navigate(`/yuto/${newGroup.id}`);
    }
  };

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <header className="flex items-center gap-3 px-5 pt-12 pb-4">
        <img alt="Yuto mascot" className="w-12 h-12 object-contain" src={imgYutoMascot} />
        <h1 className="text-2xl font-bold text-black">Fare Share</h1>
      </header>

      {/* Content */}
      <main className="flex-1 px-4 pb-24 space-y-6">
        {/* Fare Input Card */}
        <div className="bg-white border border-gray-200 rounded-3xl shadow-sm p-6">
          <p className="font-semibold text-black mb-3">Total Fare Amount</p>
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold text-gray-400">KSH</span>
            <input
              type="number"
              value={fareAmount}
              onChange={(e) => setFareAmount(e.target.value)}
              placeholder="0"
              className="flex-1 text-4xl font-bold text-black bg-transparent border-none outline-none"
            />
          </div>
        </div>

        {/* Select Friends */}
        <div>
          <p className="font-semibold text-black mb-4">Split with</p>
          <div className="flex flex-wrap gap-3">
            {friends.map((friend) => (
              <button
                key={friend.id}
                onClick={() => toggleFriend(friend.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full border-2 transition-all ${
                  selectedFriends.includes(friend.id)
                    ? 'bg-black border-black text-white'
                    : 'bg-white border-gray-300 text-black hover:border-black'
                }`}
              >
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                  selectedFriends.includes(friend.id) ? 'bg-white text-black' : 'bg-gray-200 text-gray-600'
                }`}>
                  {friend.initial}
                </div>
                <span className="font-medium text-sm">{friend.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Split Summary */}
        {isValid && (
          <div className="flex justify-between items-center py-2">
            <span className="text-gray-500">Each person pays</span>
            <span className="font-bold text-2xl text-primary">KSH {splitAmount.toLocaleString()}</span>
          </div>
        )}

        {/* Split Button */}
        <button
          onClick={handleSplit}
          disabled={!isValid}
          className={`w-full py-4 rounded-full font-bold text-lg transition-all ${
            isValid
              ? 'bg-black text-white hover:bg-gray-800 active:scale-[0.98]'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          {isValid ? `Split KSH ${splitAmount} each 🚗` : 'Enter fare & select friends'}
        </button>
      </main>
    </div>
  );
}
