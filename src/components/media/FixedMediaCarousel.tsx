import { useEffect, useMemo, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";

export type CarouselMediaItem = {
  url: string;
  type: "image" | "video";
};

/**
 * Fixed-aspect media carousel using native scroll-snap for buttery smooth swiping.
 * Used by FunctionCard, listing cards, and compose previews.
 */
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
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [idx, setIdx] = useState(0);
  const [muted, setMuted] = useState(true);

  const total = safeItems.length;

  // Reset scroll position when items change
  useEffect(() => {
    setIdx(0);
    const el = scrollerRef.current;
    if (el) el.scrollLeft = 0;
  }, [total]);

  if (total === 0) return null;

  // Single item — no carousel needed
  if (total === 1) {
    const item = safeItems[0];
    return (
      <div className={["relative w-full overflow-hidden bg-gray-100 dark:bg-zinc-800", className].join(" ")}>
        <div className="relative w-full aspect-[4/5] bg-black">
          {item.type === "video" ? (
            <>
              <video
                src={item.url.includes("#") ? item.url : `${item.url}#t=0.001`}
                className="absolute inset-0 w-full h-full object-cover"
                autoPlay
                playsInline
                loop
                muted={muted}
              />
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setMuted((m) => !m);
                }}
                className="absolute top-3 right-3 z-10 w-10 h-10 rounded-2xl bg-black/60 hover:bg-black/70 text-white flex items-center justify-center backdrop-blur-sm border-none"
                aria-label={muted ? "Unmute video" : "Mute video"}
              >
                {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
            </>
          ) : (
            <img src={item.url} alt="" draggable={false} className="absolute inset-0 w-full h-full object-cover" />
          )}
        </div>
      </div>
    );
  }

  // Multi-item carousel with native scroll-snap
  return (
    <div className={["relative w-full overflow-hidden bg-gray-100 dark:bg-zinc-800", className].join(" ")}>
      <style>
        {`
          .fn-carousel-no-scrollbar::-webkit-scrollbar { display: none; }
          .fn-carousel-no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        `}
      </style>
      <div
        ref={scrollerRef}
        className="relative w-full overflow-x-auto flex snap-x snap-mandatory scroll-smooth fn-carousel-no-scrollbar"
        style={{ WebkitOverflowScrolling: "touch" as any }}
        onScroll={(e) => {
          const el = e.currentTarget;
          const w = el.clientWidth || 1;
          const newIdx = Math.round(el.scrollLeft / w);
          if (newIdx !== idx) setIdx(Math.max(0, Math.min(total - 1, newIdx)));
        }}
      >
        {safeItems.map((item, i) => (
          <div key={`${item.url}-${i}`} className="snap-center shrink-0 w-full relative">
            <div className="relative w-full aspect-[4/5] bg-black">
              {item.type === "video" ? (
                <>
                  <video
                    src={item.url.includes("#") ? item.url : `${item.url}#t=0.001`}
                    className="absolute inset-0 w-full h-full object-cover"
                    autoPlay={i === idx}
                    playsInline
                    loop
                    muted={muted}
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setMuted((m) => !m);
                    }}
                    className="absolute top-3 right-3 z-10 w-10 h-10 rounded-2xl bg-black/60 hover:bg-black/70 text-white flex items-center justify-center backdrop-blur-sm border-none"
                    aria-label={muted ? "Unmute video" : "Mute video"}
                  >
                    {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                  </button>
                </>
              ) : (
                <img src={item.url} alt="" draggable={false} className="absolute inset-0 w-full h-full object-cover" />
              )}
            </div>
          </div>
        ))}
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
