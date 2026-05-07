import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Users } from "lucide-react";
import UserAvatar from "../components/UserAvatar";
import { useAuth } from "../contexts/AuthContext";
import {
  getMyDmUnreadCounts,
  getMyGroupUnreadCounts,
  getGroupMemberIds,
  listMyDmConversations,
  listMyGroupChats,
  supabase,
  type DmConversation,
  type GroupChatRow,
} from "../lib/supabase";
import { buildGroupChatPickerLabels } from "../lib/groupChatDisplay";

type ProfileRow = { id: string; username: string; display_name: string; avatar_url: string | null };

function StackedGroupMemberAvatars({
  memberIds,
  profilesById,
  excludeUserId,
}: {
  memberIds: string[];
  profilesById: Record<string, ProfileRow>;
  excludeUserId: string | null;
}) {
  const others = useMemo(
    () => memberIds.filter((id) => id && id !== excludeUserId),
    [memberIds, excludeUserId],
  );

  if (others.length === 0) {
    return (
      <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-black shrink-0">
        <Users size={22} />
      </div>
    );
  }

  const useOverlap = others.length >= 5;
  /** Many members: four faces plus +N for the rest */
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

export default function MessagesScreen() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<GroupChatRow[]>([]);
  const [convos, setConvos] = useState<DmConversation[]>([]);
  const [profilesById, setProfilesById] = useState<Record<string, ProfileRow>>({});
  const [groupMemberIds, setGroupMemberIds] = useState<Record<string, string[]>>({});
  const [unreadByConvo, setUnreadByConvo] = useState<Record<string, number>>({});
  const [unreadByGroup, setUnreadByGroup] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const [rows, groupRows] = await Promise.all([
          listMyDmConversations(user.id),
          listMyGroupChats(user.id).catch(() => [] as GroupChatRow[]),
        ]);
        if (cancelled) return;
        setConvos(rows);
        setGroups(groupRows);

        const [unreadDm, unreadGr] = await Promise.all([
          getMyDmUnreadCounts(user.id),
          getMyGroupUnreadCounts(user.id).catch(() => ({ total: 0, byGroupId: {} as Record<string, number> })),
        ]);
        setUnreadByConvo(unreadDm.byConversationId);
        setUnreadByGroup(unreadGr.byGroupId);

        const memberPairs = await Promise.all(
          groupRows.map(async (g) => {
            try {
              const ids = await getGroupMemberIds(g.id);
              return [g.id, ids] as const;
            } catch {
              return [g.id, [] as string[]] as const;
            }
          }),
        );
        const byGroup: Record<string, string[]> = {};
        memberPairs.forEach(([id, ids]) => {
          byGroup[id] = ids;
        });
        setGroupMemberIds(byGroup);

        const dmOtherIds = Array.from(
          new Set(
            rows
              .map((c) => (c.user_low === user.id ? c.user_high : c.user_low))
              .filter(Boolean),
          ),
        );
        const groupProfileIds = Array.from(new Set(memberPairs.flatMap(([, ids]) => ids)));
        const allIds = Array.from(new Set([...dmOtherIds, ...groupProfileIds]));
        if (allIds.length === 0) {
          setProfilesById({});
          return;
        }
        const { data, error } = await supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url")
          .in("id", allIds);
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
      .channel("dm-group-inbox")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "dm_messages" }, () => {
        void getMyDmUnreadCounts(user.id)
          .then((u) => setUnreadByConvo(u.byConversationId))
          .catch(() => {});
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "group_chat_messages" }, () => {
        void getMyGroupUnreadCounts(user.id)
          .then((u) => setUnreadByGroup(u.byGroupId))
          .catch(() => {});
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

  const groupRowLabels = useMemo(() => buildGroupChatPickerLabels(groups), [groups]);

  return (
    <div className="flex flex-col overflow-y-auto pb-28 px-4 pt-6">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-2 min-w-0 -ml-0.5">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center shrink-0"
            aria-label="Back"
            title="Back"
          >
            <ArrowLeft size={18} />
          </button>
          <span className="text-2xl font-bold text-black truncate">Messages</span>
        </div>
        <button
          type="button"
          onClick={() => navigate("/messages/group/new")}
          className="w-11 h-11 rounded-2xl bg-gray-100 text-black flex items-center justify-center hover:bg-gray-200 transition-colors shrink-0"
          aria-label="New group chat"
          title="New group chat"
        >
          <Plus size={20} />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin" />
        </div>
      ) : groups.length === 0 && items.length === 0 ? (
        <div className="py-20 text-center">
          <p className="font-bold text-black text-lg">No messages yet</p>
          <p className="text-gray-400 text-sm mt-1">Tap “Message” on someone’s profile or start a group.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {groups.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 px-1">Group chats</p>
              {groups.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => navigate(`/messages/group/${g.id}`)}
                  className="w-full bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex items-center gap-3 text-left hover:bg-gray-50 transition-colors"
                >
                  <StackedGroupMemberAvatars
                    memberIds={groupMemberIds[g.id] || []}
                    profilesById={profilesById}
                    excludeUserId={user?.id ?? null}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-black truncate">{groupRowLabels[g.id] ?? "Group chat"}</p>
                    <p className="text-sm text-gray-400 truncate">Tap to open</p>
                  </div>
                  {(unreadByGroup[g.id] || 0) > 0 && (
                    <span className="min-w-6 h-6 px-2 rounded-full bg-red-500 text-white text-xs font-extrabold flex items-center justify-center">
                      {Math.min(99, unreadByGroup[g.id])}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {items.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 px-1">Direct messages</p>
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
      )}
    </div>
  );
}

