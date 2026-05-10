import { useEffect, useState } from "react";
import { Heart, MessageCircle, Megaphone } from "lucide-react";
import { supabase } from "../../lib/supabase";
import UserAvatar from "../UserAvatar";

// Your user ID — only this account can create announcements
const DEV_USER_ID = "f5f5da38-c839-4ce4-94fc-10f3854674e0";

export type Announcement = {
  id: string;
  content: string;
  image_url: string | null;
  allow_replies: boolean;
  created_at: string;
  hearts: number;
  user_hearted: boolean;
};

/**
 * Pinned dev announcement card at the top of the feed.
 * Only visible when there's an active announcement.
 * Users can heart it. If allow_replies is true, they can reply (opens DM to dev).
 */
export function DevAnnouncementCard({
  currentUserId,
  onReply,
}: {
  currentUserId: string;
  onReply?: (announcementId: string) => void;
}) {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [hearting, setHearting] = useState(false);

  useEffect(() => {
    fetchLatest();
  }, [currentUserId]);

  const fetchLatest = async () => {
    try {
      // Get the latest active announcement
      const { data, error } = await supabase
        .from("dev_announcements")
        .select("id, content, image_url, allow_replies, created_at")
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error || !data) { setAnnouncement(null); return; }

      // Get heart count + whether current user hearted
      const [{ count: heartCount }, { data: myHeart }] = await Promise.all([
        supabase.from("dev_announcement_hearts").select("id", { count: "exact", head: true }).eq("announcement_id", data.id),
        supabase.from("dev_announcement_hearts").select("id").eq("announcement_id", data.id).eq("user_id", currentUserId).maybeSingle(),
      ]);

      setAnnouncement({
        ...data,
        hearts: heartCount || 0,
        user_hearted: !!myHeart?.id,
      });
    } catch (e) {
      console.error("announcement fetch:", e);
    }
  };

  const handleHeart = async () => {
    if (!announcement || hearting) return;
    setHearting(true);
    try {
      if (announcement.user_hearted) {
        await supabase.from("dev_announcement_hearts").delete().eq("announcement_id", announcement.id).eq("user_id", currentUserId);
        setAnnouncement(prev => prev ? { ...prev, hearts: Math.max(0, prev.hearts - 1), user_hearted: false } : null);
      } else {
        await supabase.from("dev_announcement_hearts").insert({ announcement_id: announcement.id, user_id: currentUserId });
        setAnnouncement(prev => prev ? { ...prev, hearts: prev.hearts + 1, user_hearted: true } : null);
      }
    } catch (e) {
      console.error("heart error:", e);
    } finally {
      setHearting(false);
    }
  };

  if (!announcement) return null;

  const timeAgo = (() => {
    const diff = Date.now() - new Date(announcement.created_at).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "now";
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    const d = Math.floor(h / 24);
    return `${d}d`;
  })();

  return (
    <div className="mb-5 rounded-3xl border-2 border-dashed border-blue-300 dark:border-blue-700 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 p-5 relative overflow-hidden">
      {/* Accent corner */}
      <div className="absolute top-0 right-0 w-20 h-20 bg-blue-200/30 dark:bg-blue-800/20 rounded-bl-[40px]" />
      
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-3 relative z-10">
        <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center">
          <Megaphone size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm text-blue-900 dark:text-blue-200">Yuto Team</p>
          <p className="text-[11px] text-blue-500 dark:text-blue-400 font-semibold">{timeAgo} ago</p>
        </div>
      </div>

      {/* Content */}
      <p className="text-sm text-blue-900 dark:text-blue-100 font-medium leading-relaxed mb-3 relative z-10 whitespace-pre-wrap">
        {announcement.content}
      </p>

      {/* Image */}
      {announcement.image_url && (
        <div className="mb-3 rounded-2xl overflow-hidden relative z-10">
          <img src={announcement.image_url} alt="" className="w-full h-auto max-h-[300px] object-cover" />
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-4 relative z-10">
        <button
          type="button"
          onClick={handleHeart}
          disabled={hearting}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold transition-all border-none ${
            announcement.user_hearted
              ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
              : "bg-white/60 dark:bg-zinc-800/60 text-blue-700 dark:text-blue-300 hover:bg-white dark:hover:bg-zinc-800"
          }`}
        >
          <Heart size={16} fill={announcement.user_hearted ? "currentColor" : "none"} />
          {announcement.hearts > 0 && <span>{announcement.hearts}</span>}
        </button>

        {announcement.allow_replies && onReply && (
          <button
            type="button"
            onClick={() => onReply(announcement.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold bg-white/60 dark:bg-zinc-800/60 text-blue-700 dark:text-blue-300 hover:bg-white dark:hover:bg-zinc-800 transition-all border-none"
          >
            <MessageCircle size={16} />
            Reply
          </button>
        )}
      </div>
    </div>
  );
}

/** Check if the current user is the dev (for showing the compose "Update" tab) */
export function isDevUser(userId: string | undefined): boolean {
  return userId === DEV_USER_ID;
}

export { DEV_USER_ID };
