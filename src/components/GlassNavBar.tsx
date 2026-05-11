import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { haptics } from "../lib/haptics";
import { useTheme } from "../contexts/ThemeContext";

type NavTab = "split" | "home" | "activity" | "profile";

interface GlassNavBarProps {
  activeTab: NavTab;
  pendingCount?: number;
  dmUnreadCount?: number;
  newSplitCount?: number;
}

function SplitIcon({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="-1.5 0 19 19" xmlns="http://www.w3.org/2000/svg" fill={color}>
      <path d="M14.533 2.953H9.53a.493.493 0 0 0-.325.79l1.049 1.36.15.194L8 7.137l-2.403-1.84.15-.194 1.048-1.36a.493.493 0 0 0-.325-.79H1.467a.496.496 0 0 0-.434.683L2.276 8.39a.493.493 0 0 0 .847.113l.935-1.211.281-.366 2.638 2.02-.006 6.074a1.026 1.026 0 0 0 2.05 0l.007-6.078 2.632-2.016.282.366.934 1.211a.493.493 0 0 0 .847-.113l1.244-4.755a.496.496 0 0 0-.434-.683z" />
    </svg>
  );
}

function HomeIcon({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M1 6V15H6V11C6 9.89543 6.89543 9 8 9C9.10457 9 10 9.89543 10 11V15H15V6L8 0L1 6Z" fill={color} />
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

const tabs: { id: NavTab; label: string; path: string; Icon: typeof SplitIcon }[] = [
  { id: "split", label: "Split", path: "/split", Icon: SplitIcon },
  { id: "home", label: "Home", path: "/home", Icon: HomeIcon },
  { id: "activity", label: "Yuto's", path: "/activity", Icon: ClockIcon },
  { id: "profile", label: "Profile", path: "/profile", Icon: PersonIcon },
];

const TAB_COUNT = tabs.length;

export default function GlassNavBar({ activeTab, pendingCount = 0, dmUnreadCount = 0, newSplitCount = 0 }: GlassNavBarProps) {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const activeIndex = tabs.findIndex((t) => t.id === activeTab);

  const [justLanded, setJustLanded] = useState<NavTab | null>(null);
  useEffect(() => {
    setJustLanded(activeTab);
    const t = window.setTimeout(() => setJustLanded(null), 550);
    return () => window.clearTimeout(t);
  }, [activeTab]);

  const containerRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef({ pointerX: 0, pillLeft: 0 });

  const [isDragging, setIsDragging] = useState(false);
  const [dragLeft, setDragLeft] = useState(0);

  const getPillWidth = useCallback(() => {
    if (!containerRef.current) return 0;
    return containerRef.current.getBoundingClientRect().width / TAB_COUNT - 10;
  }, []);

  const getHoverIndex = useCallback(() => {
    if (!containerRef.current) return activeIndex;
    const w = containerRef.current.getBoundingClientRect().width;
    const pillW = w / TAB_COUNT - 10;
    const center = dragLeft + pillW / 2;
    return Math.min(TAB_COUNT - 1, Math.max(0, Math.floor(center / (w / TAB_COUNT))));
  }, [dragLeft, activeIndex]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      const container = containerRef.current;
      if (!container) return;

      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

      const rect = container.getBoundingClientRect();
      const currentLeft = (activeIndex / TAB_COUNT) * rect.width + 5;

      dragStart.current = { pointerX: e.clientX, pillLeft: currentLeft };
      setDragLeft(currentLeft);
      setIsDragging(true);
    },
    [activeIndex]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return;
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const pillW = rect.width / TAB_COUNT - 10;
      const delta = e.clientX - dragStart.current.pointerX;
      const newLeft = dragStart.current.pillLeft + delta;
      setDragLeft(Math.max(5, Math.min(newLeft, rect.width - pillW - 5)));
    },
    [isDragging]
  );

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;
    setIsDragging(false);
    const moved = Math.abs(e.clientX - dragStart.current.pointerX);
    if (moved < 8) {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const clickedIndex = Math.min(TAB_COUNT - 1, Math.max(0, Math.floor(x / (rect.width / TAB_COUNT))));
      const target = tabs[clickedIndex];
      if (target.id !== activeTab) haptics.tap();
      navigate(target.path);
    } else {
      const snapIndex = getHoverIndex();
      if (tabs[snapIndex].id !== activeTab) {
        haptics.medium();
        navigate(tabs[snapIndex].path);
      }
    }
  }, [isDragging, getHoverIndex, activeTab, navigate]);

  const visualIndex = isDragging ? getHoverIndex() : activeIndex;

  const pillStyle: React.CSSProperties = isDragging
    ? {
        left: `${dragLeft}px`,
        width: `${getPillWidth()}px`,
        transition: "none",
        transform: "scaleY(1.03)",
      }
    : {
        left: `calc(${activeIndex * (100 / TAB_COUNT)}% + 5px)`,
        width: `calc(${100 / TAB_COUNT}% - 10px)`,
      };

  return (
    <div
      ref={containerRef}
      className="relative h-[60px] w-full touch-none"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => setIsDragging(false)}
    >
      <div
        className="absolute inset-0 rounded-full overflow-hidden border border-gray-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl shadow-[0_4px_24px_rgba(0,0,0,0.06)] dark:shadow-none"
      />

      <div
        className="absolute top-[5px] bottom-[5px] rounded-full bg-black dark:bg-white z-20 transition-all duration-300 ease-out"
        style={pillStyle}
      />

      <div
        className="relative h-full flex items-center z-30"
        style={isDragging ? { pointerEvents: "none" } : undefined}
      >
        {tabs.map((tab, i) => {
          const isLit = i === visualIndex;
          const color = isLit ? (theme === "dark" ? "#000" : "#fff") : (theme === "dark" ? "#6b7280" : "#9ca3af");

          let scale = 1;
          if (isDragging) {
            const pillCenter = dragLeft + getPillWidth() / 2;
            const w = containerRef.current?.getBoundingClientRect().width ?? 0;
            const tabCenter = w > 0 ? ((i + 0.5) / TAB_COUNT) * w : 0;
            const distance = Math.abs(pillCenter - tabCenter);
            const maxDist = w > 0 ? w / TAB_COUNT : 100;
            const proximity = Math.max(0, 1 - distance / maxDist);
            scale = 1 + proximity * 0.35;
          }

          return (
            <button
              key={tab.id}
              onClick={() => {
                if (tab.id !== activeTab) haptics.tap();
                navigate(tab.path);
              }}
              className={`flex-1 relative flex flex-col items-center justify-center gap-0.5 h-full cursor-pointer bg-transparent border-none ${
                isLit && !isDragging ? "pointer-events-none" : ""
              }`}
            >
              <div
                className="relative transition-transform duration-150 ease-out"
                style={{ transform: `scale(${scale})` }}
              >
                <tab.Icon color={color} />
                {tab.id === "home" && dmUnreadCount > 0 && (
                  <div className="absolute -top-1 -right-1.5 min-w-4 h-4 px-0.5 bg-red-500 rounded-full flex items-center justify-center">
                    <span className="text-[9px] font-bold text-white">{dmUnreadCount > 99 ? "99+" : dmUnreadCount}</span>
                  </div>
                )}
                {tab.id === "activity" && newSplitCount > 0 && (
                  <div className="absolute -top-1 -right-1.5 min-w-4 h-4 px-0.5 bg-red-500 rounded-full flex items-center justify-center">
                    <span className="text-[9px] font-bold text-white">{newSplitCount > 99 ? "99+" : newSplitCount}</span>
                  </div>
                )}
                {tab.id === "profile" && pendingCount > 0 && (
                  <div className="absolute -top-1 -right-1.5 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                    <span className="text-[9px] font-bold text-white">{pendingCount}</span>
                  </div>
                )}
              </div>
              <span
                className={`text-[10px] font-semibold transition-all duration-200 ${
                  isLit ? "text-white dark:text-black" : "text-gray-400 dark:text-gray-500"
                } ${justLanded === tab.id ? "scale-110" : "scale-100"}`}
                style={{
                  transform:
                    justLanded === tab.id ? "scale(1.12)" : "scale(1)",
                  transition: "transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), color 0.2s",
                }}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}