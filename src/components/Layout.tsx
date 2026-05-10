import { useState, useEffect } from "react";
import { Outlet, useLocation, Navigate } from "react-router-dom";
import GlassNavBar from "./GlassNavBar";
import { useAuth } from "../contexts/AuthContext";
import { getPendingRequests, getMyAllUnreadTotal } from "../lib/supabase";
import { useAppResume } from "../hooks/useAppResume";
import { WifiOff } from "lucide-react";

type NavTab = "split" | "home" | "activity" | "profile";

const TAB_ROUTES: Record<string, NavTab> = {
  "/": "home",
  "/split": "split",
  "/home": "home",
  "/activity": "activity",
  "/profile": "profile",
};

export default function Layout() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const activeTab = TAB_ROUTES[location.pathname];
  const showNav = !!activeTab;
  const [pendingCount, setPendingCount] = useState(0);
  const [dmUnreadCount, setDmUnreadCount] = useState(0);
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => { window.removeEventListener("online", goOnline); window.removeEventListener("offline", goOffline); };
  }, []);

  useEffect(() => {
    if (!user) return;
    const fetchCounts = () => {
      getPendingRequests(user.id).then((data) => setPendingCount(data.length)).catch(() => {});
      getMyAllUnreadTotal(user.id).then(setDmUnreadCount).catch(() => {});
    };
    fetchCounts();
    const interval = setInterval(fetchCounts, 15000);
    return () => clearInterval(interval);
  }, [user, location.pathname]);

  // When the PWA comes back foregrounded (e.g. after STK PIN), wake up the app.
  useAppResume(() => {
    window.dispatchEvent(new Event("yuto:resume"));
  });

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-gray-100 dark:bg-black flex items-center justify-center transition-colors">
        <div className="w-full max-w-md h-[100dvh] md:h-[844px] bg-white dark:bg-black flex items-center justify-center md:rounded-[40px] md:shadow-2xl transition-colors">
          <p className="text-gray-400 text-lg">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  return (
    <div className="min-h-[100dvh] bg-gray-100 dark:bg-black flex items-center justify-center transition-colors">
      <div id="app-shell" className="w-full max-w-md h-[100dvh] md:h-[844px] bg-white dark:bg-black relative overflow-hidden md:rounded-[40px] md:shadow-2xl transition-colors">
        {!isOnline && (
          <div className="absolute top-0 left-0 right-0 z-40 bg-amber-500 text-white text-xs font-bold text-center py-1.5 flex items-center justify-center gap-1.5">
            <WifiOff size={12} /> No internet — some features may not work
          </div>
        )}
        <div className={`h-full overflow-y-auto ${showNav ? "pb-24" : ""} ${!isOnline ? "pt-7" : ""}`}>
          <Outlet />
        </div>

        {showNav && (
          <div className="absolute bottom-0 left-0 right-0 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 z-30">
            <GlassNavBar activeTab={activeTab} pendingCount={pendingCount} dmUnreadCount={dmUnreadCount} />
          </div>
        )}
      </div>
    </div>
  );
}
