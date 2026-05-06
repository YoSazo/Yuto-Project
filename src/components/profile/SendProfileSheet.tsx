import { useEffect, useMemo, useState } from "react";
import { Users } from "lucide-react";
import {
  getFriends,
  getOrCreateDmConversation,
  listMyGroupChats,
  sendDmShareMessage,
  sendGroupChatShareMessage,
  type GroupChatRow,
} from "../../lib/supabase";
import UserAvatar from "../UserAvatar";
import { buildGroupChatPickerLabels } from "../../lib/groupChatDisplay";

type FriendRow = { id: string; username: string; display_name: string; avatar_url: string | null };

type PickTarget =
  | { kind: "friend"; id: string }
  | { kind: "group"; id: string };

/** Bottom sheet — send shared profile via DM or group chat (`share.kind === "profile"`). */
export function SendProfileSheet({
  open,
  onClose,
  currentUserId,
  sharedProfileUserId,
}: {
  open: boolean;
  onClose: () => void;
  currentUserId: string;
  sharedProfileUserId: string;
}) {
  const [friends, setFriends] = useState<FriendRow[]>([]);
  const [groups, setGroups] = useState<GroupChatRow[]>([]);
  const [picked, setPicked] = useState<PickTarget | null>(null);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");

  const groupLabels = useMemo(() => buildGroupChatPickerLabels(groups), [groups]);

  useEffect(() => {
    if (!open || !currentUserId) return;
    setPicked(null);
    setErr("");
    let cancelled = false;

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
        const clean = (list.filter(Boolean) as FriendRow[]).filter((fr) => fr.id !== sharedProfileUserId);
        setFriends(clean);
        setGroups(groupRows ?? []);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [open, currentUserId, sharedProfileUserId]);

  const selectFriend = (id: string) => {
    setPicked((prev) => (prev?.kind === "friend" && prev.id === id ? null : { kind: "friend", id }));
    setErr("");
  };

  const selectGroup = (id: string) => {
    setPicked((prev) => (prev?.kind === "group" && prev.id === id ? null : { kind: "group", id }));
    setErr("");
  };

  const onSend = async () => {
    if (!picked) return;
    setSending(true);
    setErr("");
    try {
      if (picked.kind === "friend") {
        const convo = await getOrCreateDmConversation(currentUserId, picked.id);
        await sendDmShareMessage(convo.id, currentUserId, { kind: "profile", user_id: sharedProfileUserId });
      } else {
        await sendGroupChatShareMessage(picked.id, currentUserId, { kind: "profile", user_id: sharedProfileUserId });
      }
      onClose();
    } catch (e) {
      console.error(e);
      setErr("Couldn't send. Try again.");
    }
    setSending(false);
  };

  if (!open) return null;

  const ready = !!picked;
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
      <div className="bg-white rounded-t-3xl md:rounded-3xl w-full max-w-md max-h-[min(92vh,640px)] flex flex-col modal-slide-up">
        <div className="flex justify-between items-start gap-3 p-6 pb-3 shrink-0">
          <h2 className="font-bold text-xl text-black">Send profile to</h2>
          <button type="button" onClick={onClose} className="text-2xl text-gray-400 hover:text-black bg-transparent border-none shrink-0 leading-none" aria-label="Close">
            ✕
          </button>
        </div>

        <div className="px-6 flex-1 overflow-y-auto pb-6 min-h-[120px]">
          {emptyRecipients ? (
            <p className="text-sm text-gray-400 text-center py-6">Add friends or join a group to share profiles.</p>
          ) : (
            <div className="flex flex-col gap-6 pb-4">
              {friends.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3 px-1">Friends</p>
                  <div className="flex flex-wrap gap-3">
                    {friends.map((friend) => {
                      const sel = picked?.kind === "friend" && picked.id === friend.id;
                      return (
                        <button
                          key={friend.id}
                          type="button"
                          onClick={() => selectFriend(friend.id)}
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
                      const sel = picked?.kind === "group" && picked.id === g.id;
                      const pillLabel = groupLabels[g.id] ?? "Group chat";
                      return (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => selectGroup(g.id)}
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

          {err && <p className="text-sm text-red-500 font-semibold text-center mb-4">{err}</p>}

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
