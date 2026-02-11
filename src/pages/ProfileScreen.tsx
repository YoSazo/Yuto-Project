import { useState } from "react";
import svgPaths from "../imports/svg-haowxjp8c3";
import imgChatGptImageOct142025022518Pm1 from "figma:asset/28c11cb437762e8469db46974f467144b8299a8c.png";

function CarIcon({ isActive = false, onClick }: { isActive?: boolean; onClick?: () => void }) {
  return (
    <div className="absolute left-[230px] top-[787px] size-[31px] cursor-pointer hover:opacity-70" onClick={onClick}>
      <svg className="block size-full" viewBox="0 0 24 24" fill="none" stroke={isActive ? "#FFFFFF" : "#1E1E1E"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 17h14v-5l-1.5-4.5h-11L5 12v5z"/>
        <circle cx="7" cy="17" r="2"/>
        <circle cx="17" cy="17" r="2"/>
        <path d="M5 9h14"/>
      </svg>
    </div>
  );
}

function MapPin({ onClick }: { onClick?: () => void }) {
  return (
    <div 
      className="absolute left-[97px] size-[31px] top-[787px] cursor-pointer hover:opacity-70 transition-opacity z-10"
      onClick={onClick}
    >
      <svg className="block size-full" fill="none" viewBox="0 0 48 48">
        <path d="M42 20C42 34 24 46 24 46C24 46 6 34 6 20C6 15.2261 7.89642 10.6477 11.2721 7.27208C14.6477 3.89642 19.2261 2 24 2C28.7739 2 33.3523 3.89642 36.7279 7.27208C40.1036 10.6477 42 15.2261 42 20Z" stroke="#1E1E1E" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M24 26C27.3137 26 30 23.3137 30 20C30 16.6863 27.3137 14 24 14C20.6863 14 18 16.6863 18 20C18 23.3137 20.6863 26 24 26Z" stroke="#1E1E1E" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  );
}

function User({ isActive = false }: { isActive?: boolean }) {
  return (
    <div className="absolute left-[274px] size-[31px] top-[787px]">
      <svg className="block size-full" fill="none" viewBox="0 0 31 31">
        <path d={svgPaths.p28866700} stroke={isActive ? "#FFFFFF" : "#1E1E1E"} strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" />
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
        {/* Fare Share */}
        <div 
          className="absolute bg-white border border-black rounded-[40px] shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] h-[53px] left-[204px] w-[85px] top-[776px] cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={() => onNavigate?.('fare-share')}
        />
        {/* Profile - Active */}
        <div className="absolute bg-[#5493b3] border border-black rounded-[40px] shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] h-[53px] left-[287px] w-[85px] top-[776px]" />
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
        <CarIcon onClick={() => onNavigate?.('fare-share')} />
        <div className="absolute left-[315px] top-[787px] size-[31px]">
          <svg className="block size-full" fill="none" viewBox="0 0 31 31">
            <path d={svgPaths.p28866700} stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" />
          </svg>
        </div>
      </div>
    </div>
  );
}
