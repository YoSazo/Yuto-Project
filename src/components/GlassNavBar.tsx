import svgPaths from "../imports/svg-haowxjp8c3";

type NavTab = 'venues' | 'home' | 'fare-share' | 'profile';

interface GlassNavBarProps {
  activeTab: NavTab;
  onNavigate: (screen: string) => void;
}

// Tab configuration
const tabs: { id: NavTab; screen: string; position: number }[] = [
  { id: 'venues', screen: 'venues-map', position: 0 },
  { id: 'home', screen: 'your-yutos', position: 1 },
  { id: 'fare-share', screen: 'fare-share', position: 2 },
  { id: 'profile', screen: 'profile', position: 3 },
];

export default function GlassNavBar({ activeTab, onNavigate }: GlassNavBarProps) {
  const activeIndex = tabs.findIndex(t => t.id === activeTab);
  
  // Calculate pill position (each tab is ~78px wide with gaps)
  const pillOffset = 6 + activeIndex * 82; // 6px initial padding + 82px per tab
  
  return (
    <div className="absolute left-[30px] right-[30px] top-[776px] h-[53px]">
      {/* Glass background container */}
      <div 
        className="absolute inset-0 rounded-[40px] overflow-hidden"
        style={{
          background: 'rgba(255, 255, 255, 0.25)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.4)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.6)',
        }}
      />
      
      {/* Sliding pill indicator */}
      <div 
        className="absolute top-[6px] h-[41px] w-[76px] rounded-[30px] transition-all duration-300 ease-out"
        style={{
          left: `${pillOffset}px`,
          background: 'rgba(255, 255, 255, 0.85)',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
        }}
      />
      
      {/* Tab icons container */}
      <div className="absolute inset-0 flex items-center justify-around px-[12px]">
        {/* Venues (Map Pin) */}
        <button 
          className="relative z-10 flex items-center justify-center w-[60px] h-[40px] bg-transparent border-none cursor-pointer transition-transform duration-200 hover:scale-110"
          onClick={() => onNavigate('venues-map')}
        >
          <svg className="w-[26px] h-[26px]" fill="none" viewBox="0 0 48 48">
            <path 
              d="M42 20C42 34 24 46 24 46C24 46 6 34 6 20C6 15.2261 7.89642 10.6477 11.2721 7.27208C14.6477 3.89642 19.2261 2 24 2C28.7739 2 33.3523 3.89642 36.7279 7.27208C40.1036 10.6477 42 15.2261 42 20Z" 
              stroke={activeTab === 'venues' ? "#1E1E1E" : "#666666"} 
              strokeWidth="4" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            />
            <path 
              d="M24 26C27.3137 26 30 23.3137 30 20C30 16.6863 27.3137 14 24 14C20.6863 14 18 16.6863 18 20C18 23.3137 20.6863 26 24 26Z" 
              stroke={activeTab === 'venues' ? "#1E1E1E" : "#666666"} 
              strokeWidth="4" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            />
          </svg>
        </button>
        
        {/* Home */}
        <button 
          className="relative z-10 flex items-center justify-center w-[60px] h-[40px] bg-transparent border-none cursor-pointer transition-transform duration-200 hover:scale-110"
          onClick={() => onNavigate('your-yutos')}
        >
          <svg className="w-[26px] h-[26px]" fill="none" viewBox="0 0 32 31">
            <path 
              d={svgPaths.p2eef9e80} 
              stroke={activeTab === 'home' ? "#1E1E1E" : "#666666"} 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth="4" 
            />
          </svg>
        </button>
        
        {/* Fare Share (Car) */}
        <button 
          className="relative z-10 flex items-center justify-center w-[60px] h-[40px] bg-transparent border-none cursor-pointer transition-transform duration-200 hover:scale-110"
          onClick={() => onNavigate('fare-share')}
        >
          <svg className="w-[26px] h-[26px]" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 17h14v-5l-1.5-4.5h-11L5 12v5z" stroke={activeTab === 'fare-share' ? "#1E1E1E" : "#666666"}/>
            <circle cx="7" cy="17" r="2" stroke={activeTab === 'fare-share' ? "#1E1E1E" : "#666666"}/>
            <circle cx="17" cy="17" r="2" stroke={activeTab === 'fare-share' ? "#1E1E1E" : "#666666"}/>
            <path d="M5 9h14" stroke={activeTab === 'fare-share' ? "#1E1E1E" : "#666666"}/>
          </svg>
        </button>
        
        {/* Profile (User) */}
        <button 
          className="relative z-10 flex items-center justify-center w-[60px] h-[40px] bg-transparent border-none cursor-pointer transition-transform duration-200 hover:scale-110"
          onClick={() => onNavigate('profile')}
        >
          <svg className="w-[26px] h-[26px]" fill="none" viewBox="0 0 31 31">
            <path 
              d={svgPaths.p28866700} 
              stroke={activeTab === 'profile' ? "#1E1E1E" : "#666666"} 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth="4" 
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
