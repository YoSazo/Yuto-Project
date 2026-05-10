import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Briefcase, Search, SquarePen, Users, Wallet, X } from "lucide-react";
import UserAvatar from "../components/UserAvatar";
import { useAuth } from "../contexts/AuthContext";
import { SegmentedTabsBar } from "../components/ui/SegmentedTabsBar";
import {
  getMyDmUnreadCounts,
  listMyDmConversations,
  listMyBusinessDmContexts,
  getBusinessDashboard,
  cancelHostListing,
  listMyThreads,
  supabase,
  type DmConversation,
  type UnifiedThreadRow,
} from "../lib/supabase";
import { toast } from "sonner";
import { ThreadRow } from "../components/messages/ThreadRow";
import { MoneyInboxTab } from "../components/messages/MoneyInboxTab";
import { ComposeAnywhereSheet } from "../components/messages/ComposeAnywhereSheet";

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
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"personal" | "money" | "business">(() => {
    const t = searchParams.get("tab");
    if (t === "money") return "money";
    if (t === "business") return "business";
    return "personal";
  });

  useEffect(() => {
    const t = searchParams.get("tab");
    if (t === "money") setActiveTab("money");
    else if (t === "business") setActiveTab("business");
  }, [searchParams]);
  // Unified inbox: every chat surface (DMs + group chats + plan chats + function chats)
  // lives in a single sorted-by-recency list. The Personal tab renders this
  // directly; the Business tab still pulls a narrower DM-only slice.
  const [threads, setThreads] = useState<UnifiedThreadRow[]>([]);
  const [convos, setConvos] = useState<DmConversation[]>([]);
  const [profilesById, setProfilesById] = useState<Record<string, ProfileRow>>({});
  const [unreadByConvo, setUnreadByConvo] = useState<Record<string, number>>({});
  const [bizContexts, setBizContexts] = useState<
    { conversation_id: string; buyer_id: string; listing_kind: "sell" | "service"; listing_title: string; created_at: string }[]
  >([]);
  const [bizDashboard, setBizDashboard] = useState<{
    revenueThisMonthKes: number;
    ordersThisMonth: number;
    activeListings: number;
    sellActive: number;
    serviceActive: number;
    listings: { id: string; title: string; kind: "sell" | "service"; remaining: number | null }[];
  } | null>(null);
  const [bizTab, setBizTab] = useState<"revenue" | "orders" | "listings">("revenue");
  const [listingBusyId, setListingBusyId] = useState<string | null>(null);
  const [showCompose, setShowCompose] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const [unifiedThreads, dmRows] = await Promise.all([
          listMyThreads(user.id),
          listMyDmConversations(user.id).catch(() => [] as DmConversation[]),
        ]);
        if (cancelled) return;
        setThreads(unifiedThreads);
        setConvos(dmRows);

        // Business contexts (seller/provider view) + mini dashboard.
        try {
          const [ctx, dash] = await Promise.all([
            listMyBusinessDmContexts(user.id).catch(() => []),
            getBusinessDashboard(user.id).catch(() => null),
          ]);
          if (!cancelled) {
            setBizContexts(
              (ctx || []).map((c) => ({
                conversation_id: c.conversation_id,
                buyer_id: c.buyer_id,
                listing_kind: c.listing_kind,
                listing_title: c.listing_title,
                created_at: c.created_at,
              })),
            );
            setBizDashboard(dash);
          }
        } catch {
          // ignore
        }

        // DM-only unread map for the Business tab badges.
        const unreadDm = await getMyDmUnreadCounts(user.id).catch(() => ({
          total: 0,
          byConversationId: {} as Record<string, number>,
        }));
        if (!cancelled) setUnreadByConvo(unreadDm.byConversationId);

        // Hydrate a profile map for every party that might appear in the inbox
        // (DM peers + group/plan/function members + business buyers).
        const allIds = new Set<string>();
        unifiedThreads.forEach((t) => {
          if (t.peerUserId) allIds.add(t.peerUserId);
          t.memberIds.forEach((id) => allIds.add(id));
        });
        dmRows.forEach((c) => {
          const other = c.user_low === user.id ? c.user_high : c.user_low;
          if (other) allIds.add(other);
        });
        (bizContexts || []).forEach((c) => allIds.add(c.buyer_id));
        if (allIds.size === 0) {
          setProfilesById({});
          return;
        }
        const { data, error } = await supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url")
          .in("id", Array.from(allIds));
        if (error) throw error;
        const map: Record<string, ProfileRow> = {};
        (data || []).forEach((p) => (map[p.id] = p as ProfileRow));
        if (!cancelled) setProfilesById(map);
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
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
      // Any new message (DM, group, plan, function) → re-aggregate threads so
      // the inbox jumps the row to the top + flips the unread dot.
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "dm_messages" }, () => {
        void Promise.all([
          listMyThreads(user.id),
          getMyDmUnreadCounts(user.id),
        ])
          .then(([t, u]) => {
            setThreads(t);
            setUnreadByConvo(u.byConversationId);
          })
          .catch(() => {});
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "group_chat_messages" }, () => {
        void listMyThreads(user.id).then(setThreads).catch(() => {});
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "plan_messages" }, () => {
        void listMyThreads(user.id).then(setThreads).catch(() => {});
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "function_messages" }, () => {
        void listMyThreads(user.id).then(setThreads).catch(() => {});
      })
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "group_chat_members", filter: `user_id=eq.${user.id}` },
        () => {
          void listMyThreads(user.id).then(setThreads).catch(() => {});
        },
      )
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

  const businessItems = useMemo(() => {
    if (!user) return [];
    const byConvoId = new Map(bizContexts.map((c) => [c.conversation_id, c]));
    return items
      .filter((x) => byConvoId.has(x.convo.id))
      .map((x) => ({ ...x, ctx: byConvoId.get(x.convo.id)! }));
  }, [bizContexts, items, user]);

  // Conversation search: matches against thread title, last message preview,
  // peer/member names, and usernames. All client-side over already-loaded
  // threads so it stays instant. The result still passes through ThreadRow,
  // so context chips and unread dots render the same way as the full list.
  const filteredThreads = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter((t) => {
      if (t.title.toLowerCase().includes(q)) return true;
      if (t.subtitle.toLowerCase().includes(q)) return true;
      if (t.lastMessagePreview && t.lastMessagePreview.toLowerCase().includes(q)) return true;
      if (t.peerName && t.peerName.toLowerCase().includes(q)) return true;
      // For groups/plans/functions, search any member's name/username too.
      for (const id of t.memberIds) {
        const p = profilesById[id];
        if (!p) continue;
        if (p.display_name?.toLowerCase().includes(q)) return true;
        if (p.username?.toLowerCase().includes(q)) return true;
      }
      return false;
    });
  }, [threads, searchQuery, profilesById]);

  return (
    <div className="flex flex-col overflow-y-auto pb-28 px-4 pt-6">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-2 min-w-0 -ml-0.5">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-zinc-800 text-black dark:text-white flex items-center justify-center shrink-0"
            aria-label="Back"
            title="Back"
          >
            <ArrowLeft size={18} />
          </button>
          <span className="text-2xl font-bold text-black dark:text-white truncate">Messages</span>
        </div>
        <button
          type="button"
          onClick={() => setShowCompose(true)}
          className="w-11 h-11 rounded-2xl bg-gray-100 dark:bg-zinc-800 text-black dark:text-white flex items-center justify-center hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors shrink-0"
          aria-label="New message"
          title="New message"
        >
          <SquarePen size={20} />
        </button>
      </div>

      <SegmentedTabsBar
        value={activeTab}
        onChange={setActiveTab}
        tabs={[
          { id: "personal", label: "Personal", icon: <Users size={18} /> },
          { id: "money", label: "Money", icon: <Wallet size={18} /> },
          { id: "business", label: "Business", icon: <Briefcase size={18} /> },
        ]}
        className="mb-4"
      />

      {activeTab === "personal" && threads.length > 0 && (
        <div className="relative mb-4">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search messages, plans, functions, friends..."
            className="w-full h-11 pl-9 pr-9 bg-gray-100 dark:bg-zinc-800 rounded-xl text-sm font-medium text-black dark:text-white placeholder:text-gray-400 outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center hover:bg-gray-300"
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin" />
        </div>
      ) : activeTab === "money" && user ? (
        <MoneyInboxTab userId={user.id} />
      ) : activeTab === "personal" && threads.length === 0 ? (
        <div className="py-20 text-center">
          <p className="font-bold text-black dark:text-white text-lg">No messages yet</p>
          <p className="text-gray-400 text-sm mt-1">Tap "Message" on someone's profile or start a group.</p>
        </div>
      ) : activeTab === "business" ? (
        <div className="flex flex-col gap-4">
          {businessItems.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-zinc-800 mx-auto flex items-center justify-center mb-3">
                <Briefcase size={22} className="text-gray-400 dark:text-gray-500" />
              </div>
              <p className="font-bold text-black dark:text-white text-lg">No business messages</p>
              <p className="text-gray-400 dark:text-gray-500 text-sm mt-1 max-w-[260px] mx-auto">
                Sell an item or offer a service on Yuto. When buyers message you, they'll show up here.
              </p>
            </div>
          ) : (
            businessItems.map(({ convo, other, otherId, ctx }) => (
              <button
                key={convo.id}
                type="button"
                onClick={() => navigate(`/messages/${convo.id}`, { state: { otherUserId: otherId } })}
                className="w-full bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-4 shadow-sm flex items-center gap-3 text-left hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
              >
                <UserAvatar name={other?.display_name || "Customer"} avatarUrl={other?.avatar_url || null} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-black dark:text-white truncate">{ctx.listing_title}</p>
                  <p className="text-sm text-gray-400 dark:text-gray-500 truncate">
                    {ctx.listing_kind === "sell" ? "Sell" : "Service"} · {other?.display_name || "Customer"}
                  </p>
                </div>
                {(unreadByConvo[convo.id] || 0) > 0 && (
                  <span className="min-w-6 h-6 px-2 rounded-full bg-red-500 text-white text-xs font-extrabold flex items-center justify-center">
                    {Math.min(99, unreadByConvo[convo.id])}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      ) : user ? (
        filteredThreads.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-gray-400 font-semibold text-sm">
              No matches for "{searchQuery}".
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filteredThreads.map((t) => (
              <ThreadRow
                key={`${t.kind}:${t.id}`}
                thread={t}
                currentUserId={user.id}
                profilesById={profilesById}
              />
            ))}
          </div>
        )
      ) : null}

      {showCompose && user && (
        <ComposeAnywhereSheet
          currentUserId={user.id}
          onClose={() => setShowCompose(false)}
        />
      )}
    </div>
  );
}

