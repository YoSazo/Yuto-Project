import { useState } from "react";
import svgPaths from "../imports/svg-haowxjp8c3";
import imgChatGptImageOct142025022518Pm1 from "figma:asset/28c11cb437762e8469db46974f467144b8299a8c.png";
import carIcon from "../assets/car.png";

function MapPin({ onClick }: { onClick?: () => void }) {
  return (
    <div 
      className="absolute left-[97px] size-[31px] top-[787px] cursor-pointer hover:opacity-70 transition-opacity"
      onClick={onClick}
    >
      <svg className="block size-full" fill="none" viewBox="0 0 48 48">
        <path d="M42 20C42 34 24 46 24 46C24 46 6 34 6 20C6 15.2261 7.89642 10.6477 11.2721 7.27208C14.6477 3.89642 19.2261 2 24 2C28.7739 2 33.3523 3.89642 36.7279 7.27208C40.1036 10.6477 42 15.2261 42 20Z" stroke="#1E1E1E" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M24 26C27.3137 26 30 23.3137 30 20C30 16.6863 27.3137 14 24 14C20.6863 14 18 16.6863 18 20C18 23.3137 20.6863 26 24 26Z" stroke="#1E1E1E" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  );
}

function User({ onClick }: { onClick?: () => void }) {
  return (
    <div 
      className="absolute left-[274px] size-[31px] top-[787px] cursor-pointer hover:opacity-70 transition-opacity"
      onClick={onClick}
    >
      <svg className="block size-full" fill="none" viewBox="0 0 31 31">
        <path d={svgPaths.p28866700} stroke="#1E1E1E" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" />
      </svg>
    </div>
  );
}

function Home({ onClick }: { onClick?: () => void }) {
  return (
    <div 
      className="absolute h-[31px] left-[185px] top-[787px] w-[32px] cursor-pointer hover:opacity-70 transition-opacity"
      onClick={onClick}
    >
      <svg className="block size-full" fill="none" viewBox="0 0 32 31">
        <path d={svgPaths.p2eef9e80} stroke="#1E1E1E" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" />
      </svg>
    </div>
  );
}

interface FareShareScreenProps {
  onNavigate?: (screen: string) => void;
  onBack?: () => void;
}

// Friend options
const friends = [
  { id: 1, name: "Jack", initial: "J" },
  { id: 2, name: "Jane", initial: "Ja" },
  { id: 3, name: "Mike", initial: "M" },
  { id: 4, name: "Sara", initial: "S" },
  { id: 5, name: "Alex", initial: "A" },
];

export default function FareShareScreen({ onNavigate, onBack }: FareShareScreenProps) {
  const [fareAmount, setFareAmount] = useState("");
  const [selectedFriends, setSelectedFriends] = useState<number[]>([]);
  const [showSuccess, setShowSuccess] = useState(false);

  const toggleFriend = (id: number) => {
    if (selectedFriends.includes(id)) {
      setSelectedFriends(selectedFriends.filter(f => f !== id));
    } else {
      setSelectedFriends([...selectedFriends, id]);
    }
  };

  const totalPeople = selectedFriends.length + 1; // +1 for yourself
  const splitAmount = fareAmount ? Math.ceil(parseInt(fareAmount) / totalPeople) : 0;

  const handleSplit = () => {
    if (fareAmount && selectedFriends.length > 0) {
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        onNavigate?.('your-yutos');
      }, 2000);
    }
  };

  const isValid = fareAmount && parseInt(fareAmount) > 0 && selectedFriends.length > 0;

  return (
    <div className="bg-white mobile-container">
      <div className="relative w-[402px] h-[874px] bg-white overflow-hidden app-frame">
        
        {/* Back Button */}
        <button 
          className="absolute left-[20px] top-[60px] text-[24px] text-gray-500 hover:text-black bg-transparent border-none cursor-pointer"
          onClick={onBack}
        >
          ← Back
        </button>
        
        {/* Logo */}
        <div className="absolute left-[56px] w-[51px] h-[51px] top-[113px]">
          <img alt="Yuto mascot" className="w-full h-full object-cover" src={imgChatGptImageOct142025022518Pm1} />
        </div>
        
        {/* Title */}
        <p className="absolute font-bold text-[30px] text-black left-[37px] top-[151px]">Fare Share</p>
        
        {/* Car Icon Badge */}
        <div className="absolute right-[30px] top-[120px] w-[60px] h-[60px] bg-[#5493b3] rounded-full flex items-center justify-center">
          <span className="text-[28px]">🚗</span>
        </div>
        
        {/* Fare Input Card */}
        <div className="absolute left-[20px] right-[20px] top-[210px]">
          <div className="bg-white border border-black rounded-[30px] shadow-[0px_4px_4px_0px_rgba(0,0,0,0.1)] p-[24px]">
            <p className="font-semibold text-[16px] text-black mb-[12px]">Total Fare Amount</p>
            <div className="flex items-center gap-[12px]">
              <span className="text-[20px] font-bold text-gray-400">KSH</span>
              <input
                type="number"
                value={fareAmount}
                onChange={(e) => setFareAmount(e.target.value)}
                placeholder="0"
                className="flex-1 h-[50px] text-[32px] font-bold text-black bg-transparent border-none outline-none"
              />
            </div>
          </div>
        </div>
        
        {/* Select Friends */}
        <div className="absolute left-[20px] right-[20px] top-[350px]">
          <p className="font-semibold text-[16px] text-black mb-[16px]">Split with</p>
          <div className="flex flex-wrap gap-[12px]">
            {friends.map((friend) => (
              <button
                key={friend.id}
                onClick={() => toggleFriend(friend.id)}
                className={`flex items-center gap-[8px] px-[16px] py-[10px] rounded-full border-2 transition-all cursor-pointer ${
                  selectedFriends.includes(friend.id)
                    ? 'bg-black border-black text-white'
                    : 'bg-white border-gray-300 text-black hover:border-black'
                }`}
              >
                <div className={`w-[28px] h-[28px] rounded-full flex items-center justify-center text-[12px] font-bold ${
                  selectedFriends.includes(friend.id) ? 'bg-white text-black' : 'bg-gray-200 text-gray-600'
                }`}>
                  {friend.initial}
                </div>
                <span className="font-medium text-[14px]">{friend.name}</span>
              </button>
            ))}
          </div>
        </div>
        
        {/* Split Summary */}
        {isValid && (
          <div className="absolute left-[20px] right-[20px] top-[530px]">
            <div className="bg-gray-50 border border-gray-200 rounded-[25px] p-[20px]">
              <div className="flex justify-between items-center mb-[12px]">
                <span className="text-[14px] text-gray-500">Total fare</span>
                <span className="font-bold text-[16px] text-black">KSH {parseInt(fareAmount).toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center mb-[12px]">
                <span className="text-[14px] text-gray-500">Splitting with</span>
                <span className="font-bold text-[16px] text-black">{totalPeople} people</span>
              </div>
              <div className="h-[1px] bg-gray-300 my-[12px]" />
              <div className="flex justify-between items-center">
                <span className="text-[16px] font-semibold text-black">Each person pays</span>
                <span className="font-bold text-[24px] text-[#5493b3]">KSH {splitAmount.toLocaleString()}</span>
              </div>
            </div>
          </div>
        )}
        
        {/* Split Button */}
        <div className="absolute left-[20px] right-[20px] top-[700px]">
          <button
            onClick={handleSplit}
            disabled={!isValid}
            className={`w-full h-[56px] rounded-[28px] font-bold text-[18px] border-none cursor-pointer transition-all ${
              isValid
                ? 'bg-black text-white hover:bg-gray-800 active:scale-[0.98]'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {isValid ? `Split KSH ${splitAmount} each 🚗` : 'Enter fare & select friends'}
          </button>
        </div>
        
        {/* Success Overlay */}
        {showSuccess && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50">
            <div className="text-center">
              <div className="text-[80px] mb-[20px]">✅</div>
              <p className="text-white font-bold text-[24px] mb-[8px]">Fare Split Sent!</p>
              <p className="text-gray-300 text-[16px]">
                {selectedFriends.length} friends notified
              </p>
            </div>
          </div>
        )}
        
        {/* Bottom Navigation - 4 items */}
        <div className="absolute bg-white border border-black rounded-[40px] shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] h-[53px] left-[30px] w-[342px] top-[776px]" />
        {/* Venues */}
        <div 
          className="absolute bg-white border border-black rounded-[40px] shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] h-[53px] left-[30px] w-[85px] top-[776px] cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={() => onNavigate?.('venues-map')}
        />
        {/* Home */}
        <div 
          className="absolute bg-white border border-black rounded-[40px] shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] h-[53px] left-[117px] w-[85px] top-[776px] cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={() => onNavigate?.('your-yutos')}
        />
        {/* Fare Share - Active */}
        <div className="absolute bg-[#5493b3] border border-black rounded-[40px] shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] h-[53px] left-[204px] w-[85px] top-[776px]" />
        {/* Profile */}
        <div 
          className="absolute bg-white border border-black rounded-[40px] shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] h-[53px] left-[287px] w-[85px] top-[776px] cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={() => onNavigate?.('profile')}
        />
        {/* Icons */}
        <div className="absolute left-[58px] top-[787px] size-[31px] cursor-pointer hover:opacity-70" onClick={() => onNavigate?.('venues-map')}>
          <svg className="block size-full" fill="none" viewBox="0 0 48 48">
            <path d="M42 20C42 34 24 46 24 46C24 46 6 34 6 20C6 15.2261 7.89642 10.6477 11.2721 7.27208C14.6477 3.89642 19.2261 2 24 2C28.7739 2 33.3523 3.89642 36.7279 7.27208C40.1036 10.6477 42 15.2261 42 20Z" stroke="#1E1E1E" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M24 26C27.3137 26 30 23.3137 30 20C30 16.6863 27.3137 14 24 14C20.6863 14 18 16.6863 18 20C18 23.3137 20.6863 26 24 26Z" stroke="#1E1E1E" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <div className="absolute left-[144px] top-[787px] size-[31px] cursor-pointer hover:opacity-70" onClick={() => onNavigate?.('your-yutos')}>
          <svg className="block size-full" fill="none" viewBox="0 0 32 31">
            <path d={svgPaths.p2eef9e80} stroke="#1E1E1E" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" />
          </svg>
        </div>
        <div className="absolute left-[231px] top-[787px] w-[31px] h-[31px]">
          <img src={carIcon} alt="Fare Share" className="w-full h-full object-contain" />
        </div>
        <div className="absolute left-[315px] top-[787px] size-[31px] cursor-pointer hover:opacity-70" onClick={() => onNavigate?.('profile')}>
          <svg className="block size-full" fill="none" viewBox="0 0 31 31">
            <path d={svgPaths.p28866700} stroke="#1E1E1E" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" />
          </svg>
        </div>
      </div>
    </div>
  );
}
