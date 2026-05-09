import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Users } from "lucide-react";
import UserAvatar from "../UserAvatar";
import type { UnifiedThreadRow } from "../../lib/supabase";

type ProfileRow = { id: string; username: string; display_name: string; avatar_url: string | null };

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  const w = Math.floor(d / 7);
  return `${w}w`;
}

function ContextChip({ label }: { label: "Plan" | "Function" | "Group" }) {
  const tones: Record<string, string> = {
    Plan: "bg-purple-100 text-purple-700",
    Function: "bg-amber-100 text-amber-800",
    Group: "bg-blue-100 text-blue-700",
  };
  return (
    <span
      className={`inline-flex items-center px-2 h-5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${tones[label] || "bg-gray-100 text-gray-700"}`}
    >
      {label}
    </span>
  );
}

function StackedAvatars({
  ids,
  profilesById,
  excludeId,
}: {
  ids: string[];
  profilesById: Record<string, ProfileRow>;
  excludeId: string | null;
}) {
  const others = useMemo(
    () => ids.filter((id) => id && id !== excludeId),
    [ids, excludeId],
  );

  if (others.length === 0) {
    return (
      <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-black shrink-0">
        <Users size={22} />
      </div>
    );
  }

  const useOverlap = others.length >= 5;
  const showOverflowPill = others.length > 5;
  const maxFaces = useOverlap ? (showOverflowPill ? 4 : Math.min(5, others.length)) : others.length;
  const visibleIds = others.slice(0, maxFaces);
  const extra = showOverflowPill ? others.length - 4 : 0;

  return (
    <div className={`flex shrink-0 items-center ${useOverlap ? "pl-0.5" : "gap-1"}`}>
      {visibleIds.map((id, i) => {
        const p = profilesById[id];
        return (
          <div
            key={id}
            className={useOverlap ? "relative rounded-full ring-2 ring-white bg-white" : "shrink-0"}
            style={useOverlap && i > 0 ? { marginLeft: -10 } : undefined}
          >
            <UserAvatar name={p?.display_name || "Member"} avatarUrl={p?.avatar_url || null} size="sm" />
          </div>
        );
      })}
      {extra > 0 && (
        <div
          className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-200 text-[11px] font-extrabold text-black ring-2 ring-white"
          style={{ marginLeft: -10 }}
        >
          +{extra > 99 ? 99 : extra}
        </div>
      )}
    </div>
  );
}

export function ThreadRow({
  thread,
  currentUserId,
  profilesById,
}: {
  thread: UnifiedThreadRow;
  currentUserId: string;
  profilesById: Record<string, ProfileRow>;
}) {
  const navigate = useNavigate();

  const handleOpen = () => {
    if (thread.kind === "dm") {
      navigate(`/messages/${thread.id}`, { state: { otherUserId: thread.peerUserId } });
    } else if (thread.kind === "group") {
      navigate(`/messages/group/${thread.id}`);
    } else {
      // Plan / function chats live behind feed cards on /home. Open the
      // matching modal directly via state.focus.openChat.
      navigate("/home", {
        state: { focus: { kind: thread.kind, id: thread.id, openChat: true } },
      });
    }
  };

  // Preview: prefer last message, else fall back to subtitle.
  const preview = thread.lastMessagePreview || thread.subtitle;
  const senderPrefix = (() => {
    if (!thread.lastMessagePreview) return "";
    if (thread.lastSenderId === currentUserId) return "You: ";
    if ((thread.kind === "group" || thread.kind === "plan" || thread.kind === "function") && thread.lastSenderId) {
      const p = profilesById[thread.lastSenderId];
      const first = (p?.display_name || p?.username || "").split(" ")[0];
      return first ? `${first}: ` : "";
    }
    return "";
  })();

  const showStacked = thread.kind === "group" || thread.kind === "plan" || thread.kind === "function";

  return (
    <button
      type="button"
      onClick={handleOpen}
      className="w-full bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-4 shadow-sm flex items-center gap-3 text-left hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
    >
      {showStacked ? (
        <StackedAvatars
          ids={thread.memberIds}
          profilesById={profilesById}
          excludeId={currentUserId}
        />
      ) : (
        <UserAvatar
          name={thread.peerName || thread.title || "User"}
          avatarUrl={thread.peerAvatarUrl}
          size="md"
        />
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 min-w-0">
          <p className="font-bold text-black dark:text-white truncate flex-1 min-w-0">{thread.title}</p>
          {thread.contextLabel && <ContextChip label={thread.contextLabel} />}
        </div>
        <p className="text-sm text-gray-400 truncate">
          {senderPrefix}
          {preview}
        </p>
      </div>

      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className="text-[11px] font-semibold text-gray-400">
          {timeAgo(thread.lastActivityAt)}
        </span>
        {thread.unread && (
          <span className="w-2.5 h-2.5 rounded-full bg-red-500" aria-label="Unread" />
        )}
      </div>
    </button>
  );
}
