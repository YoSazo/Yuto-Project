import { useState } from "react";
import svgPaths from "../imports/svg-haowxjp8c3";
import imgChatGptImageOct142025022518Pm1 from "figma:asset/28c11cb437762e8469db46974f467144b8299a8c.png";

function MapPin({ isActive = false }: { isActive?: boolean }) {
  return (
    <div className="absolute left-[97px] size-[31px] top-[787px]">
      <svg className="block size-full" fill="none" viewBox="0 0 48 48">
        <path d="M42 20C42 34 24 46 24 46C24 46 6 34 6 20C6 15.2261 7.89642 10.6477 11.2721 7.27208C14.6477 3.89642 19.2261 2 24 2C28.7739 2 33.3523 3.89642 36.7279 7.27208C40.1036 10.6477 42 15.2261 42 20Z" stroke={isActive ? "#FFFFFF" : "#1E1E1E"} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M24 26C27.3137 26 30 23.3137 30 20C30 16.6863 27.3137 14 24 14C20.6863 14 18 16.6863 18 20C18 23.3137 20.6863 26 24 26Z" stroke={isActive ? "#FFFFFF" : "#1E1E1E"} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
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
  id: number;
  name: string;
  location: string;
  category: string;
  coordinates: { lat: number; lng: number };
  priceRange: string;
}

const venues: Venue[] = [
  {
    id: 1,
    name: "Strikez Bowling",
    location: "Westlands, Nairobi",
    category: "Bowling",
    coordinates: { lat: -1.2673, lng: 36.8112 },
    priceRange: "500 KSH"
  },
  {
    id: 2,
    name: "Strike Arcade",
    location: "Westgate Mall, Nairobi",
    category: "Arcade",
    coordinates: { lat: -1.2590, lng: 36.8037 },
    priceRange: "300 KSH"
  },
  {
    id: 3,
    name: "Century Cinemax",
    location: "Garden City Mall, Nairobi",
    category: "Movie",
    coordinates: { lat: -1.2295, lng: 36.8795 },
    priceRange: "800 KSH"
  },
  {
    id: 4,
    name: "Big Knife",
    location: "Kilimani, Nairobi",
    category: "Restaurant",
    coordinates: { lat: -1.2897, lng: 36.7850 },
    priceRange: "1200 KSH"
  }
];

// Category icons
function getCategoryIcon(category: string) {
  switch (category) {
    case "Bowling":
      return "🎳";
    case "Arcade":
      return "🕹️";
    case "Movie":
      return "🎬";
    case "Restaurant":
      return "🍽️";
    default:
      return "📍";
  }
}

interface VenuesMapScreenProps {
  onNavigate?: (screen: string, data?: { name: string; price: string }) => void;
}

export default function VenuesMapScreen({ onNavigate }: VenuesMapScreenProps) {
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);
  
  const handleGetDirections = (venue: Venue) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${venue.coordinates.lat},${venue.coordinates.lng}&destination_place_id=${encodeURIComponent(venue.name)}`;
    window.open(url, '_blank');
  };

  const handleYutoIt = () => {
    if (selectedVenue) {
      onNavigate?.('create-yuto', { 
        name: selectedVenue.name, 
        price: selectedVenue.priceRange.replace(' KSH', '') 
      });
    }
  };

  return (
    <div className="bg-white mobile-container">
      <div className="relative w-[402px] h-[874px] bg-white overflow-hidden app-frame">
        
        {/* Logo */}
        <div className="absolute left-[56px] w-[51px] h-[51px] top-[50px]">
          <img alt="Yuto mascot" className="w-full h-full object-cover" src={imgChatGptImageOct142025022518Pm1} />
        </div>
        
        {/* Title */}
        <p className="absolute font-bold text-[28px] text-black left-[37px] top-[110px]">Venues Near You</p>
        <p className="absolute text-[14px] text-gray-500 left-[37px] top-[145px]">Nairobi, Kenya</p>
        
        {/* Venue Cards */}
        <div className="absolute left-[16px] right-[16px] top-[180px] bottom-[100px] overflow-y-auto">
          <div className="flex flex-col gap-[16px] pb-[20px]">
            {venues.map((venue) => (
              <div
                key={venue.id}
                className={`bg-white border border-black rounded-[30px] shadow-[0px_4px_4px_0px_rgba(0,0,0,0.1)] p-[20px] cursor-pointer transition-all ${
                  selectedVenue?.id === venue.id ? 'ring-2 ring-[#5493b3]' : ''
                }`}
                onClick={() => setSelectedVenue(selectedVenue?.id === venue.id ? null : venue)}
              >
                {/* Header row */}
                <div className="flex items-start justify-between mb-[12px]">
                  <div className="flex items-center gap-[12px]">
                    {/* Category Icon */}
                    <div className="w-[50px] h-[50px] bg-gray-100 rounded-full flex items-center justify-center text-[24px]">
                      {getCategoryIcon(venue.category)}
                    </div>
                    
                    {/* Venue Info */}
                    <div>
                      <p className="font-bold text-[18px] text-black">{venue.name}</p>
                      <p className="text-[12px] text-gray-500">{venue.location}</p>
                    </div>
                  </div>
                  
                  {/* Price */}
                  <div className="bg-[#5493b3] text-white text-[12px] font-semibold px-[12px] py-[4px] rounded-full">
                    {venue.priceRange}
                  </div>
                </div>
                
                {/* Category Tag */}
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-gray-400 bg-gray-100 px-[12px] py-[4px] rounded-full">
                    {venue.category}
                  </span>
                  
                  {/* Get Directions Button */}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleGetDirections(venue); }}
                    className="flex items-center gap-[6px] bg-black text-white text-[12px] font-semibold px-[16px] py-[8px] rounded-full hover:bg-gray-800 transition-colors cursor-pointer border-none"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="3 11 22 2 13 21 11 13 3 11"/>
                    </svg>
                    Get Directions
                  </button>
                </div>

                {/* Expanded Content */}
                {selectedVenue?.id === venue.id && (
                  <div className="mt-[16px] pt-[16px] border-t border-gray-200">
                    <p className="text-[14px] text-gray-600 mb-[16px]">
                      Get your squad together and enjoy {venue.category.toLowerCase()} at {venue.name}! 
                      Split the cost with friends using Yuto.
                    </p>
                    
                    {/* Yuto It Button */}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleYutoIt(); }}
                      className="w-full h-[50px] bg-black text-white font-bold text-[16px] rounded-[25px] hover:bg-gray-800 transition-colors cursor-pointer border-none"
                    >
                      Yuto it! 🎉
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        
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
        <MapPin isActive />
        <Home onClick={() => onNavigate?.('your-yutos')} />
        <User onClick={() => onNavigate?.('profile')} />
      </div>
    </div>
  );
}
