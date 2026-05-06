import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, MessageCircle } from "lucide-react";
import UserAvatar from "../components/UserAvatar";
import { useAuth } from "../contexts/AuthContext";
import { getMyDmUnreadCounts, listMyDmConversations, supabase, type DmConversation } from "../lib/supabase";

type ProfileRow = { id: string; username: string; display_name: string; avatar_url: string | null };

export default function MessagesScreen() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [convos, setConvos] = useState<DmConversation[]>([]);
  const [profilesById, setProfilesById] = useState<Record<string, ProfileRow>>({});
  const [unreadByConvo, setUnreadByConvo] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const rows = await listMyDmConversations(user.id);
        if (cancelled) return;
        setConvos(rows);

        const unread = await getMyDmUnreadCounts(user.id);
        setUnreadByConvo(unread.byConversationId);

        const otherIds = Array.from(
          new Set(
            rows
              .map((c) => (c.user_low === user.id ? c.user_high : c.user_low))
              .filter(Boolean),
          ),
        );
        if (otherIds.length === 0) {
          setProfilesById({});
          return;
        }
        const { data, error } = await supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url")
          .in("id", otherIds);
        if (error) throw error;
        const map: Record<string, ProfileRow> = {};
        (data || []).forEach((p) => (map[p.id] = p as ProfileRow));
        setProfilesById(map);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("dm-inbox")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "dm_messages" }, () => {
        void getMyDmUnreadCounts(user.id).then((u) => setUnreadByConvo(u.byConversationId)).catch(() => {});
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const items = useMemo(() => {
    if (!user) return [];
    return convos.map((c) => {
      const otherId = c.user_low === user.id ? c.user_high : c.user_low;
      return { convo: c, other: profilesById[otherId], otherId };
    });
  }, [convos, profilesById, user]);

  return (
    <div className="flex flex-col overflow-y-auto pb-28 px-5 pt-6">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center"
            aria-label="Back"
            title="Back"
          >
            <ArrowLeft size={18} />
          </button>
          <MessageCircle size={18} className="text-black" />
          <span className="text-2xl font-bold text-black">Messages</span>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="py-20 text-center">
          <p className="font-bold text-black text-lg">No messages yet</p>
          <p className="text-gray-400 text-sm mt-1">Tap “Message” on someone’s profile to start.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map(({ convo, other, otherId }) => (
            <button
              key={convo.id}
              type="button"
              onClick={() => navigate(`/messages/${convo.id}`, { state: { otherUserId: otherId } })}
              className="w-full bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex items-center gap-3 text-left hover:bg-gray-50 transition-colors"
            >
              <UserAvatar name={other?.display_name || "User"} avatarUrl={other?.avatar_url || null} size="md" />
              <div className="min-w-0 flex-1">
                <p className="font-bold text-black truncate">{other?.display_name || "User"}</p>
                <p className="text-sm text-gray-400 truncate">@{other?.username || "unknown"}</p>
              </div>
              {(unreadByConvo[convo.id] || 0) > 0 && (
                <span className="min-w-6 h-6 px-2 rounded-full bg-red-500 text-white text-xs font-extrabold flex items-center justify-center">
                  {Math.min(99, unreadByConvo[convo.id])}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

