import { useState } from "react";
import imgChatGptImageOct142025022518Pm1 from "figma:asset/28c11cb437762e8469db46974f467144b8299a8c.png";
import GlassNavBar from "../components/GlassNavBar";

// Settings icon
function SettingsIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  );
}

// Chevron right icon
function ChevronRight() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  );
}

interface ProfileScreenProps {
  onNavigate?: (screen: string) => void;
}

interface MenuItemProps {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  onClick?: () => void;
  danger?: boolean;
}

function MenuItem({ icon, label, sublabel, onClick, danger = false }: MenuItemProps) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between py-[16px] px-[20px] hover:bg-gray-50 transition-colors"
    >
      <div className="flex items-center gap-[16px]">
        <div className={`${danger ? 'text-red-500' : 'text-black'}`}>
          {icon}
        </div>
        <div className="text-left">
          <p className={`font-semibold text-[16px] ${danger ? 'text-red-500' : 'text-black'}`}>{label}</p>
          {sublabel && <p className="text-[12px] text-gray-500">{sublabel}</p>}
        </div>
      </div>
      <div className="text-gray-400">
        <ChevronRight />
      </div>
    </button>
  );
}

export default function ProfileScreen({ onNavigate }: ProfileScreenProps) {
  const [userName] = useState("Alex");
  const [phoneNumber] = useState("+254 712 345 678");
  
  // Stats
  const totalYutos = 12;
  const totalSpent = 8400;
  const friendsCount = 7;

  return (
    <div className="bg-white mobile-container">
      <div className="relative w-[402px] h-[874px] bg-white overflow-hidden app-frame">
        
        {/* Settings Icon - top right */}
        <button className="absolute right-[30px] top-[50px] hover:opacity-70 transition-opacity p-0 bg-transparent border-none text-black">
          <SettingsIcon />
        </button>
        
        {/* Title */}
        <p className="absolute font-bold text-[28px] text-black left-[30px] top-[50px]">
          Profile
        </p>
        
        {/* Profile Card */}
        <div className="absolute left-[30px] right-[30px] top-[110px]">
          <div className="bg-white border border-black rounded-[30px] shadow-[0px_4px_4px_0px_rgba(0,0,0,0.1)] p-[24px] flex items-center gap-[20px] relative">
            {/* Yuto Mascot - top right */}
            <img 
              alt="Yuto mascot" 
              className="absolute top-[12px] right-[12px] w-[32px] h-[32px] object-contain" 
              src={imgChatGptImageOct142025022518Pm1} 
            />
            
            {/* Avatar */}
            <div className="w-[80px] h-[80px] rounded-full bg-black flex items-center justify-center text-white font-bold text-[32px]">
              {userName.charAt(0).toUpperCase()}
            </div>
            
            {/* Info */}
            <div className="flex-1">
              <p className="font-bold text-[24px] text-black">{userName}</p>
              <p className="text-[14px] text-gray-500">{phoneNumber}</p>
              <button className="mt-[8px] text-[12px] text-[#5493b3] font-semibold hover:underline">
                Edit Profile
              </button>
            </div>
          </div>
        </div>
        
        {/* Stats Row */}
        <div className="absolute left-[30px] right-[30px] top-[260px]">
          <div className="flex gap-[12px]">
            {/* Yutos */}
            <div className="flex-1 bg-white border border-black rounded-[20px] shadow-[0px_4px_4px_0px_rgba(0,0,0,0.1)] py-[16px] px-[12px] text-center">
              <p className="font-bold text-[24px] text-black">{totalYutos}</p>
              <p className="text-[12px] text-gray-500">Yutos</p>
            </div>
            
            {/* Spent */}
            <div className="flex-1 bg-white border border-black rounded-[20px] shadow-[0px_4px_4px_0px_rgba(0,0,0,0.1)] py-[16px] px-[12px] text-center">
              <p className="font-bold text-[20px] text-black">{totalSpent.toLocaleString()}</p>
              <p className="text-[12px] text-gray-500">KSH Spent</p>
            </div>
            
            {/* Friends */}
            <div className="flex-1 bg-white border border-black rounded-[20px] shadow-[0px_4px_4px_0px_rgba(0,0,0,0.1)] py-[16px] px-[12px] text-center">
              <p className="font-bold text-[24px] text-black">{friendsCount}</p>
              <p className="text-[12px] text-gray-500">Friends</p>
            </div>
          </div>
        </div>
        
        {/* Menu Section */}
        <div className="absolute left-[30px] right-[30px] top-[380px]">
          <div className="bg-white border border-black rounded-[30px] shadow-[0px_4px_4px_0px_rgba(0,0,0,0.1)] overflow-hidden">
            <MenuItem
              icon={
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
                  <line x1="1" y1="10" x2="23" y2="10"/>
                </svg>
              }
              label="Payment Methods"
              sublabel="M-PESA linked"
            />
            
            <div className="h-[1px] bg-gray-200 mx-[20px]" />
            
            <MenuItem
              icon={
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
              }
              label="Yuto History"
              sublabel="View past outings"
            />
            
            <div className="h-[1px] bg-gray-200 mx-[20px]" />
            
            <MenuItem
              icon={
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
              }
              label="Friends"
              sublabel="7 friends added"
            />
            
            <div className="h-[1px] bg-gray-200 mx-[20px]" />
            
            <MenuItem
              icon={
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                </svg>
              }
              label="Settings"
              sublabel="App preferences"
            />
          </div>
        </div>
        
        
        
        {/* Glass Navigation Bar */}
        <GlassNavBar activeTab="profile" onNavigate={(screen) => onNavigate?.(screen)} />
      </div>
    </div>
  );
}
