import { useState, useEffect } from "react";
import { Outlet, useLocation, Navigate, useNavigate } from "react-router-dom";
import GlassNavBar from "./GlassNavBar";
import { useAuth } from "../contexts/AuthContext";
import { getPendingRequests, getMyAllUnreadTotal, supabase } from "../lib/supabase";
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
  const navigate = useNavigate();
  const location = useLocation();
  const activeTab = TAB_ROUTES[location.pathname];
  const showNav = !!activeTab;
  const [pendingCount, setPendingCount] = useState(0);
  const [dmUnreadCount, setDmUnreadCount] = useState(0);
  const [newSplitCount, setNewSplitCount] = useState(0);
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => { window.removeEventListener("online", goOnline); window.removeEventListener("offline", goOffline); };
  }, []);

  useEffect(() => {
    if (location.pathname === "/activity" && user) {
      setNewSplitCount(0);
      localStorage.setItem(`yuto_last_activity_visit_${user.id}`, String(Date.now()));
    }
  }, [location.pathname, user]);

  useEffect(() => {
    if (!user) return;
    const fetchCounts = () => {
      getPendingRequests(user.id).then((data) => setPendingCount(data.length)).catch(() => {});
      getMyAllUnreadTotal(user.id).then(setDmUnreadCount).catch(() => {});
    };
    fetchCounts();
    const interval = setInterval(fetchCounts, 15000);

    // Listen for new splits being created (group_members INSERT)
    const splitKey = `yuto_last_activity_visit_${user.id}`;
    const lastVisit = Number(localStorage.getItem(splitKey) || 0);
    const splitChannel = supabase
      .channel(`new-splits-${user.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "group_members",
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        const insertedAt = new Date((payload.new as any).joined_at || Date.now()).getTime();
        if (insertedAt > lastVisit) setNewSplitCount((c) => c + 1);
      })
      .subscribe();

    return () => { clearInterval(interval); supabase.removeChannel(splitChannel); };
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

  if (!user) {
    // Guest mode: allow browsing key screens (read-only) with a sign-up banner
    const guestAllowedPaths = ["/home", "/", "/split", "/activity", "/profile"];
    const isGuestAllowed = guestAllowedPaths.some(p => location.pathname === p || location.pathname.startsWith("/user/"));
    if (!isGuestAllowed) return <Navigate to="/home" replace />;
  }

  return (
    <div className="min-h-[100dvh] bg-gray-100 dark:bg-black flex items-center justify-center transition-colors">
      <div id="app-shell" className="w-full max-w-md h-[100dvh] md:h-[844px] bg-white dark:bg-black relative overflow-hidden md:rounded-[40px] md:shadow-2xl transition-colors">
        {/* Guest browse banner */}
        {!user && (
          <div className="absolute top-0 left-0 right-0 z-40 bg-black dark:bg-white px-4 py-3 flex items-center justify-between">
            <p className="text-white dark:text-black text-sm font-bold">Yuto — split, host & pay together</p>
            <button
              type="button"
              onClick={() => navigate("/auth")}
              className="px-4 py-1.5 bg-white dark:bg-black text-black dark:text-white rounded-full text-xs font-bold border-none"
            >
              Log in
            </button>
          </div>
        )}
        {!isOnline && (
          <div className="absolute top-0 left-0 right-0 z-40 bg-amber-500 text-white text-xs font-bold text-center py-1.5 flex items-center justify-center gap-1.5">
            <WifiOff size={12} /> No internet — some features may not work
          </div>
        )}
        <div className={`h-full overflow-y-auto ${showNav ? "pb-24" : ""} ${!isOnline ? "pt-7" : ""} ${!user ? "pt-12" : ""}`}>
          <Outlet />
        </div>

        {showNav && (
          <div className="absolute bottom-0 left-0 right-0 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 z-30">
            <GlassNavBar activeTab={activeTab} pendingCount={pendingCount} dmUnreadCount={dmUnreadCount} newSplitCount={newSplitCount} />
          </div>
        )}
      </div>
    </div>
  );
}
