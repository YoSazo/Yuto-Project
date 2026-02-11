import { useState } from "react";
import svgPaths from "../imports/svg-haowxjp8c3";
import imgChatGptImageOct142025022518Pm1 from "figma:asset/28c11cb437762e8469db46974f467144b8299a8c.png";
import carIcon from "../assets/car.png";

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
    name: "Century Cinemax",
    location: "Garden City Mall, Nairobi",
    category: "Movie",
    coordinates: { lat: -1.2295, lng: 36.8795 },
    priceRange: "800 KSH"
  },
  {
    id: 3,
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

// Venue descriptions
function getVenueDescription(name: string) {
  switch (name) {
    case "Strikez Bowling":
      return "Nairobi's premier bowling alley with 12 lanes, great music, and a fully stocked bar. Perfect for group hangouts!";
    case "Century Cinemax":
      return "State-of-the-art cinema with IMAX screens, Dolby sound, and comfy recliners. Catch the latest blockbusters here.";
    case "Big Knife":
      return "Upscale steakhouse known for their signature cuts and vibrant atmosphere. Great for celebrations!";
    default:
      return "A great venue for your next group outing.";
  }
}

// Venue hours
function getVenueHours(name: string) {
  switch (name) {
    case "Strikez Bowling":
      return "Mon-Sun: 10AM - 11PM";
    case "Century Cinemax":
      return "Mon-Sun: 9AM - 12AM";
    case "Big Knife":
      return "Mon-Sat: 12PM - 11PM";
    default:
      return "Hours vary";
  }
}

// Venue Modal Component
function VenueModal({ 
  venue, 
  onClose, 
  onYutoIt, 
  onGetDirections 
}: { 
  venue: Venue; 
  onClose: () => void; 
  onYutoIt: () => void;
  onGetDirections: () => void;
}) {
  return (
    <div 
      className="absolute inset-0 bg-black/50 flex items-center justify-center z-50 p-[20px]"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-[30px] w-full max-w-[360px] p-[24px] shadow-[0px_8px_30px_0px_rgba(0,0,0,0.3)] relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button 
          onClick={onClose}
          className="absolute top-[16px] right-[16px] w-[32px] h-[32px] bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors border-none cursor-pointer"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>

        {/* Category Icon */}
        <div className="w-[70px] h-[70px] bg-gray-100 rounded-full flex items-center justify-center text-[36px] mx-auto mb-[16px]">
          {getCategoryIcon(venue.category)}
        </div>

        {/* Venue Name */}
        <h2 className="font-bold text-[24px] text-black text-center mb-[4px]">{venue.name}</h2>
        
        {/* Location */}
        <p className="text-[14px] text-gray-500 text-center mb-[8px]">📍 {venue.location}</p>
        
        {/* Price & Category */}
        <div className="flex items-center justify-center gap-[10px] mb-[16px]">
          <span className="bg-[#5493b3] text-white text-[12px] font-semibold px-[12px] py-[4px] rounded-full">
            {venue.priceRange}
          </span>
          <span className="bg-gray-100 text-gray-600 text-[12px] px-[12px] py-[4px] rounded-full">
            {venue.category}
          </span>
        </div>

        {/* Description */}
        <p className="text-[14px] text-gray-600 text-center mb-[16px] leading-[1.5]">
          {getVenueDescription(venue.name)}
        </p>

        {/* Hours */}
        <div className="bg-gray-50 rounded-[15px] p-[12px] mb-[20px]">
          <p className="text-[12px] text-gray-500 text-center">
            🕐 {getVenueHours(venue.name)}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-[10px]">
          <button
            onClick={onYutoIt}
            className="w-full h-[50px] bg-black text-white font-bold text-[16px] rounded-[25px] hover:bg-gray-800 transition-colors cursor-pointer border-none"
          >
            Yuto it! 🎉
          </button>
          
          <button
            onClick={onGetDirections}
            className="w-full h-[44px] bg-white text-black font-semibold text-[14px] rounded-[22px] border border-black hover:bg-gray-50 transition-colors cursor-pointer flex items-center justify-center gap-[8px]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="3 11 22 2 13 21 11 13 3 11"/>
            </svg>
            Get Directions
          </button>
        </div>
      </div>
    </div>
  );
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
        <div className="absolute left-[56px] w-[51px] h-[51px] top-[113px]">
          <img alt="Yuto mascot" className="w-full h-full object-cover" src={imgChatGptImageOct142025022518Pm1} />
        </div>
        
        {/* Title */}
        <p className="absolute font-bold text-[30px] text-black left-[37px] top-[151px]">Venues Near You</p>
        
        {/* Venue Cards */}
        <div className="absolute left-[16px] right-[16px] top-[216px] bottom-[100px] overflow-y-auto">
          <div className="flex flex-col gap-[16px] pb-[20px]">
            {venues.map((venue) => (
              <div
                key={venue.id}
                className="bg-white border border-black rounded-[30px] shadow-[0px_4px_4px_0px_rgba(0,0,0,0.1)] p-[20px] cursor-pointer transition-all hover:shadow-[0px_6px_12px_0px_rgba(0,0,0,0.15)] active:scale-[0.98]"
                onClick={() => setSelectedVenue(venue)}
              >
                {/* Header row */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-[12px]">
                    {/* Category Icon */}
                    <div className="w-[50px] h-[50px] bg-gray-100 rounded-full flex items-center justify-center text-[24px]">
                      {getCategoryIcon(venue.category)}
                    </div>
                    
                    {/* Venue Info */}
                    <div>
                      <p className="font-bold text-[18px] text-black">{venue.name}</p>
                      <p className="text-[12px] text-gray-500">{venue.location}</p>
                      <span className="text-[12px] text-gray-400 bg-gray-100 px-[10px] py-[2px] rounded-full mt-[4px] inline-block">
                        {venue.category}
                      </span>
                    </div>
                  </div>
                  
                  {/* Price */}
                  <div className="bg-[#5493b3] text-white text-[12px] font-semibold px-[12px] py-[4px] rounded-full">
                    {venue.priceRange}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Bottom Navigation - 4 items */}
        <div className="absolute bg-white border border-black rounded-[40px] shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] h-[53px] left-[30px] w-[342px] top-[776px]" />
        {/* Venues - Active */}
        <div className="absolute bg-[#5493b3] border border-black rounded-[40px] shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] h-[53px] left-[30px] w-[85px] top-[776px]" />
        {/* Home */}
        <div 
          className="absolute bg-white border border-black rounded-[40px] shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] h-[53px] left-[117px] w-[85px] top-[776px] cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={() => onNavigate?.('your-yutos')}
        />
        {/* Fare Share */}
        <div 
          className="absolute bg-white border border-black rounded-[40px] shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] h-[53px] left-[204px] w-[85px] top-[776px] cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={() => onNavigate?.('fare-share')}
        />
        {/* Profile */}
        <div 
          className="absolute bg-white border border-black rounded-[40px] shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] h-[53px] left-[287px] w-[85px] top-[776px] cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={() => onNavigate?.('profile')}
        />
        {/* Icons */}
        <div className="absolute left-[58px] top-[787px] size-[31px]">
          <svg className="block size-full" fill="none" viewBox="0 0 48 48">
            <path d="M42 20C42 34 24 46 24 46C24 46 6 34 6 20C6 15.2261 7.89642 10.6477 11.2721 7.27208C14.6477 3.89642 19.2261 2 24 2C28.7739 2 33.3523 3.89642 36.7279 7.27208C40.1036 10.6477 42 15.2261 42 20Z" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M24 26C27.3137 26 30 23.3137 30 20C30 16.6863 27.3137 14 24 14C20.6863 14 18 16.6863 18 20C18 23.3137 20.6863 26 24 26Z" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <div className="absolute left-[144px] top-[787px] size-[31px] cursor-pointer hover:opacity-70" onClick={() => onNavigate?.('your-yutos')}>
          <svg className="block size-full" fill="none" viewBox="0 0 32 31">
            <path d={svgPaths.p2eef9e80} stroke="#1E1E1E" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" />
          </svg>
        </div>
        <div className="absolute left-[218px] top-[786px] w-[38px] h-[32px] cursor-pointer hover:opacity-70" onClick={() => onNavigate?.('fare-share')}>
          <img src={carIcon} alt="Fare Share" className="w-full h-full object-contain" />
        </div>
        <div className="absolute left-[315px] top-[787px] size-[31px] cursor-pointer hover:opacity-70" onClick={() => onNavigate?.('profile')}>
          <svg className="block size-full" fill="none" viewBox="0 0 31 31">
            <path d={svgPaths.p28866700} stroke="#1E1E1E" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" />
          </svg>
        </div>

        {/* Venue Detail Modal */}
        {selectedVenue && (
          <VenueModal
            venue={selectedVenue}
            onClose={() => setSelectedVenue(null)}
            onYutoIt={() => {
              onNavigate?.('create-yuto', { 
                name: selectedVenue.name, 
                price: selectedVenue.priceRange.replace(' KSH', '') 
              });
            }}
            onGetDirections={() => handleGetDirections(selectedVenue)}
          />
        )}
      </div>
    </div>
  );
}
