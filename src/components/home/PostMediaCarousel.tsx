import { useEffect, useMemo, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";

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
  const [unmuted, setUnmuted] = useState<Record<string, boolean>>({});
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});

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
              <div className="relative w-full bg-gray-50 flex items-center justify-center overflow-hidden">
                {/* blurred fill background to avoid black bars */}
                <video
                  src={m.media_url}
                  className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-35"
                  muted
                  playsInline
                  autoPlay
                  loop
                  preload="metadata"
                  controls={false}
                  aria-hidden
                />
                <video
                  src={m.media_url}
                  poster={m.media_thumb_url || undefined}
                  className="block w-full h-auto max-h-[520px] object-contain"
                  muted={!unmuted[m.id]}
                  playsInline
                  autoPlay
                  loop
                  preload="metadata"
                  controls={false}
                  controlsList="nodownload noplaybackrate noremoteplayback"
                  disablePictureInPicture
                  ref={(el) => {
                    videoRefs.current[m.id] = el;
                  }}
                  onContextMenu={(ev) => ev.preventDefault()}
                  onClick={(ev) => {
                    const v = ev.currentTarget;
                    if (v.paused) void v.play().catch(() => {});
                    else v.pause();
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    setUnmuted((prev) => {
                      const next = { ...prev, [m.id]: !prev[m.id] };
                      const v = videoRefs.current[m.id];
                      if (v) v.muted = !next[m.id];
                      return next;
                    });
                  }}
                  className="absolute bottom-3 right-3 z-10 w-11 h-11 rounded-2xl bg-white/15 text-white flex items-center justify-center hover:bg-white/25 border-none"
                  aria-label={unmuted[m.id] ? "Mute" : "Unmute"}
                  title={unmuted[m.id] ? "Mute" : "Unmute"}
                >
                  {unmuted[m.id] ? <Volume2 size={18} /> : <VolumeX size={18} />}
                </button>
              </div>
            ) : (
              <div className="relative w-full bg-gray-50 overflow-hidden">
                <img
                  src={m.media_url}
                  alt=""
                  aria-hidden
                  className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-35"
                  draggable={false}
                />
                <img src={m.media_url} alt="" className="w-full h-[520px] object-contain block relative" draggable={false} />
              </div>
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

