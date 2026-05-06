import { useEffect, useState } from "react";
import { getFriends, getOrCreateDmConversation, sendDmShareMessage } from "../../lib/supabase";
import UserAvatar from "../UserAvatar";

type FriendRow = { id: string; username: string; display_name: string; avatar_url: string | null };

/** Bottom sheet — pick one friend and send shared profile via DM (`share.kind === "profile"`). */
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!open || !currentUserId) return;
    setSelectedId(null);
    setErr("");
    let cancelled = false;
    void getFriends(currentUserId).then((data) => {
      if (cancelled) return;
      const list = (data as { requester_id: string; requester?: unknown; addressee?: unknown }[]).map((f) => {
        const p = (f.requester_id === currentUserId ? f.addressee : f.requester) as FriendRow | undefined;
        if (!p?.id) return null;
        return {
          id: p.id as string,
          username: String(p.username),
          display_name: String(p.display_name),
          avatar_url: (p.avatar_url as string | null) ?? null,
        };
      });
      const clean = list.filter(Boolean) as FriendRow[];
      setFriends(clean.filter((fr) => fr.id !== sharedProfileUserId));
    });
    return () => {
      cancelled = true;
    };
  }, [open, currentUserId, sharedProfileUserId]);

  const toggleSelect = (id: string) => {
    setSelectedId((prev) => (prev === id ? null : id));
    setErr("");
  };

  const onSend = async () => {
    if (!selectedId) return;
    setSending(true);
    setErr("");
    try {
      const convo = await getOrCreateDmConversation(currentUserId, selectedId);
      await sendDmShareMessage(convo.id, currentUserId, { kind: "profile", user_id: sharedProfileUserId });
      onClose();
    } catch (e) {
      console.error(e);
      setErr("Couldn't send. Try again.");
    }
    setSending(false);
  };

  if (!open) return null;

  const ready = !!selectedId;

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
          {friends.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No friends yet. Add friends first, then share.</p>
          ) : (
            <div className="flex flex-wrap gap-3 pb-4">
              {friends.map((friend) => {
                const sel = selectedId === friend.id;
                return (
                  <button
                    key={friend.id}
                    type="button"
                    onClick={() => toggleSelect(friend.id)}
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
          )}

          {err && <p className="text-sm text-red-500 font-semibold text-center mb-4">{err}</p>}

          <button
            type="button"
            onClick={() => void onSend()}
            disabled={!ready || sending}
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
