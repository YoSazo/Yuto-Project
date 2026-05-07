export function isHighlightVideoUrl(url?: string | null): boolean {
  if (!url) return false;
  return /\.(mp4|mov|webm|m4v)(\?|$)/i.test(url);
}

import { Volume2, VolumeX } from "lucide-react";
import { useRef, useState } from "react";

export function HighlightStillMedia({ url, className = "" }: { url: string; className?: string }) {
  if (!isHighlightVideoUrl(url)) {
    return <img src={url} alt="" draggable={false} className={className} />;
  }

  const videoSrc = url.includes("#") ? url : `${url}#t=0.001`;
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [muted, setMuted] = useState(true);

  return (
    <div className="relative">
      <video
        ref={videoRef}
        src={videoSrc}
        muted={muted}
        playsInline
        preload="metadata"
        className={className}
        aria-hidden
      />
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setMuted((m) => {
            const next = !m;
            if (videoRef.current) videoRef.current.muted = next;
            return next;
          });
        }}
        className="absolute top-3 right-3 z-10 w-10 h-10 rounded-2xl bg-black/60 hover:bg-black/70 text-white flex items-center justify-center backdrop-blur-sm"
        aria-label={muted ? "Unmute video" : "Mute video"}
        title={muted ? "Unmute" : "Mute"}
      >
        {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
      </button>
    </div>
  );
}
