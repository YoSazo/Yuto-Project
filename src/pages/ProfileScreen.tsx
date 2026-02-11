import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { getUserStats } from '../data/mockData';
import imgYutoMascot from "figma:asset/28c11cb437762e8469db46974f467144b8299a8c.png";

// Icons
const SettingsIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
  </svg>
);

const ChevronRight = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);

interface MenuItemProps {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  onClick?: () => void;
}

function MenuItem({ icon, label, sublabel, onClick }: MenuItemProps) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between py-4 px-5 hover:bg-gray-50 transition-colors text-left"
    >
      <div className="flex items-center gap-4">
        <div className="text-black">{icon}</div>
        <div>
          <p className="font-semibold text-black">{label}</p>
          {sublabel && <p className="text-xs text-gray-500">{sublabel}</p>}
        </div>
      </div>
      <div className="text-gray-400">
        <ChevronRight />
      </div>
    </button>
  );
}

export default function ProfileScreen() {
  const navigate = useNavigate();
  const { user, friends } = useApp();
  const stats = getUserStats();

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <header className="flex items-center justify-between px-5 pt-12 pb-4">
        <h1 className="text-2xl font-bold text-black">Profile</h1>
        <button className="p-2 hover:opacity-70 transition-opacity">
          <SettingsIcon />
        </button>
      </header>

      {/* Content */}
      <main className="flex-1 px-4 pb-24 space-y-5">
        {/* Profile Card */}
        <div className="bg-white border border-gray-200 rounded-3xl shadow-sm p-5 flex items-center gap-5 relative">
          <img 
            alt="Yuto mascot" 
            className="absolute top-3 right-3 w-8 h-8 object-contain" 
            src={imgYutoMascot} 
          />
          
          {/* Avatar */}
          <div className="w-20 h-20 rounded-full bg-black flex items-center justify-center text-white font-bold text-3xl shrink-0">
            {user.name.charAt(0).toUpperCase()}
          </div>
          
          {/* Info */}
          <div>
            <p className="font-bold text-2xl text-black">{user.name}</p>
            <p className="text-sm text-gray-500">{user.phone}</p>
            <button className="mt-2 text-xs text-primary font-semibold hover:underline">
              Edit Profile
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm py-4 px-3 text-center">
            <p className="font-bold text-2xl text-black">{stats.totalYutos}</p>
            <p className="text-xs text-gray-500">Yutos</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm py-4 px-3 text-center">
            <p className="font-bold text-xl text-black">{stats.totalSpent.toLocaleString()}</p>
            <p className="text-xs text-gray-500">KSH Spent</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm py-4 px-3 text-center">
            <p className="font-bold text-2xl text-black">{friends.length}</p>
            <p className="text-xs text-gray-500">Friends</p>
          </div>
        </div>

        {/* Menu Section */}
        <div className="bg-white border border-gray-200 rounded-3xl shadow-sm overflow-hidden divide-y divide-gray-100">
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
          
          <MenuItem
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
            }
            label="Yuto History"
            sublabel="View past outings"
            onClick={() => navigate('/home')}
          />
          
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
            sublabel={`${friends.length} friends added`}
          />
          
          <MenuItem
            icon={<SettingsIcon />}
            label="Settings"
            sublabel="App preferences"
          />
        </div>
      </main>
    </div>
  );
}
