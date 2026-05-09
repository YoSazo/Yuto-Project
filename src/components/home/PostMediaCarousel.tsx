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
      <style>
        {`
          .no-scrollbar::-webkit-scrollbar { display: none; }
          .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        `}
      </style>
      <div
        ref={scrollerRef}
        className="relative w-full overflow-x-auto flex snap-x snap-mandatory scroll-smooth rounded-2xl border border-gray-100 bg-gray-50 no-scrollbar"
        style={{ WebkitOverflowScrolling: "touch" as any }}
        onScroll={(e) => {
          const el = e.currentTarget;
          const w = el.clientWidth || 1;
          const idx = Math.round(el.scrollLeft / w);
          if (idx !== active) setActive(Math.max(0, Math.min(items.length - 1, idx)));
        }}
      >
        {items.map((m) => (
          <div key={m.id} className="snap-center shrink-0 w-full flex items-center justify-center relative overflow-hidden bg-white min-h-[300px]">
            {/* Blurred Background Layer */}
            <img
              src={m.media_type === "video" ? (m.media_thumb_url || m.media_url) : m.media_url}
              alt=""
              className="absolute inset-0 w-full h-full object-cover blur-3xl opacity-20 scale-110 pointer-events-none"
              aria-hidden="true"
            />

            {m.media_type === "video" ? (
              <div className="relative z-10 w-full flex items-center justify-center">
                <video
                  src={m.media_url}
                  poster={m.media_thumb_url || undefined}
                  className="block w-full h-auto max-h-[70vh] object-contain shadow-sm"
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
                  className="absolute bottom-3 right-3 z-10 w-11 h-11 rounded-2xl bg-black/15 text-white flex items-center justify-center hover:bg-white/25 border-none backdrop-blur-sm"
                  aria-label={unmuted[m.id] ? "Mute" : "Unmute"}
                  title={unmuted[m.id] ? "Mute" : "Unmute"}
                >
                  {unmuted[m.id] ? <Volume2 size={18} /> : <VolumeX size={18} />}
                </button>
              </div>
            ) : (
              <img
                src={m.media_url}
                alt=""
                className="relative z-10 w-full h-auto max-h-[70vh] object-contain block shadow-sm"
                draggable={false}
              />
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
