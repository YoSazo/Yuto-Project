import { Outlet, useLocation } from "react-router-dom";
import GlassNavBar from "./GlassNavBar";

type NavTab = "split" | "activity" | "profile";

const TAB_ROUTES: Record<string, NavTab> = {
  "/": "split",
  "/split": "split",
  "/activity": "activity",
  "/profile": "profile",
};

export default function Layout() {
  const location = useLocation();
  const activeTab = TAB_ROUTES[location.pathname];
  const showNav = !!activeTab;

  return (
    <div className="min-h-[100dvh] bg-gray-100 flex items-center justify-center">
      <div className="w-full max-w-md h-[100dvh] md:h-[844px] bg-white relative overflow-hidden md:rounded-[40px] md:shadow-2xl">
        <div className={`h-full overflow-y-auto ${showNav ? "pb-24" : ""}`}>
          <Outlet />
        </div>

        {showNav && (
          <div className="absolute bottom-0 left-0 right-0 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3">
            <GlassNavBar activeTab={activeTab} />
          </div>
        )}
      </div>
    </div>
  );
}
