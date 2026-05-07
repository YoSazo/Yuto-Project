import { useMemo, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";

export type CarouselMediaItem = {
  url: string;
  type: "image" | "video";
};

export function FixedMediaCarousel({
  items,
  className = "",
  showDots = true,
}: {
  items: CarouselMediaItem[];
  className?: string;
  showDots?: boolean;
}) {
  const safeItems = useMemo(() => (items || []).filter(Boolean), [items]);
  const [idx, setIdx] = useState(0);
  const [muted, setMuted] = useState(true);
  const [paused, setPaused] = useState(false);
  const dragX = useRef<number | null>(null);

  const active = safeItems[Math.min(idx, Math.max(0, safeItems.length - 1))];
  if (!active) return null;

  const total = safeItems.length;

  const go = (next: number) => {
    const clamped = Math.max(0, Math.min(total - 1, next));
    setIdx(clamped);
    setPaused(false);
    setMuted(true);
  };

  return (
    <div
      className={["relative w-full overflow-hidden bg-gray-100", className].join(" ")}
      onPointerDown={(e) => {
        dragX.current = e.clientX;
      }}
      onPointerUp={(e) => {
        if (dragX.current == null) return;
        const dx = e.clientX - dragX.current;
        dragX.current = null;
        if (Math.abs(dx) < 40) return;
        if (dx < 0) go(idx + 1);
        else go(idx - 1);
      }}
    >
      {/* fixed-size crop surface */}
      <div className="relative w-full aspect-[4/5] bg-black">
        {active.type === "video" ? (
          <>
            <video
              key={active.url}
              src={active.url.includes("#") ? active.url : `${active.url}#t=0.001`}
              className="absolute inset-0 w-full h-full object-cover"
              autoPlay={!paused}
              playsInline
              loop
              muted={muted}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setPaused((p) => !p);
              }}
            />
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setMuted((m) => !m);
              }}
              className="absolute top-3 right-3 z-10 w-10 h-10 rounded-2xl bg-black/60 hover:bg-black/70 text-white flex items-center justify-center backdrop-blur-sm"
              aria-label={muted ? "Unmute video" : "Mute video"}
              title={muted ? "Unmute" : "Mute"}
            >
              {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
          </>
        ) : (
          <img src={active.url} alt="" draggable={false} className="absolute inset-0 w-full h-full object-cover" />
        )}
      </div>

      {showDots && total > 1 && (
        <div className="absolute bottom-2 left-0 right-0 flex items-center justify-center gap-1.5 pointer-events-none">
          {safeItems.map((_, i) => (
            <span
              key={i}
              className={[
                "w-1.5 h-1.5 rounded-full transition-colors",
                i === idx ? "bg-white" : "bg-white/40",
              ].join(" ")}
            />
          ))}
        </div>
      )}
    </div>
  );
}

