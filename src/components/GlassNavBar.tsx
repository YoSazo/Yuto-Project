import { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";

type NavTab = "split" | "fareshare" | "activity" | "profile";

interface GlassNavBarProps {
  activeTab: NavTab;
  pendingCount?: number;
}

function SplitIcon({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="-1.5 0 19 19" xmlns="http://www.w3.org/2000/svg" fill={color}>
      <path d="M14.533 2.953H9.53a.493.493 0 0 0-.325.79l1.049 1.36.15.194L8 7.137l-2.403-1.84.15-.194 1.048-1.36a.493.493 0 0 0-.325-.79H1.467a.496.496 0 0 0-.434.683L2.276 8.39a.493.493 0 0 0 .847.113l.935-1.211.281-.366 2.638 2.02-.006 6.074a1.026 1.026 0 0 0 2.05 0l.007-6.078 2.632-2.016.282.366.934 1.211a.493.493 0 0 0 .847-.113l1.244-4.755a.496.496 0 0 0-.434-.683z" />
    </svg>
  );
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
  { id: "split", label: "Split", path: "/split", Icon: SplitIcon },
  { id: "fareshare", label: "Rides", path: "/fareshare", Icon: CarIcon },
  { id: "activity", label: "Yuto's", path: "/activity", Icon: ClockIcon },
  { id: "profile", label: "Profile", path: "/profile", Icon: PersonIcon },
];

export default function GlassNavBar({ activeTab, pendingCount = 0 }: GlassNavBarProps) {
  const navigate = useNavigate();
  const activeIndex = tabs.findIndex((t) => t.id === activeTab);

  const containerRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef({ pointerX: 0, pillLeft: 0 });

  const [isDragging, setIsDragging] = useState(false);
  const [dragLeft, setDragLeft] = useState(0);

  const getPillWidth = useCallback(() => {
    if (!containerRef.current) return 0;
    return containerRef.current.getBoundingClientRect().width / 4 - 10;
  }, []);

  const getHoverIndex = useCallback(() => {
    if (!containerRef.current) return activeIndex;
    const w = containerRef.current.getBoundingClientRect().width;
    const pillW = w / 4 - 10;
    const center = dragLeft + pillW / 2;
    return Math.min(3, Math.max(0, Math.floor(center / (w / 4))));
  }, [dragLeft, activeIndex]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      const container = containerRef.current;
      if (!container) return;

      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

      const rect = container.getBoundingClientRect();
      const currentLeft = (activeIndex / 4) * rect.width + 5;

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
      const pillW = rect.width / 4 - 10;
      const delta = e.clientX - dragStart.current.pointerX;
      const newLeft = dragStart.current.pillLeft + delta;
      setDragLeft(Math.max(5, Math.min(newLeft, rect.width - pillW - 5)));
    },
    [isDragging]
  );

  const handlePointerUp = useCallback(() => {
    if (!isDragging) return;
    const snapIndex = getHoverIndex();
    setIsDragging(false);
    if (tabs[snapIndex].id !== activeTab) {
      navigate(tabs[snapIndex].path);
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
        left: `calc(${activeIndex * 25}% + 5px)`,
        width: "calc(25% - 10px)",
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
        className="absolute top-[5px] bottom-[5px] rounded-full bg-black z-20 transition-all duration-300 ease-out"
        style={pillStyle}
      />

      {/* Tab buttons — z-30 so icons render on top of the pill */}
      <div
        className="relative h-full flex items-center z-30"
        style={isDragging ? { pointerEvents: "none" } : undefined}
      >
        {tabs.map((tab, i) => {
          const isLit = i === visualIndex;
          const color = isLit ? "#fff" : "#9ca3af";

          // Water lens magnification — only active during drag
          let scale = 1;
          if (isDragging) {
            const pillCenter = dragLeft + getPillWidth() / 2;
            const tabCenter = containerRef.current
              ? (i * 25 + 12.5) / 100 * containerRef.current.getBoundingClientRect().width
              : 0;
            const distance = Math.abs(pillCenter - tabCenter);
            const maxDist = containerRef.current ? containerRef.current.getBoundingClientRect().width / 4 : 80;
            const proximity = Math.max(0, 1 - distance / maxDist);
            scale = 1 + proximity * 0.35;
          }

          return (
            <button
              key={tab.id}
              onClick={() => navigate(tab.path)}
              className={`flex-1 relative flex flex-col items-center justify-center gap-0.5 h-full cursor-pointer bg-transparent border-none ${
                isLit && !isDragging ? "pointer-events-none" : ""
              }`}
            >
              <div
                className="relative transition-transform duration-150 ease-out"
                style={{ transform: `scale(${scale})` }}
              >
                <tab.Icon color={color} />
                {tab.id === "profile" && pendingCount > 0 && (
                  <div className="absolute -top-1 -right-1.5 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                    <span className="text-[9px] font-bold text-white">{pendingCount}</span>
                  </div>
                )}
              </div>
              <span
                className={`text-[10px] font-semibold transition-colors duration-200 ${
                  isLit ? "text-white" : "text-gray-400"
                }`}
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
