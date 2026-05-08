import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Users, MessageCircle, Calendar, Sparkles, X } from "lucide-react";
import UserAvatar from "../UserAvatar";
import {
  getFriends,
  getOrCreateDmConversation,
  listMyThreads,
  type UnifiedThreadRow,
} from "../../lib/supabase";

type Friend = { id: string; username: string; display_name: string; avatar_url: string | null };

/**
 * "Talk about what?" — one sheet to start any conversation.
 * Picks between four destinations:
 *   1. New 1:1 with a friend
 *   2. New group chat
 *   3. Jump into an existing plan/function/group thread you're already part of
 *
 * Replaces the old behavior where the SquarePen button hard-routed to
 * "new group" and made you re-pick contacts. Reduces friction at the moment
 * the user actually has something to say.
 */
export function ComposeAnywhereSheet({
  currentUserId,
  onClose,
}: {
  currentUserId: string;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [friends, setFriends] = useState<Friend[]>([]);
  const [threads, setThreads] = useState<UnifiedThreadRow[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [fs, ts] = await Promise.all([
          getFriends(currentUserId),
          listMyThreads(currentUserId).catch(() => [] as UnifiedThreadRow[]),
        ]);
        if (cancelled) return;
        const flat: Friend[] = (fs as any[]).map((f) => {
          const profile =
            f.requester_id === currentUserId ? f.addressee : f.requester;
          return profile as Friend;
        });
        setFriends(flat.filter(Boolean));
        setThreads(ts);
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentUserId]);

  const q = query.trim().toLowerCase();
  const matchedFriends = useMemo(() => {
    if (!q) return friends.slice(0, 5);
    return friends.filter(
      (f) =>
        f.display_name?.toLowerCase().includes(q) ||
        f.username?.toLowerCase().includes(q),
    );
  }, [friends, q]);

  // Filter existing threads by what the user typed — lets you jump back into
  // a plan called "Sunday picnic" without leaving the composer.
  const matchedThreads = useMemo(() => {
    if (!q) return threads.slice(0, 5);
    return threads.filter((t) => t.title.toLowerCase().includes(q)).slice(0, 8);
  }, [threads, q]);

  const openDmWithFriend = async (friendId: string) => {
    setBusyId(friendId);
    try {
      const c = await getOrCreateDmConversation(currentUserId, friendId);
      onClose();
      navigate(`/messages/${c.id}`, { state: { otherUserId: friendId } });
    } catch (e) {
      console.error(e);
    } finally {
      setBusyId(null);
    }
  };

  const openThread = (t: UnifiedThreadRow) => {
    onClose();
    if (t.kind === "dm") {
      navigate(`/messages/${t.id}`, { state: { otherUserId: t.peerUserId } });
    } else if (t.kind === "group") {
      navigate(`/messages/group/${t.id}`);
    } else {
      navigate("/home", { state: { focus: { kind: t.kind, id: t.id, openChat: true } } });
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-end justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-3xl w-full max-w-md flex flex-col"
        style={{ maxHeight: "85vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
          <div>
            <h2 className="font-bold text-lg text-black">Talk about what?</h2>
            <p className="text-xs text-gray-400">Start a chat or jump back into one</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-5 pt-3">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search a friend, plan or function..."
              className="w-full h-11 pl-9 pr-3 bg-gray-100 rounded-xl text-sm font-medium text-black placeholder:text-gray-400 outline-none"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-6 pt-4 flex flex-col gap-5">
          {/* Quick actions */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                navigate("/messages/group/new");
              }}
              className="bg-black text-white rounded-2xl p-4 text-left flex flex-col gap-1 hover:bg-gray-900 transition-colors"
            >
              <Users size={18} />
              <p className="font-bold text-sm">New group</p>
              <p className="text-[11px] text-white/60">Pick friends to chat with</p>
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                navigate("/home", { state: { openCompose: true } });
              }}
              className="bg-gray-100 text-black rounded-2xl p-4 text-left flex flex-col gap-1 hover:bg-gray-200 transition-colors"
            >
              <Sparkles size={18} />
              <p className="font-bold text-sm">Post a Plan</p>
              <p className="text-[11px] text-gray-400">Open the home composer</p>
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-10">
              <div className="w-6 h-6 border-2 border-gray-200 border-t-black rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {matchedFriends.length > 0 && (
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Message a friend
                  </p>
                  {matchedFriends.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      disabled={busyId === f.id}
                      onClick={() => void openDmWithFriend(f.id)}
                      className="w-full bg-white border border-gray-100 rounded-2xl p-3 shadow-sm flex items-center gap-3 text-left hover:bg-gray-50 transition-colors disabled:opacity-60"
                    >
                      <UserAvatar
                        name={f.display_name || "User"}
                        avatarUrl={f.avatar_url}
                        size="md"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-black truncate">
                          {f.display_name || "User"}
                        </p>
                        <p className="text-xs text-gray-400 truncate">
                          @{f.username || "unknown"}
                        </p>
                      </div>
                      <MessageCircle size={16} className="text-gray-400 shrink-0" />
                    </button>
                  ))}
                </div>
              )}

              {matchedThreads.length > 0 && (
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Jump back in
                  </p>
                  {matchedThreads.map((t) => (
                    <button
                      key={`${t.kind}:${t.id}`}
                      type="button"
                      onClick={() => openThread(t)}
                      className="w-full bg-white border border-gray-100 rounded-2xl p-3 shadow-sm flex items-center gap-3 text-left hover:bg-gray-50 transition-colors"
                    >
                      <div className="w-10 h-10 rounded-2xl bg-gray-100 flex items-center justify-center shrink-0 text-gray-500">
                        {t.kind === "plan" ? (
                          <Calendar size={16} />
                        ) : t.kind === "function" ? (
                          <Sparkles size={16} />
                        ) : t.kind === "group" ? (
                          <Users size={16} />
                        ) : (
                          <MessageCircle size={16} />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-black truncate">{t.title}</p>
                        <p className="text-xs text-gray-400 truncate">
                          {t.contextLabel || (t.kind === "dm" ? "Direct message" : "Group chat")}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {!loading && matchedFriends.length === 0 && matchedThreads.length === 0 && q && (
                <p className="text-center text-sm text-gray-400 py-8">
                  No matches for "{query}".
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
