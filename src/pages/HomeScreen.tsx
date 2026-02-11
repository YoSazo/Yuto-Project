import { useState } from "react";
import svgPaths from "../imports/svg-haowxjp8c3";
import imgChatGptImageOct142025022518Pm1 from "figma:asset/28c11cb437762e8469db46974f467144b8299a8c.png";

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

interface Venue {
  name: string;
  price: string;
  description: string;
}

const venues: Venue[] = [
  { name: "Bowling", price: "500 KSH", description: "Strike up some fun with friends! Shoes included." },
  { name: "Arcade", price: "300 KSH", description: "Retro games and new favorites. Tokens included." },
  { name: "Movie", price: "800 KSH", description: "Latest blockbusters on the big screen. Popcorn included." },
  { name: "Picnic", price: "200 KSH", description: "Outdoor vibes at Uhuru Gardens. Bring your own snacks!" },
];

interface Venue {
  name: string;
  price: string;
  description: string;
}

interface HomeScreenProps {
  onNavigate?: (screen: string, venue?: { name: string; price: string }) => void;
}

export default function HomeScreen({ onNavigate }: HomeScreenProps) {
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  const handleVenueClick = (venue: Venue) => {
    setSelectedVenue(venue);
    setIsAnimating(true);
  };

  const handleClose = () => {
    setIsAnimating(false);
    setTimeout(() => setSelectedVenue(null), 300);
  };

  const handleYutoIt = () => {
    // Navigate to create Yuto group with this venue
    if (selectedVenue) {
      onNavigate?.("create-yuto", { name: selectedVenue.name, price: selectedVenue.price });
    }
  };

  return (
    <div className="bg-white mobile-container">
      <div className="relative w-[402px] h-[874px] bg-white overflow-hidden app-frame">
        {/* Logo */}
        <div className="absolute left-[56px] w-[51px] h-[51px] top-[113px]">
          <img alt="Yuto mascot" className="w-full h-full object-cover" src={imgChatGptImageOct142025022518Pm1} />
        </div>
        
        {/* Title */}
        <p className="absolute font-bold text-[30px] text-black left-[37px] top-[151px]">Venues</p>
        
        {/* Venue Cards */}
        {venues.map((venue, index) => (
          <div
            key={venue.name}
            onClick={() => handleVenueClick(venue)}
            className={`absolute bg-white border border-black rounded-[40px] shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] h-[80px] left-[13px] w-[375px] cursor-pointer hover:bg-gray-50 transition-all duration-200`}
            style={{ top: `${216 + index * 94}px` }}
          >
            <p className="absolute font-bold text-[20px] text-black left-[24px] top-[25px]">{venue.name}</p>
            <p className="absolute font-bold text-[18px] text-black right-[24px] top-[25px]">{venue.price}</p>
          </div>
        ))}
        
        {/* Expanded Venue Modal */}
        {selectedVenue && (
          <div
            className={`absolute bg-white border border-black rounded-[40px] shadow-[0px_8px_16px_0px_rgba(0,0,0,0.25)] left-[13px] w-[375px] transition-all duration-300 ease-out ${
              isAnimating 
                ? "top-[113px] h-[650px] opacity-100" 
                : "top-[216px] h-[80px] opacity-0"
            }`}
          >
            {/* Close button */}
            <button
              onClick={handleClose}
              className="absolute top-[20px] right-[24px] text-[24px] text-gray-500 hover:text-black"
            >
              ✕
            </button>
            
            {/* Venue name */}
            <p className="absolute font-bold text-[28px] text-black left-[24px] top-[30px]">{selectedVenue.name}</p>
            
            {/* Price */}
            <p className="absolute font-bold text-[22px] text-[#5493b3] left-[24px] top-[70px]">{selectedVenue.price} <span className="text-[16px] text-gray-500 font-normal">per person</span></p>
            
            {/* Description */}
            <p className="absolute text-[16px] text-gray-600 left-[24px] right-[24px] top-[120px] leading-relaxed">
              {selectedVenue.description}
            </p>
            
            {/* Divider */}
            <div className="absolute left-[24px] right-[24px] top-[180px] h-[1px] bg-gray-200" />
            
            {/* Info section */}
            <div className="absolute left-[24px] top-[200px]">
              <p className="text-[14px] text-gray-500 mb-2">📍 Nairobi, Kenya</p>
              <p className="text-[14px] text-gray-500 mb-2">⏰ Open until 10 PM</p>
              <p className="text-[14px] text-gray-500">👥 Great for groups of 4-10</p>
            </div>
            
            {/* Yuto it! Button */}
            <button
              onClick={handleYutoIt}
              className="absolute bottom-[40px] left-[24px] right-[24px] h-[56px] bg-black rounded-[30px] text-white font-bold text-[18px] hover:bg-gray-800 transition-colors"
            >
              Yuto it!
            </button>
          </div>
        )}
        
        {/* Bottom Navigation */}
        <div className="absolute bg-white border border-black rounded-[40px] shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] h-[53px] left-[69px] w-[264px] top-[776px]" />
        <div className="absolute bg-[#5493b3] border border-black rounded-[40px] shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] h-[53px] left-[69px] w-[86px] top-[776px]" />
        <div 
          className="absolute bg-white border border-black rounded-[40px] shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] h-[53px] left-[158px] w-[87px] top-[776px] cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={() => onNavigate?.('your-yutos')}
        />
        <div 
          className="absolute bg-white border border-black rounded-[40px] shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] h-[53px] left-[247px] w-[86px] top-[776px] cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={() => onNavigate?.('profile')}
        />
        <MapPin onClick={() => onNavigate?.('venues-map')} />
        <User onClick={() => onNavigate?.('profile')} />
        <Home onClick={() => onNavigate?.('your-yutos')} />
      </div>
    </div>
  );
}
