import { useEffect, useMemo, useRef, useState } from "react";

type MediaItem = {
  id: string;
  idx: number;
  media_url: string;
  media_type: "image" | "video";
  media_thumb_url: string | null;
};

export function PostMediaCarousel({ media }: { media: MediaItem[] }) {
  const items = useMemo(() => media.slice(0, 5), [media]);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    setActive(0);
    const el = scrollerRef.current;
    if (el) el.scrollLeft = 0;
  }, [items.length]);

  if (items.length === 0) return null;

  return (
    <div className="mt-3">
      <div
        ref={scrollerRef}
        className="relative w-full overflow-x-auto flex snap-x snap-mandatory scroll-smooth rounded-2xl border border-gray-100 bg-gray-50"
        style={{ WebkitOverflowScrolling: "touch" as any }}
        onScroll={(e) => {
          const el = e.currentTarget;
          const w = el.clientWidth || 1;
          const idx = Math.round(el.scrollLeft / w);
          if (idx !== active) setActive(Math.max(0, Math.min(items.length - 1, idx)));
        }}
      >
        {items.map((m) => (
          <div key={m.id} className="snap-center shrink-0 w-full">
            {m.media_type === "video" ? (
              <div className="w-full bg-black flex items-center justify-center">
                <video
                  src={m.media_url}
                  poster={m.media_thumb_url || undefined}
                  className="block w-full h-auto max-h-[520px] object-contain"
                  muted
                  playsInline
                  autoPlay
                  loop
                  preload="metadata"
                  controls={false}
                  controlsList="nodownload noplaybackrate noremoteplayback"
                  disablePictureInPicture
                  onContextMenu={(ev) => ev.preventDefault()}
                  onVolumeChange={(ev) => {
                    const v = ev.currentTarget;
                    if (!v.muted) v.muted = true;
                    if (v.volume !== 0) v.volume = 0;
                  }}
                  onClick={(ev) => {
                    const v = ev.currentTarget;
                    if (v.paused) void v.play().catch(() => {});
                    else v.pause();
                  }}
                />
              </div>
            ) : (
              <img src={m.media_url} alt="" className="w-full h-[220px] object-cover block" draggable={false} />
            )}
          </div>
        ))}
      </div>

      {items.length > 1 && (
        <div className="mt-2 flex items-center justify-center gap-1.5">
          {items.map((_, i) => (
            <div
              key={i}
              className={`w-1.5 h-1.5 rounded-full transition-colors ${
                i === active ? "bg-black" : "bg-gray-300"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

