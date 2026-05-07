export function isHighlightVideoUrl(url?: string | null): boolean {
  if (!url) return false;
  return /\.(mp4|mov|webm|m4v)(\?|$)/i.test(url);
}

export function HighlightStillMedia({ url, className = "" }: { url: string; className?: string }) {
  if (!isHighlightVideoUrl(url)) {
    return <img src={url} alt="" draggable={false} className={className} />;
  }

  const videoSrc = url.includes("#") ? url : `${url}#t=0.001`;

  return (
    <video src={videoSrc} muted playsInline preload="metadata" className={className} aria-hidden />
  );
}
