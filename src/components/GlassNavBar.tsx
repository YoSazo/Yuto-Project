import { useNavigate } from "react-router-dom";

type NavTab = "split" | "activity" | "profile";

interface GlassNavBarProps {
  activeTab: NavTab;
}

function CarIcon({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 17h14v-5l-1.5-4.5h-11L5 12v5z" />
      <circle cx="7" cy="17" r="2" />
      <circle cx="17" cy="17" r="2" />
      <path d="M5 9h14" />
    </svg>
  );
}

function ClockIcon({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function PersonIcon({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

const tabs: { id: NavTab; label: string; path: string; Icon: typeof CarIcon }[] = [
  { id: "split", label: "Split", path: "/split", Icon: CarIcon },
  { id: "activity", label: "Activity", path: "/activity", Icon: ClockIcon },
  { id: "profile", label: "Profile", path: "/profile", Icon: PersonIcon },
];

export default function GlassNavBar({ activeTab }: GlassNavBarProps) {
  const navigate = useNavigate();
  const activeIndex = tabs.findIndex((t) => t.id === activeTab);

  return (
    <div className="relative h-[60px] w-full">
      {/* Glass background */}
      <div
        className="absolute inset-0 rounded-full overflow-hidden border border-gray-200"
        style={{
          background: "rgba(255, 255, 255, 0.7)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          boxShadow: "0 4px 24px rgba(0, 0, 0, 0.06)",
        }}
      />

      {/* Sliding pill */}
      <div
        className="absolute top-[5px] bottom-[5px] rounded-full bg-black transition-all duration-300 ease-out"
        style={{
          left: `calc(${activeIndex * 33.333}% + 5px)`,
          width: "calc(33.333% - 10px)",
        }}
      />

      {/* Tab buttons */}
      <div className="relative h-full flex items-center">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const color = isActive ? "#fff" : "#9ca3af";
          return (
            <button
              key={tab.id}
              onClick={() => navigate(tab.path)}
              className="flex-1 relative z-10 flex flex-col items-center justify-center gap-0.5 h-full cursor-pointer bg-transparent border-none"
            >
              <tab.Icon color={color} />
              <span className={`text-[10px] font-semibold ${isActive ? "text-white" : "text-gray-400"}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
