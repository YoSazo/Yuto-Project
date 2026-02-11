import { Outlet, useLocation } from 'react-router-dom';
import GlassNavBar from './GlassNavBar';

// Screens that should show the bottom navigation
const SCREENS_WITH_NAV = ['/venues', '/home', '/fare-share', '/profile'];

// Map routes to nav tabs
const routeToTab: Record<string, 'venues' | 'home' | 'fare-share' | 'profile'> = {
  '/venues': 'venues',
  '/home': 'home',
  '/': 'home',
  '/fare-share': 'fare-share',
  '/profile': 'profile',
};

export default function Layout() {
  const location = useLocation();
  const showNav = SCREENS_WITH_NAV.some(path => location.pathname.startsWith(path)) || location.pathname === '/';
  const activeTab = routeToTab[location.pathname] || 'home';

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      {/* Phone frame container - max width for mobile feel on desktop */}
      <div className="w-full max-w-md h-screen max-h-[900px] bg-white relative overflow-hidden shadow-2xl">
        {/* Main content area */}
        <div className="h-full overflow-y-auto pb-20">
          <Outlet />
        </div>
        
        {/* Bottom navigation - fixed at bottom */}
        {showNav && (
          <div className="absolute bottom-4 left-4 right-4">
            <GlassNavBar activeTab={activeTab} />
          </div>
        )}
      </div>
    </div>
  );
}
