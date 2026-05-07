import { useEffect, useRef } from "react";

export function isHighlightVideoUrl(url?: string | null): boolean {
  if (!url) return false;
  return /\.(mp4|mov|webm|m4v)(\?|$)/i.test(url);
}

/**
 * Photo: normal image. Video: loads metadata only, seeks to first frame, stays paused
 * (efficient; use full-screen viewer for playback).
 */
export function HighlightStillMedia({ url, className = "" }: { url: string; className?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !isHighlightVideoUrl(url)) return;
    let cancelled = false;

    const onLoadedMetadata = () => {
      if (cancelled) return;
      try {
        const dur = el.duration;
        const t = Number.isFinite(dur) && dur > 0 ? Math.min(0.06, dur * 0.02) : 0.06;
        el.currentTime = t;
      } catch {
        /* ignore */
      }
    };

    const onSeeked = () => {
      if (cancelled) return;
      try {
        el.pause();
      } catch {
        /* ignore */
      }
    };

    el.addEventListener("loadedmetadata", onLoadedMetadata);
    el.addEventListener("seeked", onSeeked);
    return () => {
      cancelled = true;
      el.removeEventListener("loadedmetadata", onLoadedMetadata);
      el.removeEventListener("seeked", onSeeked);
    };
  }, [url]);

  if (!isHighlightVideoUrl(url)) {
    return <img src={url} alt="" draggable={false} className={className} />;
  }

  return (
    <video
      ref={videoRef}
      src={url}
      muted
      playsInline
      preload="metadata"
      className={className}
      aria-hidden
    />
  );
}
