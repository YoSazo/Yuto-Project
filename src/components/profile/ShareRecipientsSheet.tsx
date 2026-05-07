import { useEffect, useMemo, useState } from "react";
import { Users } from "lucide-react";
import {
  getFriends,
  getOrCreateDmConversation,
  listMyGroupChats,
  sendDmMessage,
  sendDmShareMessage,
  sendGroupChatMessage,
  sendGroupChatShareMessage,
  type DmSharePayload,
  type GroupChatRow,
} from "../../lib/supabase";
import UserAvatar from "../UserAvatar";
import { buildGroupChatPickerLabels } from "../../lib/groupChatDisplay";

type FriendRow = { id: string; username: string; display_name: string; avatar_url: string | null };

function shareSheetTitle(payload: DmSharePayload): string {
  switch (payload.kind) {
    case "profile":
      return "Send profile to";
    case "plan":
      return "Share plan";
    case "function":
      return "Share function";
    case "listing":
      return payload.listing_kind === "sell" ? "Share selling post" : "Share service";
    case "highlight":
      return "Share highlight";
    default:
      return "Send to";
  }
}

function emptyCopy(payload: DmSharePayload): string {
  if (payload.kind === "profile") return "Add friends or join a group to share profiles.";
  if (payload.kind === "highlight") return "Add friends or join a group to share this highlight.";
  return "Add friends or join a group to share.";
}

/** Pick friends + group chats, optional note, then DM / group share payloads (multi-recipient). */
export function ShareRecipientsSheet({
  open,
  onClose,
  currentUserId,
  sharePayload,
  excludeUserIds = [],
}: {
  open: boolean;
  onClose: () => void;
  currentUserId: string;
  sharePayload: DmSharePayload;
  excludeUserIds?: string[];
}) {
  const [friends, setFriends] = useState<FriendRow[]>([]);
  const [groups, setGroups] = useState<GroupChatRow[]>([]);
  const [friendSel, setFriendSel] = useState<Set<string>>(() => new Set());
  const [groupSel, setGroupSel] = useState<Set<string>>(() => new Set());
  const [caption, setCaption] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");

  const groupLabels = useMemo(() => buildGroupChatPickerLabels(groups), [groups]);
  const title = useMemo(() => shareSheetTitle(sharePayload), [sharePayload]);
  const excludeKey = (excludeUserIds ?? []).slice().sort().join(",");

  useEffect(() => {
    if (!open || !currentUserId) return;
    setFriendSel(new Set());
    setGroupSel(new Set());
    setCaption("");
    setErr("");
    let cancelled = false;
    const excludedIds = new Set(excludeUserIds ?? []);

    void Promise.all([getFriends(currentUserId), listMyGroupChats(currentUserId)])
      .then(([friendData, groupRows]) => {
        if (cancelled) return;
        const list = (friendData as { requester_id: string; requester?: unknown; addressee?: unknown }[]).map((f) => {
          const p = (f.requester_id === currentUserId ? f.addressee : f.requester) as FriendRow | undefined;
          if (!p?.id) return null;
          return {
            id: p.id as string,
            username: String(p.username),
            display_name: String(p.display_name),
            avatar_url: (p.avatar_url as string | null) ?? null,
          };
        });
        const clean = (list.filter(Boolean) as FriendRow[]).filter((fr) => !excludedIds.has(fr.id));
        setFriends(clean);
        setGroups(groupRows ?? []);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [open, currentUserId, excludeKey]);

  const toggleFriend = (id: string) => {
    setFriendSel((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setErr("");
  };

  const toggleGroup = (id: string) => {
    setGroupSel((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setErr("");
  };

  const onSend = async () => {
    const totalTargets = friendSel.size + groupSel.size;
    if (totalTargets === 0) return;
    const cap = caption.trim();
    setSending(true);
    setErr("");
    try {
      const tasks: Promise<unknown>[] = [];
      friendSel.forEach((fid) => {
        tasks.push(
          (async () => {
            const convo = await getOrCreateDmConversation(currentUserId, fid);
            if (cap) await sendDmMessage(convo.id, currentUserId, cap);
            await sendDmShareMessage(convo.id, currentUserId, sharePayload);
          })(),
        );
      });
      groupSel.forEach((gid) => {
        tasks.push(
          (async () => {
            if (cap) await sendGroupChatMessage(gid, currentUserId, cap);
            await sendGroupChatShareMessage(gid, currentUserId, sharePayload);
          })(),
        );
      });
      const results = await Promise.allSettled(tasks);
      if (results.some((r) => r.status === "rejected")) {
        setErr("Some messages couldn’t send. Try again.");
        return;
      }
      onClose();
    } catch (e) {
      console.error(e);
      setErr("Couldn't send. Try again.");
    } finally {
      setSending(false);
    }
  };

  if (!open) return null;

  const ready = friendSel.size + groupSel.size > 0;
  const emptyRecipients = friends.length === 0 && groups.length === 0;

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-end md:items-center justify-center z-[60] fade-in"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
      role="presentation"
    >
      <div className="bg-white rounded-t-3xl md:rounded-3xl w-full max-w-md max-h-[min(92vh,720px)] flex flex-col modal-slide-up shadow-xl">
        <div className="flex justify-between items-start gap-3 p-6 pb-2 shrink-0 border-b border-gray-100">
          <h2 className="font-bold text-xl text-black">{title}</h2>
          <button type="button" onClick={onClose} className="text-2xl text-gray-400 hover:text-black bg-transparent border-none shrink-0 leading-none" aria-label="Close">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
          {emptyRecipients ? (
            <p className="text-sm text-gray-400 text-center py-6">{emptyCopy(sharePayload)}</p>
          ) : (
            <div className="flex flex-col gap-6">
              {friends.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3 px-1">Friends</p>
                  <div className="flex flex-wrap gap-3">
                    {friends.map((friend) => {
                      const sel = friendSel.has(friend.id);
                      return (
                        <button
                          key={friend.id}
                          type="button"
                          onClick={() => toggleFriend(friend.id)}
                          className={`flex items-center gap-2 px-4 py-2.5 rounded-full border-2 transition-all tap-scale ${
                            sel ? "bg-black border-black text-white" : "bg-white border-gray-200 text-black"
                          }`}
                        >
                          <UserAvatar name={friend.display_name} avatarUrl={friend.avatar_url} size="sm" className={sel ? "ring-2 ring-white" : ""} />
                          <span className="font-medium text-sm">{friend.display_name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {groups.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3 px-1">Group chats</p>
                  <div className="flex flex-wrap gap-3">
                    {groups.map((g) => {
                      const sel = groupSel.has(g.id);
                      const pillLabel = groupLabels[g.id] ?? "Group chat";
                      return (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => toggleGroup(g.id)}
                          className={`flex items-center gap-2 px-4 py-2.5 rounded-full border-2 transition-all tap-scale max-w-[100%] ${
                            sel ? "bg-black border-black text-white" : "bg-white border-gray-200 text-black"
                          }`}
                        >
                          <span
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                              sel ? "bg-white/10 text-white" : "bg-gray-100 text-black"
                            }`}
                          >
                            <Users size={18} />
                          </span>
                          <span className="font-medium text-sm truncate text-left">{pillLabel}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-gray-100 px-6 py-4 space-y-3 bg-white">
          {!emptyRecipients && !ready && (
            <p className="text-sm text-gray-500 text-center py-2">Choose one or more people or groups — then add an optional note and send.</p>
          )}
          {ready && (
            <>
              <label className="sr-only" htmlFor="share-recipients-note">
                Message
              </label>
              <textarea
                id="share-recipients-note"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Add a note… (optional)"
                rows={4}
                maxLength={1200}
                disabled={sending}
                className="w-full min-h-[5.25rem] resize-none rounded-[1.75rem] bg-gray-100 px-4 py-3.5 font-semibold text-sm text-black placeholder:text-gray-400 outline-none ring-2 ring-transparent focus:ring-black/15 disabled:opacity-50"
              />
            </>
          )}
          {err && <p className="text-sm text-red-500 font-semibold text-center">{err}</p>}
          <button
            type="button"
            onClick={() => void onSend()}
            disabled={!ready || sending || emptyRecipients}
            className={`w-full py-4 rounded-full font-bold text-lg transition-all tap-scale ${
              ready && !sending ? "bg-black text-white active:scale-[0.98]" : "bg-gray-100 text-gray-400 cursor-not-allowed"
            }`}
          >
            {sending ? "Sending…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
