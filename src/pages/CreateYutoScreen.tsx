import { useState } from "react";
import imgChatGptImageOct142025022518Pm1 from "figma:asset/28c11cb437762e8469db46974f467144b8299a8c.png";

interface CreateYutoScreenProps {
  venue: { name: string; price: string } | null;
  onBack: () => void;
  onCreate: (groupName: string, peopleCount: number) => void;
}

export default function CreateYutoScreen({ venue, onBack, onCreate }: CreateYutoScreenProps) {
  const [groupName, setGroupName] = useState("");
  const [peopleCount, setPeopleCount] = useState(3);

  const handleCreate = () => {
    if (groupName.trim()) {
      onCreate(groupName, peopleCount);
    }
  };

  return (
    <div className="bg-white mobile-container">
      <div className="relative w-[402px] h-[874px] bg-white app-frame">
        {/* Back button */}
        <button
          onClick={onBack}
          className="absolute left-[20px] top-[60px] text-[24px] text-gray-500 hover:text-black"
        >
          ← Back
        </button>

        {/* Logo */}
        <div className="absolute left-[56px] w-[51px] h-[51px] top-[113px]">
          <img alt="Yuto mascot" className="w-full h-full object-cover" src={imgChatGptImageOct142025022518Pm1} />
        </div>
        
        {/* Title */}
        <p className="absolute font-bold text-[30px] text-black left-[37px] top-[151px]">Create Yuto</p>
        
        {/* Venue pill */}
        {venue && (
          <div className="absolute bg-[#5493b3] border border-black rounded-[40px] shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] h-[60px] left-[13px] w-[375px] top-[210px] flex items-center justify-between px-[24px]">
            <p className="font-bold text-[18px] text-white">{venue.name}</p>
            <p className="font-bold text-[16px] text-white">Ksh {venue.price}/person</p>
          </div>
        )}

        {/* Group Name Input */}
        <div className="absolute left-[13px] top-[300px] w-[375px]">
          <p className="font-bold text-[16px] text-black mb-[10px] ml-[12px]">Group Name</p>
          <div className="bg-white border border-black rounded-[30px] shadow-[0px_4px_4px_0px_rgba(0,0,0,0.1)] h-[56px] w-full flex items-center px-[24px]">
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="e.g. Saturday Squad"
              className="w-full outline-none text-[18px] text-black bg-transparent"
              maxLength={25}
            />
          </div>
        </div>

        {/* People Count */}
        <div className="absolute left-[13px] top-[420px] w-[375px]">
          <p className="font-bold text-[16px] text-black mb-[10px] ml-[12px]">How many people?</p>
          <div className="flex items-center justify-center gap-[20px]">
            <button
              onClick={() => setPeopleCount(Math.max(2, peopleCount - 1))}
              className="w-[60px] h-[60px] bg-white border border-black rounded-full text-[28px] font-bold hover:bg-gray-100 transition-colors tap-dramatic"
            >
              −
            </button>
            <div className="w-[100px] h-[80px] bg-white border border-black rounded-[30px] shadow-[0px_4px_4px_0px_rgba(0,0,0,0.1)] flex items-center justify-center">
              <span className="text-[36px] font-bold text-black">{peopleCount}</span>
            </div>
            <button
              onClick={() => setPeopleCount(Math.min(5, peopleCount + 1))}
              className="w-[60px] h-[60px] bg-white border border-black rounded-full text-[28px] font-bold hover:bg-gray-100 transition-colors tap-dramatic"
            >
              +
            </button>
          </div>
          <p className="text-center text-[14px] text-gray-500 mt-[10px]">Min 2, Max 5 people</p>
        </div>

        {/* Total Cost Preview */}
        {venue && (
          <div className="absolute left-[13px] top-[620px] w-[375px]">
            <div className="bg-gray-50 border border-gray-200 rounded-[30px] h-[80px] w-full flex items-center justify-between px-[24px]">
              <p className="text-[16px] text-gray-600">Total Pool</p>
              <p className="font-bold text-[24px] text-black">
                {parseInt(venue.price) * peopleCount} KSH
              </p>
            </div>
          </div>
        )}

        {/* Create Button */}
        <button
          onClick={handleCreate}
          disabled={!groupName.trim()}
          className={`absolute bottom-[80px] left-[13px] w-[375px] h-[60px] rounded-[30px] font-bold text-[20px] transition-colors ${
            groupName.trim()
              ? "bg-black text-white hover:bg-gray-800 create-button-tap"
              : "bg-gray-300 text-gray-500 cursor-not-allowed"
          }`}
        >
          Create Yuto
        </button>
      </div>
    </div>
  );
}
