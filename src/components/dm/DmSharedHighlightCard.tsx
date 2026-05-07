import UserAvatar from "../UserAvatar";
import { HighlightStillMedia, isHighlightVideoUrl } from "../highlights/HighlightStillMedia";
import type { Highlight } from "../../lib/supabase";

export function DmSharedHighlightCard({
  highlight,
  ownerName,
  ownerAvatarUrl,
  onOpen,
}: {
  highlight: Highlight;
  ownerName: string;
  ownerAvatarUrl: string | null;
  onOpen: () => void;
}) {
  const p0 = highlight.photos[0];
  const p1 = highlight.photos[1];

  const thumb = (p: (typeof highlight.photos)[0] | undefined) => {
    if (!p) return null;
    const u = p.thumb_url || p.poster_url || p.url;
    return u;
  };

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full text-left rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden tap-scale"
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-50">
        <UserAvatar name={ownerName} avatarUrl={ownerAvatarUrl} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Highlight</p>
          <p className="font-extrabold text-black truncate text-sm">{ownerName}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-0.5 bg-gray-100 aspect-[2.2/1]">
        {[p0, p1].map((p, i) => {
          const url = thumb(p);
          if (!url) {
            return <div key={i} className="bg-gray-200" />;
          }
          const video = p && isHighlightVideoUrl(p.url);
          return (
            <div key={i} className="relative bg-black overflow-hidden">
              {video ? (
                <HighlightStillMedia url={url} className="absolute inset-0 h-full w-full object-cover" />
              ) : (
                <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover" draggable={false} />
              )}
            </div>
          );
        })}
      </div>
      <p className="px-3 py-2 text-xs font-semibold text-gray-500">Tap to view</p>
    </button>
  );
}
