import { useState } from "react";
import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import imgYutoMascot from "figma:asset/28c11cb437762e8469db46974f467144b8299a8c.png";

export default function CreateYutoScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { venues, friends, addYutoGroup } = useApp();
  
  // Get venue from navigation state or default to first venue
  const venueId = location.state?.venueId;
  const venue = venues.find(v => v.id === venueId) || venues[0];
  
  const [groupName, setGroupName] = useState("");
  const [peopleCount, setPeopleCount] = useState(2);

  const handleCreate = () => {
    if (groupName.trim() && venue) {
      const splitPrice = Math.ceil(venue.price / peopleCount);
      
      // Create members (you + random friends)
      const members = [
        { id: 'user-1', name: 'You', initial: 'Y', paid: false, amount: splitPrice },
        ...friends.slice(0, peopleCount - 1).map(f => ({
          id: `friend-${f.id}`,
          name: f.name,
          initial: f.initial,
          paid: false,
          amount: splitPrice,
        }))
      ];

      const newGroup = addYutoGroup({
        name: groupName,
        venue: venue,
        members,
        status: 'active',
      });

      navigate(`/yuto/${newGroup.id}`);
    }
  };

  const splitPrice = Math.ceil(venue.price / peopleCount);

  return (
    <div className="flex flex-col min-h-full">
      {/* Header with back button */}
      <header className="flex items-center gap-3 px-5 pt-12 pb-4">
        <button 
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <img alt="Yuto mascot" className="w-10 h-10 object-contain" src={imgYutoMascot} />
        <h1 className="text-xl font-bold text-black">Create a Yuto</h1>
      </header>

      {/* Content */}
      <main className="flex-1 px-5 pb-8 space-y-6">
        {/* Venue Card */}
        <div className="bg-gray-100 rounded-2xl p-4">
          <p className="text-sm text-gray-500 mb-1">Selected Venue</p>
          <p className="font-bold text-lg text-black">{venue.name}</p>
          <p className="text-primary font-semibold">{venue.price} KSH per person</p>
        </div>

        {/* Group Name Input */}
        <div>
          <label className="block font-semibold text-black mb-2">Group Name</label>
          <input
            type="text"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="e.g., Friday Squad"
            className="w-full px-5 py-4 bg-white border border-gray-300 rounded-2xl text-black placeholder-gray-400 outline-none focus:border-black transition-colors"
          />
        </div>

        {/* People Count */}
        <div>
          <label className="block font-semibold text-black mb-2">How many people?</label>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setPeopleCount(Math.max(2, peopleCount - 1))}
              className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-2xl font-bold hover:bg-gray-200 transition-colors"
            >
              −
            </button>
            <span className="text-3xl font-bold text-black w-16 text-center">{peopleCount}</span>
            <button
              onClick={() => setPeopleCount(Math.min(20, peopleCount + 1))}
              className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-2xl font-bold hover:bg-gray-200 transition-colors"
            >
              +
            </button>
          </div>
        </div>

        {/* Split Preview */}
        <div className="bg-primary/10 rounded-2xl p-4">
          <p className="text-sm text-gray-600 mb-1">Each person pays</p>
          <p className="font-bold text-2xl text-primary">{splitPrice.toLocaleString()} KSH</p>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Create Button */}
        <button
          onClick={handleCreate}
          disabled={!groupName.trim()}
          className={`w-full py-4 rounded-full font-bold text-lg transition-all ${
            groupName.trim()
              ? 'bg-black text-white hover:bg-gray-800'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          Create Yuto 🎉
        </button>
      </main>
    </div>
  );
}
