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

function Home({ isActive = false }: { isActive?: boolean }) {
  return (
    <div className="absolute h-[31px] left-[185px] top-[787px] w-[32px]">
      <svg className="block size-full" fill="none" viewBox="0 0 32 31">
        <path d={svgPaths.p2eef9e80} stroke={isActive ? "#FFFFFF" : "#1E1E1E"} strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" />
      </svg>
    </div>
  );
}

interface YutoGroupData {
  id: number;
  name: string;
  venue: { name: string; price: string };
  members: number;
  status: 'active' | 'completed' | 'pending';
}

const myYutos: YutoGroupData[] = [
  { id: 1, name: "Saturday Squad", venue: { name: "Bowling", price: "500" }, members: 4, status: 'active' },
  { id: 2, name: "Movie Night", venue: { name: "Movie", price: "800" }, members: 3, status: 'completed' },
  { id: 3, name: "Arcade Gang", venue: { name: "Arcade", price: "300" }, members: 5, status: 'completed' },
];

interface YourYutosScreenProps {
  onNavigate?: (screen: string, data?: { name: string; venue: { name: string; price: string }; peopleCount: number }) => void;
}

export default function YourYutosScreen({ onNavigate }: YourYutosScreenProps) {
  return (
    <div className="bg-white mobile-container">
      <div className="relative w-[402px] h-[874px] bg-white overflow-hidden app-frame">
        
        {/* Logo */}
        <div className="absolute left-[56px] w-[51px] h-[51px] top-[113px]">
          <img alt="Yuto mascot" className="w-full h-full object-cover" src={imgChatGptImageOct142025022518Pm1} />
        </div>
        
        {/* Title */}
        <p className="absolute font-bold text-[30px] text-black left-[37px] top-[151px]">Your Yutos</p>
        
        {/* Yuto Cards */}
        {myYutos.map((yuto, index) => (
          <div
            key={yuto.id}
            className="absolute bg-white border border-black rounded-[40px] shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] h-[120px] left-[13px] w-[375px] cursor-pointer hover:bg-gray-50 transition-all duration-200"
            style={{ top: `${216 + index * 134}px` }}
            onClick={() => onNavigate?.('yuto-group', { 
              name: yuto.name, 
              venue: yuto.venue, 
              peopleCount: yuto.members 
            })}
          >
            {/* Status indicator */}
            <div 
              className={`absolute top-[14px] right-[18px] px-[12px] py-[4px] rounded-full text-[10px] font-semibold ${
                yuto.status === 'active' 
                  ? 'bg-[#5493b3] text-white' 
                  : yuto.status === 'completed'
                  ? 'bg-gray-200 text-gray-600'
                  : 'bg-yellow-100 text-yellow-700'
              }`}
            >
              {yuto.status === 'active' ? 'Active' : yuto.status === 'completed' ? 'Completed' : 'Pending'}
            </div>
            
            {/* Group name */}
            <p className="absolute font-bold text-[18px] text-black left-[24px] top-[18px] right-[100px] truncate whitespace-nowrap overflow-hidden">{yuto.name}</p>
            
            {/* Venue */}
            <p className="absolute text-[14px] text-gray-500 left-[24px] top-[44px]">{yuto.venue.name}</p>
            
            {/* Bottom row */}
            <div className="absolute bottom-[16px] left-[24px] right-[24px] flex justify-between items-center">
              {/* Member circles */}
              <div className="flex items-center">
                {Array.from({ length: Math.min(yuto.members, 4) }).map((_, i) => (
                  <div 
                    key={i}
                    className="w-[28px] h-[28px] rounded-full bg-black border-2 border-white flex items-center justify-center text-white text-[12px] font-bold -ml-2 first:ml-0"
                  >
                    {String.fromCharCode(65 + i)}
                  </div>
                ))}
                {yuto.members > 4 && (
                  <div className="w-[28px] h-[28px] rounded-full bg-gray-300 border-2 border-white flex items-center justify-center text-gray-600 text-[10px] font-bold -ml-2">
                    +{yuto.members - 4}
                  </div>
                )}
              </div>
              <p className="font-bold text-[14px] text-black">{(parseInt(yuto.venue.price) * yuto.members).toLocaleString()} KSH</p>
            </div>
          </div>
        ))}
        
        {/* Empty state if no yutos */}
        {myYutos.length === 0 && (
          <div className="absolute left-[30px] right-[30px] top-[300px] text-center">
            <p className="text-[16px] text-gray-500 mb-[20px]">No Yutos yet!</p>
            <button 
              onClick={() => onNavigate?.('home')}
              className="bg-black text-white rounded-[30px] px-[32px] py-[14px] font-bold text-[16px] hover:bg-gray-800 transition-colors"
            >
              Browse Venues
            </button>
          </div>
        )}
        
        {/* Bottom Navigation */}
        <div className="absolute bg-white border border-black rounded-[40px] shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] h-[53px] left-[69px] w-[264px] top-[776px] bottom-nav" />
        <div 
          className="absolute bg-white border border-black rounded-[40px] shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] h-[53px] left-[69px] w-[86px] top-[776px] bottom-nav cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={() => onNavigate?.('venues-map')}
        />
        <div className="absolute bg-[#5493b3] border border-black rounded-[40px] shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] h-[53px] left-[158px] w-[87px] top-[776px] bottom-nav" />
        <div 
          className="absolute bg-white border border-black rounded-[40px] shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] h-[53px] left-[247px] w-[86px] top-[776px] bottom-nav cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={() => onNavigate?.('profile')}
        />
        <MapPin onClick={() => onNavigate?.('venues-map')} className="bottom-nav-icon" />
        <Home isActive className="bottom-nav-icon" />
        <User onClick={() => onNavigate?.('profile')} className="bottom-nav-icon" />
      </div>
    </div>
  );
}
