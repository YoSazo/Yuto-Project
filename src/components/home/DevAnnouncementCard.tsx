import { useEffect, useRef, useState } from "react";
import { Heart, MessageCircle, Megaphone, Trash2, X, Send } from "lucide-react";
import { supabase } from "../../lib/supabase";
import UserAvatar from "../UserAvatar";

// Your user ID — only this account can create announcements
const DEV_USER_ID = "f5f5da38-c839-4ce4-94fc-10f3854674e0";

export type Announcement = {
  id: string;
  content: string;
  image_url: string | null;
  allow_replies: boolean;
  reply_mode: "dm" | "public";
  created_at: string;
  hearts: number;
  user_hearted: boolean;
};

type ReplyMessage = {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles: { display_name: string; avatar_url: string | null } | null;
};

/**
 * Pinned dev announcement card at the top of the feed.
 * Only visible when there's an active announcement.
 */
export function DevAnnouncementCard({
  currentUserId,
  onReplyDm,
}: {
  currentUserId: string;
  onReplyDm?: (announcementId: string) => void;
}) {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [hearting, setHearting] = useState(false);
  const [showReplies, setShowReplies] = useState(false);
  const [replies, setReplies] = useState<ReplyMessage[]>([]);
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const isDev = currentUserId === DEV_USER_ID;

  useEffect(() => {
    fetchLatest();
  }, [currentUserId]);

  const fetchLatest = async () => {
    try {
      const { data, error } = await supabase
        .from("dev_announcements")
        .select("id, content, image_url, allow_replies, reply_mode, created_at")
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error || !data) { setAnnouncement(null); return; }

      const [{ count: heartCount }, { data: myHeart }] = await Promise.all([
        supabase.from("dev_announcement_hearts").select("id", { count: "exact", head: true }).eq("announcement_id", data.id),
        supabase.from("dev_announcement_hearts").select("id").eq("announcement_id", data.id).eq("user_id", currentUserId).maybeSingle(),
      ]);

      setAnnouncement({
        ...data,
        reply_mode: data.reply_mode || "dm",
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

  const handleDelete = async () => {
    if (!announcement || !isDev) return;
    await supabase.from("dev_announcements").update({ active: false }).eq("id", announcement.id);
    setAnnouncement(null);
  };

  const loadReplies = async () => {
    if (!announcement) return;
    const { data } = await supabase
      .from("dev_announcement_replies")
      .select("id, user_id, content, created_at, profiles(display_name, avatar_url)")
      .eq("announcement_id", announcement.id)
      .order("created_at", { ascending: true })
      .limit(100);
    setReplies((data || []) as any);
  };

  const handleOpenReplies = () => {
    if (!announcement) return;
    if (announcement.reply_mode === "dm") {
      onReplyDm?.(announcement.id);
    } else {
      setShowReplies(true);
      loadReplies();
    }
  };

  const handleSendReply = async () => {
    if (!announcement || !replyText.trim() || sendingReply) return;
    setSendingReply(true);
    try {
      await supabase.from("dev_announcement_replies").insert({
        announcement_id: announcement.id,
        user_id: currentUserId,
        content: replyText.trim(),
      });
      setReplyText("");
      await loadReplies();
    } catch (e) {
      console.error("reply error:", e);
    } finally {
      setSendingReply(false);
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
    <>
      <div className="mb-5 rounded-3xl border-2 border-dashed border-blue-300 dark:border-blue-700 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 p-5 relative overflow-hidden">
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
          {isDev && (
            <button
              type="button"
              onClick={handleDelete}
              className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 text-red-500 flex items-center justify-center border-none"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>

        {/* Content */}
        <p className="text-sm text-blue-900 dark:text-blue-100 font-medium leading-relaxed mb-3 relative z-10 whitespace-pre-wrap">
          {announcement.content}
        </p>

        {/* Image/Video */}
        {announcement.image_url && (
          <div className="mb-3 rounded-2xl overflow-hidden relative z-10">
            {announcement.image_url.includes("video") || announcement.image_url.endsWith(".mp4") ? (
              <video src={announcement.image_url} className="w-full h-auto max-h-[300px] object-cover" controls playsInline muted />
            ) : (
              <img src={announcement.image_url} alt="" className="w-full h-auto max-h-[300px] object-cover" />
            )}
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

          {announcement.allow_replies && (
            <button
              type="button"
              onClick={handleOpenReplies}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold bg-white/60 dark:bg-zinc-800/60 text-blue-700 dark:text-blue-300 hover:bg-white dark:hover:bg-zinc-800 transition-all border-none"
            >
              <MessageCircle size={16} />
              {announcement.reply_mode === "dm" ? "Reply" : "Chat"}
            </button>
          )}
        </div>
      </div>

      {/* Public replies modal */}
      {showReplies && announcement.reply_mode === "public" && (
        <div className="fixed inset-0 bg-black/60 flex items-end md:items-center justify-center z-50 fade-in">
          <div className="bg-white dark:bg-zinc-900 rounded-t-3xl md:rounded-3xl w-full max-w-md p-6 modal-slide-up max-h-[80vh] flex flex-col transition-colors">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-bold text-lg text-black dark:text-white">Replies</h2>
              <button type="button" onClick={() => setShowReplies(false)} className="text-2xl text-gray-400 hover:text-black dark:hover:text-white bg-transparent border-none">
                <X size={22} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 mb-4 min-h-0">
              {replies.length === 0 ? (
                <p className="text-center text-gray-400 dark:text-gray-500 text-sm py-8">No replies yet. Be the first!</p>
              ) : (
                replies.map((r) => {
                  const isDevReply = r.user_id === DEV_USER_ID;
                  return (
                    <div key={r.id} className="flex items-start gap-2">
                      {isDevReply ? (
                        <div className="w-7 h-7 rounded-full bg-blue-500 text-white flex items-center justify-center shrink-0">
                          <Megaphone size={12} />
                        </div>
                      ) : (
                        <UserAvatar name={r.profiles?.display_name || "User"} avatarUrl={r.profiles?.avatar_url || null} size="sm" className="w-7 h-7 shrink-0" />
                      )}
                      <div className="bg-gray-50 dark:bg-zinc-800 rounded-2xl px-3 py-2 max-w-[85%]">
                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-0.5">
                          {isDevReply ? "Yuto Team" : (r.profiles?.display_name || "User")}
                        </p>
                        <p className="text-sm text-black dark:text-white">{r.content}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex gap-2 border-t border-gray-100 dark:border-zinc-800 pt-4">
              <input
                type="text"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Write a reply..."
                className="flex-1 h-11 rounded-2xl border border-gray-200 dark:border-zinc-700 bg-transparent text-black dark:text-white px-4 text-sm outline-none focus:border-blue-500"
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendReply(); } }}
              />
              <button
                type="button"
                onClick={handleSendReply}
                disabled={sendingReply || !replyText.trim()}
                className="h-11 px-4 rounded-2xl bg-blue-600 text-white font-bold text-sm disabled:opacity-40"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** Check if the current user is the dev (for showing the compose "Update" tab) */
export function isDevUser(userId: string | undefined): boolean {
  return userId === DEV_USER_ID;
}

export { DEV_USER_ID };
