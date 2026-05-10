import { useState, useEffect, useRef, type ChangeEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import imgYutoMascot from "../assets/yuto-mascot.webp";
import { useAuth } from "../contexts/AuthContext";
import {
  supabase,
  fetchYutoBalance,
  getPlansPublic,
  getPlansFriends,
  createPlan,
  joinPlan,
  leavePlan,
  yutoItPlan,
  deletePlan,
  addPlanUpdate,
  getPlanUpdates,
  uploadPlanImage,
  getFunctionsPublic,
  createFunction,
  duplicateFunction,
  joinFunction,
  leaveFunction,
  ensureFunctionAttendeeChat,
  getOrCreateDmConversation,
  sendDmMessage,
  sendDmShareMessage,
  upsertDmBusinessContext,
  getSavedPhoneNumber,
  getMyAllUnreadTotal,
  getMyNotificationUnreadCount,
  getFriends,
  createGroup,
  createGroupChat,
  payForFunctionGroup,
  payForFunctionWithLedger,
  createPublicPost,
  getPublicPosts,
  deletePublicPost,
  type PublicPost,
  type DmSharePayload,
  authFetch,
} from "../lib/supabase";
import { ShareRecipientsSheet } from "../components/profile/ShareRecipientsSheet";
import { FunctionTicketModal } from "../components/home/FunctionTicketModal";
import { YutoBalanceTopUpModal } from "../components/wallet/YutoBalanceTopUpModal";
import { FunctionMessagesModal } from "../components/home/FunctionMessagesModal";
import { PlanMessagesModal } from "../components/home/PlanMessagesModal";
import { HomeComposeSheet } from "../components/home/HomeComposeSheet";
import { FunctionFeedSection } from "../components/home/FunctionFeedSection";
import { PlansFeedSection } from "../components/home/PlansFeedSection";
import { PostsFeedSection } from "../components/home/PostsFeedSection";
import { type Plan, type PlanUpdate, type FunctionListing } from "./home/types";
import { MIN_MPESA_TOPUP_KES, computeFunctionTopUpGapKes } from "./home/computeTopUp";
import { Users, Globe, MessageCircle, Bell, Send } from "lucide-react";
import { SegmentedTabsBar } from "../components/ui/SegmentedTabsBar";
import { toast } from "sonner";
import { haptics } from "../lib/haptics";
import { analytics } from "../lib/analytics";
import { usePullToRefresh } from "../hooks/usePullToRefresh";
import { ComposeAnywhereSheet } from "../components/messages/ComposeAnywhereSheet";
import { DevAnnouncementCard, isDevUser } from "../components/home/DevAnnouncementCard";
export default function HomeScreen() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<"public" | "friends">("public");
  const [plans, setPlans] = useState<Plan[]>([]);
  const [functionsFeed, setFunctionsFeed] = useState<FunctionListing[]>([]);
  const [publicPosts, setPublicPosts] = useState<PublicPost[]>([]);
  const [taggedProfilesById, setTaggedProfilesById] = useState<
    Record<string, { id: string; username: string; display_name: string; avatar_url: string | null }>
  >({});
  const [functionUnreadCounts, setFunctionUnreadCounts] = useState<Record<string, number>>({});
  const [dmUnreadTotal, setDmUnreadTotal] = useState(0);
  const [notifUnreadTotal, setNotifUnreadTotal] = useState(0);
  const focusAttemptRef = useRef<"none" | "public" | "friends">("none");
  const [loading, setLoading] = useState(true);
  const [joiningPlanId, setJoiningPlanId] = useState<string | null>(null);
  const [duplicatingFnId, setDuplicatingFnId] = useState<string | null>(null);
  const [activePlanChat, setActivePlanChat] = useState<Plan | null>(null);
  // Compose state
  const [showCompose, setShowCompose] = useState(false);
  const [initialComposeMode, setInitialComposeMode] = useState<string | null>(null);
  const [showComposeAnywhere, setShowComposeAnywhere] = useState(false);
  const [announcementKey, setAnnouncementKey] = useState(0);
  const activeTabRef = useRef(activeTab);
  /** Auto-show entry ticket once per function per mount (manual “Ticket” still works). */
  const autoShownTicketFnIdRef = useRef<string | null>(null);
  const [shareFeedPayload, setShareFeedPayload] = useState<DmSharePayload | null>(null);
  // Function payment state
  // functionPayTarget (direct STK to a function invoice) intentionally removed.
  // Joining a paid function uses Yuto Balance via the same handlers used for
  // splits; if you're short, the top-up modal pops with the missing amount.
  const [showFunctionTopUp, setShowFunctionTopUp] = useState(false);
  const [functionTopUpAmount, setFunctionTopUpAmount] = useState(MIN_MPESA_TOPUP_KES);
  const [pendingJoinFunction, setPendingJoinFunction] = useState<FunctionListing | null>(null);
  const [activeFunctionThread, setActiveFunctionThread] = useState<FunctionListing | null>(null);
  const [functionTicket, setFunctionTicket] = useState<FunctionListing | null>(null);
  const [groupBuyFriends, setGroupBuyFriends] = useState<
    { id: string; username: string; display_name: string; avatar_url: string | null }[]
  >([]);
  const [groupBuySelectedIds, setGroupBuySelectedIds] = useState<string[]>([]);
  const [groupBuyBusy, setGroupBuyBusy] = useState(false);
  const [groupBuyError, setGroupBuyError] = useState("");

  // Plan updates state
  const [planUpdates, setPlanUpdates] = useState<Record<string, PlanUpdate[]>>({});
  const [updateInputs, setUpdateInputs] = useState<Record<string, string>>({});
  const [postingUpdate, setPostingUpdate] = useState<Record<string, boolean>>({});

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    if (!user) return;
    loadFeed();

    // Debounce feed reloads — on busy days, realtime fires constantly
    let reloadTimer: ReturnType<typeof setTimeout> | null = null;
    const debouncedReload = () => {
      if (reloadTimer) clearTimeout(reloadTimer);
      reloadTimer = setTimeout(() => loadFeed(), 1500);
    };

    const channel = supabase
      .channel("feed-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "plans" }, debouncedReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "plan_members" }, debouncedReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "functions" }, debouncedReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "function_members" }, debouncedReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "function_messages" }, debouncedReload)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "dm_messages" }, () => {
        void getMyAllUnreadTotal(user.id).then(setDmUnreadTotal).catch(() => {});
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "group_chat_messages" }, () => {
        void getMyAllUnreadTotal(user.id).then(setDmUnreadTotal).catch(() => {});
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "plan_messages" }, () => {
        void getMyAllUnreadTotal(user.id).then(setDmUnreadTotal).catch(() => {});
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "function_messages" }, () => {
        void getMyAllUnreadTotal(user.id).then(setDmUnreadTotal).catch(() => {});
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); if (reloadTimer) clearTimeout(reloadTimer); };
  }, [user, activeTab]);

  useEffect(() => {
    if (!user) return;
    void getMyAllUnreadTotal(user.id).then(setDmUnreadTotal).catch(() => {});
    void getMyNotificationUnreadCount(user.id).then(setNotifUnreadTotal).catch(() => {});
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const onResume = () => {
      void loadFeed();
      void getMyAllUnreadTotal(user.id).then(setDmUnreadTotal).catch(() => {});
      void getMyNotificationUnreadCount(user.id).then(setNotifUnreadTotal).catch(() => {});
    };
    window.addEventListener("yuto:resume", onResume);
    return () => window.removeEventListener("yuto:resume", onResume);
  }, [user?.id]);

  useEffect(() => {
    const state = location.state as any;
    const focus = state?.focus as { kind?: string; id?: string } | undefined;
    if (!focus?.kind || !focus?.id) return;
    if (state?.forcePublicTab) {
      setActiveTab("public");
    }
    if (focusAttemptRef.current === "none") {
      setActiveTab("public");
      focusAttemptRef.current = "public";
    }
  }, [location.state]);

  // NEW: Listen for the "openCompose" intent from the ComposeAnywhereSheet
  useEffect(() => {
    const state = location.state as { openCompose?: boolean; composeMode?: string } | null;
    if (state?.openCompose) {
      setShowCompose(true);
      if (state.composeMode) {
        setInitialComposeMode(state.composeMode as any);
      }
      // Clear the state from the router history so it doesn't pop open again on back-navigation
      navigate(location.pathname, { replace: true, state: { ...state, openCompose: undefined, composeMode: undefined } });
    }
  }, [location.state, navigate, location.pathname]);

  useEffect(() => {
    const focus = (location.state as any)?.focus as
      | { kind?: string; id?: string; openChat?: boolean }
      | undefined;
    if (!focus?.kind || !focus?.id) return;
    if (loading) return;

    // Inbox deep-link: open the right chat modal directly without scrolling.
    // Plan/function chats live behind feed cards, so the inbox uses this path
    // to send users straight into the conversation they tapped.
    if (focus.openChat) {
      if (focus.kind === "plan") {
        const plan = plans.find((p) => p.id === focus.id);
        if (plan) {
          setActivePlanChat(plan);
          navigate(location.pathname, { replace: true, state: {} });
          focusAttemptRef.current = "none";
          return;
        }
        // Plan not found on the active tab yet — flip to friends once and retry.
        if (focusAttemptRef.current === "public") {
          setActiveTab("friends");
          focusAttemptRef.current = "friends";
        }
        return;
      }
      if (focus.kind === "function") {
        const fn = functionsFeed.find((f) => f.id === focus.id);
        if (fn) {
          setActiveFunctionThread(fn);
          navigate(location.pathname, { replace: true, state: {} });
          focusAttemptRef.current = "none";
          return;
        }
      }
    }

    const elId = focus.kind === "plan" ? `plan-${focus.id}` : `function-${focus.id}`;
    const el = document.getElementById(elId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      navigate(location.pathname, { replace: true, state: {} });
      focusAttemptRef.current = "none";
      return;
    }

    if (focus.kind === "plan" && focusAttemptRef.current === "public") {
      setActiveTab("friends");
      focusAttemptRef.current = "friends";
    }
  }, [loading, plans, functionsFeed, activeTab, location.state, navigate, location.pathname]);

  useEffect(() => {
    // Previously: when functionPayTarget was set, this watched function_members
    // until has_paid flipped, then auto-popped the ticket. With the direct STK
    // modal removed, paid-state is reflected through loadFeed() refreshes
    // triggered by the wallet RPC path, and the ticket is shown by
    // handleJoinFunction directly.
  }, [functionsFeed, user]);

  useEffect(() => {
    setGroupBuyError("");
    setGroupBuySelectedIds([]);
    if (!user || !functionTicket) {
      setGroupBuyFriends([]);
      return;
    }
    const fn = functionsFeed.find((f) => f.id === functionTicket.id) ?? functionTicket;
    const isSell = fn.location === "__SELL__";
    const isService = fn.location === "__SERVICE__";
    const isListing = isSell || isService;
    const me = (fn.function_members ?? []).find((m) => m.user_id === user.id);
    const eligible = !isListing && fn.mode === "pay" && me?.has_paid;
    if (!eligible) {
      setGroupBuyFriends([]);
      return;
    }
    let cancelled = false;
    void getFriends(user.id)
      .then((data) => {
        if (cancelled) return;
        const list = (data as { requester_id: string; addressee?: any; requester?: any }[])
          .map((f) => (f.requester_id === user.id ? f.addressee : f.requester))
          .filter(Boolean) as { id: string; username: string; display_name: string; avatar_url: string | null }[];
        const unpaid = list.filter(
          (p) =>
            // Exclude the host — you can't buy a ticket for the host
            p.id !== fn.host_id &&
            // Exclude friends who already paid
            !(fn.function_members ?? []).some((m) => m.user_id === p.id && m.has_paid),
        );
        setGroupBuyFriends(unpaid);
      })
      .catch(() => {
        if (!cancelled) setGroupBuyFriends([]);
      });
    return () => {
      cancelled = true;
    };
  }, [user, functionTicket, functionsFeed]);

  const loadFeed = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const tab = activeTabRef.current;
      const [planData, functionData, postsData] = await Promise.all([
        tab === "public" ? getPlansPublic() : getPlansFriends(user.id),
        tab === "public" ? getFunctionsPublic() : Promise.resolve([]),
        getPublicPosts(30).catch(() => []),
      ]);
      const planList = (planData as Plan[]) || [];
      const functionList = (functionData as FunctionListing[]) || [];
      setPlans(planList);
      setFunctionsFeed(functionList);
      const posts = postsData as PublicPost[];
      setPublicPosts(posts);

      // Batch resolve tagged_user_ids -> profiles for rendering.
      try {
        const ids = Array.from(
          new Set(
            posts
              .flatMap((p) => (Array.isArray((p as any)?.tag_payload?.tagged_user_ids) ? (p as any).tag_payload.tagged_user_ids : []))
              .filter((x) => typeof x === "string" && x.length > 0),
          ),
        );
        if (ids.length === 0) {
          setTaggedProfilesById({});
        } else {
          const { data: rows, error: pErr } = await supabase
            .from("profiles")
            .select("id, username, display_name, avatar_url")
            .in("id", ids);
          if (!pErr) {
            const map: Record<string, any> = {};
            (rows || []).forEach((r: any) => (map[r.id] = r));
            setTaggedProfilesById(map);
          }
        }
      } catch (e) {
        console.error("tagged profiles:", e);
      }
      const updatesMap: Record<string, PlanUpdate[]> = {};
      if (tab === "public" && functionList.length > 0) {
        // Server-side unread per function card: pull last_read_at from
        // function_reads and count messages newer than that. Same source of
        // truth as the unified inbox so the per-card badge and the inbox
        // never disagree.
        const fnIds = functionList.map((item) => item.id);
        const [messagesRes, readsRes] = await Promise.all([
          supabase
            .from("function_messages")
            .select("function_id, user_id, created_at")
            .in("function_id", fnIds),
          supabase
            .from("function_reads")
            .select("function_id, last_read_at")
            .eq("user_id", user.id)
            .in("function_id", fnIds),
        ]);
        if (messagesRes.error) {
          console.error("loadFeed function unread error:", messagesRes.error);
          setFunctionUnreadCounts({});
        } else {
          const lastReadByFn: Record<string, number> = {};
          ((readsRes.data || []) as any[]).forEach((r) => {
            lastReadByFn[r.function_id] = new Date(r.last_read_at).getTime();
          });
          const counts: Record<string, number> = {};
          ((messagesRes.data || []) as Array<{ function_id: string; user_id: string; created_at: string }>).forEach(
            (m) => {
              if (m.user_id === user.id) return;
              const lastRead = lastReadByFn[m.function_id] ?? 0;
              if (new Date(m.created_at).getTime() > lastRead) {
                counts[m.function_id] = (counts[m.function_id] || 0) + 1;
              }
            },
          );
          setFunctionUnreadCounts(counts);
        }
      } else {
        setFunctionUnreadCounts({});
      }
      await Promise.all(planList.map(async (plan) => {
        try {
          const updates = await getPlanUpdates(plan.id);
          updatesMap[plan.id] = (updates as PlanUpdate[]) || [];
        } catch (err) {
          console.error("loadFeed plan updates error:", err);
        }
      }));
      setPlanUpdates(updatesMap);
    } catch (err) {
      console.error("loadFeed error:", err);
    }
    setLoading(false);
  };

  const refreshFunctionById = async (functionId: string) => {
    try {
      const { data, error } = await supabase
        .from("functions")
        .select(
          `*, host:profiles!functions_host_id_fkey(id, username, display_name, avatar_url), function_members(id, user_id, has_paid, joined_at, paid_at, buyer_confirmed_at, profiles(id, username, display_name, avatar_url))`,
        )
        .eq("id", functionId)
        .single();
      if (error) throw error;
      if (data) {
        setFunctionsFeed((prev) => prev.map((f) => (f.id === functionId ? (data as FunctionListing) : f)));
      }
    } catch (e) {
      console.error(e);
      await loadFeed();
    }
  };

  const loadPlans = loadFeed;

  const handlePostUpdate = async (planId: string) => {
    const content = updateInputs[planId]?.trim();
    if (!content || !user) return;
    setPostingUpdate((prev) => ({ ...prev, [planId]: true }));
    try {
      await addPlanUpdate(planId, user.id, content);
      setUpdateInputs((prev) => ({ ...prev, [planId]: "" }));
      // Notify plan members
      const plan = plans.find((p) => p.id === planId);
      if (plan) {
        const memberIds = (plan.plan_members ?? []).map((m) => m.user_id);
        await Promise.all(memberIds.map((memberId) =>
          authFetch("/api/notify", {
            method: "POST",
            body: JSON.stringify({
              userId: memberId,
              title: "Yuto 📋",
              body: `${profile?.display_name} posted an update: ${content.slice(0, 60)}`,
            }),
          }).catch(() => {})
        ));
      }
      await loadPlans();
    } catch (err) { console.error(err); }
    setPostingUpdate((prev) => ({ ...prev, [planId]: false }));
  };

  const closeCompose = () => setShowCompose(false);

  const handleJoinFunction = async (eventFunction: FunctionListing) => {
    if (!user) return;

    const isSell = eventFunction.location === "__SELL__";
    const isService = eventFunction.location === "__SERVICE__";
    if (isSell || isService) {
      await handleMessageListing(eventFunction);
      return;
    }

    const members = eventFunction.function_members ?? [];
    const isMember = members.some((m) => m.user_id === user.id);
    const cap = eventFunction.max_capacity;
    const isFull = cap != null ? members.length >= cap && !isMember : false;
    if (isFull) {
      toast.error("This function is currently full.");
      haptics.error();
      return;
    }
  
    try {
      if (!isMember) await joinFunction(eventFunction.id, user.id);

      try {
        await payForFunctionWithLedger(eventFunction.id);
      } catch (rpcErr: any) {
        // Insufficient balance / RPC failure: roll back the provisional member
        // row, compute the top-up gap, and pop the top-up modal.
        await supabase.from("function_members").delete()
          .eq("function_id", eventFunction.id).eq("user_id", user.id).eq("has_paid", false);
        const cachedBal = await fetchYutoBalance(user.id);
        const topUp = await computeFunctionTopUpGapKes({
          shareKes: eventFunction.amount_per_person,
          rpcErrorMessage: rpcErr?.message ?? "",
          userId: user.id,
          cachedBalance: cachedBal,
        });
        setFunctionTopUpAmount(topUp);
        setPendingJoinFunction(eventFunction);
        setShowFunctionTopUp(true);
        return;
      }
  
      await refreshFunctionById(eventFunction.id);

      if (autoShownTicketFnIdRef.current !== eventFunction.id) {
        autoShownTicketFnIdRef.current = eventFunction.id;
        setFunctionTicket(eventFunction);
      }
    } catch (err) {
      console.error("Error joining function", err);
    }
  };

  const handleMessageListing = async (eventFunction: FunctionListing) => {
    if (!user) return;
    const isSell = eventFunction.location === "__SELL__";
    const isService = eventFunction.location === "__SERVICE__";
    if (!isSell && !isService) return;
    try {
      const convo = await getOrCreateDmConversation(user.id, eventFunction.host.id);
      await sendDmShareMessage(convo.id, user.id, {
        kind: "listing",
        function_id: eventFunction.id,
        listing_kind: isSell ? "sell" : "service",
      });
      await upsertDmBusinessContext({
        conversation_id: convo.id,
        provider_id: eventFunction.host.id,
        buyer_id: user.id,
        function_id: eventFunction.id,
        listing_kind: isSell ? "sell" : "service",
        listing_title: eventFunction.title,
      });
      navigate(`/messages/${convo.id}`, { state: { otherUserId: eventFunction.host.id } });
      haptics.light();
    } catch (e) {
      console.error(e);
      toast.error("Couldn't open messages.");
    }
  };

  // Host-only: re-run a function next week with the same metadata + media.
  // Optimistic toast → run RPC → reload feed so the duplicate appears at the
  // top of "Hosted now". Rate-limited via a busy state so taps don't spam.
  const handleDuplicateFunction = async (eventFunction: FunctionListing) => {
    if (!user || duplicatingFnId) return;
    if (eventFunction.host_id !== user.id) {
      toast.error("Only the host can run a function again.");
      return;
    }
    setDuplicatingFnId(eventFunction.id);
    haptics.medium();
    try {
      await duplicateFunction(user.id, eventFunction.id, 7);
      toast.success("Duplicated for next week — edit the date if needed.");
      await loadFeed();
    } catch (e: any) {
      console.error("duplicate function:", e);
      toast.error(e?.message || "Couldn't duplicate the function.");
      haptics.error();
    } finally {
      setDuplicatingFnId(null);
    }
  };

  const handleBuyForGroupAndSplit = async () => {
    if (!user || !functionTicket) return;
    const fn = functionsFeed.find((f) => f.id === functionTicket.id) ?? functionTicket;
    const friendIds = groupBuySelectedIds.filter((id) => id !== user.id);
    if (friendIds.length === 0) {
      setGroupBuyError("Pick at least one friend.");
      return;
    }
    setGroupBuyBusy(true);
    setGroupBuyError("");
    try {
      for (const fid of friendIds) {
        await joinFunction(fn.id, fid);
      }
      await payForFunctionGroup(fn.id, friendIds);
      await loadFeed();
      const totalCharged = fn.amount_per_person * (1 + friendIds.length);
      const perPerson = Math.ceil(totalCharged / (1 + friendIds.length));
      const group = await createGroup(`${fn.title} Tickets`, totalCharged, perPerson, user.id, [user.id, ...friendIds], "single");
      try {
        await createGroupChat(user.id, friendIds, `${fn.title} Tickets`, group.id);
      } catch (e) {
        console.error("Group chat after split:", e);
      }

      // Auto-DM each friend their ticket + split context so they don't miss it.
      try {
        await Promise.all(
          friendIds.map(async (fid) => {
            const convo = await getOrCreateDmConversation(user.id, fid);
            await sendDmMessage(
              convo.id,
              user.id,
              `I grabbed your ticket for "${fn.title}". Here's the proof of entry — just pay me back in the split.`,
            );
            await sendDmShareMessage(convo.id, user.id, { kind: "function", function_id: fn.id });
            await sendDmMessage(convo.id, user.id, `Split link: /yuto/${group.id}`);
          }),
        );
      } catch (e) {
        console.error("Auto-DM ticket distribution failed:", e);
      }

      setFunctionTicket(null);
      setGroupBuySelectedIds([]);
      navigate(`/yuto/${group.id}`);
    } catch (e) {
      console.error(e);
      const msg =
        (e as { message?: string })?.message ||
        (e as { error?: { message?: string } })?.error?.message ||
        (e instanceof Error ? e.message : "") ||
        "Couldn’t complete group checkout.";
      setGroupBuyError(msg);
    } finally {
      setGroupBuyBusy(false);
    }
  };

  const openFunctionAttendeeChat = async (f: FunctionListing) => {
    if (!user) return;
    try {
      const gid = await ensureFunctionAttendeeChat(f.id);
      navigate(`/messages/group/${gid}`);
    } catch (e) {
      console.error(e);
      toast.error("Couldn't open the attendee chat yet. Make sure the latest migrations are applied.");
    }
  };

  const handleJoinOrLeavePlan = async (plan: Plan) => {
    if (!user || !profile) return;

    const members = plan.plan_members ?? [];
    const isMember = members.some((m) => m.user_id === user.id);
    const joinerName =
      profile.display_name?.trim() || profile.username?.trim() || "Someone";

    const prevPlansSnapshot = plans;

    setPlans((prev) =>
      prev.map((p) => {
        if (p.id !== plan.id) return p;
        if (isMember) {
          return {
            ...p,
            plan_members: (p.plan_members ?? []).filter((m) => m.user_id !== user.id),
          };
        }
        return {
          ...p,
          plan_members: [
            ...(p.plan_members ?? []),
            {
              id: `optimistic-${Date.now()}`,
              user_id: user.id,
              profiles: {
                id: user.id,
                username: profile.username || "",
                display_name: joinerName,
                avatar_url: profile.avatar_url ?? null,
              },
            },
          ],
        };
      }),
    );

    setJoiningPlanId(plan.id);

    try {
      if (isMember) {
        await leavePlan(plan.id, user.id);
        haptics.light();
      } else {
        await joinPlan(plan.id, user.id, joinerName, plan.creator_id);
        analytics.planJoined({ planId: plan.id, isCreator: plan.creator_id === user.id });
        haptics.medium();
      }
      await loadFeed();
    } catch (error) {
      console.error(isMember ? "Error leaving plan:" : "Error joining plan:", error);
      setPlans(prevPlansSnapshot);
      toast.error(error instanceof Error ? error.message : "Something went wrong. Try again.");
    } finally {
      setJoiningPlanId(null);
    }
  };

  const handleYutoIt = async (plan: Plan) => {
    if (!user) return;
    if (!plan.amount) return;
    const memberIds = [
      plan.creator_id,
      ...(plan.plan_members ?? []).map((m) => m.user_id).filter((id) => id !== plan.creator_id),
    ];
    try {
      analytics.yutoItClicked({
        planId: plan.id,
        memberCount: memberIds.length,
        perPerson: Math.ceil(plan.amount / memberIds.length),
      });
      const group = await yutoItPlan(plan.id, user.id, plan.title, plan.amount, memberIds);
      navigate(`/yuto/${group.id}`);
    } catch (err) { console.error(err); }
  };

  const handleDelete = async (planId: string) => {
    try {
      await deletePlan(planId);
      await loadPlans();
    } catch (err) { console.error(err); }
  };

  const pullRefresh = usePullToRefresh(async () => {
    await loadFeed();
  });

  return (
    <div
      ref={pullRefresh.scrollRef}
      className="flex flex-col overflow-y-auto pb-28 px-5 pt-6 bg-white dark:bg-black text-black dark:text-white transition-colors"
      style={{ touchAction: pullRefresh.pullDistance > 0 ? "none" : "auto" }}
      onTouchStart={pullRefresh.onTouchStart}
      onTouchMove={pullRefresh.onTouchMove}
      onTouchEnd={pullRefresh.onTouchEnd}
    >
      <div
        className="flex items-center justify-center overflow-hidden transition-all duration-300 shrink-0"
        style={{
          height: pullRefresh.pullDistance > 0 ? `${pullRefresh.pullDistance}px` : 0,
          marginTop: pullRefresh.pullDistance > 0 ? `-${Math.min(pullRefresh.pullDistance * 0.3, 16)}px` : 0,
        }}
      >
        <div
          className={`w-8 h-8 rounded-full border-2 border-black/20 border-t-black ${pullRefresh.refreshing ? "animate-spin" : ""}`}
          style={{
            transform: `rotate(${(pullRefresh.pullDistance / 72) * 360}deg)`,
            opacity: Math.min(pullRefresh.pullDistance / 40, 1),
          }}
        />
      </div>
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <img src={imgYutoMascot} alt="Yuto" className="w-10 h-10 object-contain" />
          <span className="text-2xl font-bold text-black dark:text-white">Home</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate("/notifications")}
            className="w-11 h-11 rounded-2xl bg-gray-100 dark:bg-zinc-800 text-black dark:text-white flex items-center justify-center hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors"
            aria-label="Notifications"
            title="Notifications"
          >
            <span className="relative">
              <Bell size={18} />
              {notifUnreadTotal > 0 && (
                <span className="absolute -top-2 -right-2 min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-extrabold flex items-center justify-center shadow-sm">
                  {Math.min(99, notifUnreadTotal)}
                </span>
              )}
            </span>
          </button>
          <button
            type="button"
            onClick={() => navigate("/messages")}
            className="w-11 h-11 rounded-2xl bg-gray-100 dark:bg-zinc-800 text-black dark:text-white flex items-center justify-center hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors"
            aria-label="Messages"
            title="Messages"
          >
            <span className="relative">
              <MessageCircle size={18} />
              {dmUnreadTotal > 0 && (
                <span className="absolute -top-2 -right-2 min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-extrabold flex items-center justify-center shadow-sm">
                  {Math.min(99, dmUnreadTotal)}
                </span>
              )}
            </span>
          </button>
        </div>
      </div>

      {/* Tab switcher (matches Post Something segmented control) */}
      <SegmentedTabsBar
        value={activeTab}
        onChange={setActiveTab}
        tabs={[
          { id: "public", label: "Public", icon: <Globe size={18} /> },
          { id: "friends", label: "Friends", icon: <Users size={18} /> },
        ]}
        className="mb-6"
      />

      {/* Pinned dev announcement */}
      {user && (
        <DevAnnouncementCard
          key={announcementKey}
          currentUserId={user.id}
          onReply={async () => {
            try {
              const { getOrCreateDmConversation: getDm } = await import("../lib/supabase");
              const convo = await getDm(user.id, "f5f5da38-c839-4ce4-94fc-10f3854674e0");
              navigate(`/messages/${convo.id}`, { state: { otherUserId: "f5f5da38-c839-4ce4-94fc-10f3854674e0" } });
            } catch { /* ignore */ }
          }}
        />
      )}

      {activeTab === "public" && (
        <>
          <PostsFeedSection
            posts={publicPosts}
            onNavigateToTag={(tag) => {
              const focus =
                tag.kind === "plan" ? { kind: "plan" as const, id: tag.plan_id } : { kind: "function" as const, id: tag.function_id };
              navigate("/home", { state: { focus } });
            }}
            onNavigateToAuthor={(userId) => {
              if (!userId) return;
              navigate(`/user/${userId}`);
            }}
            taggedFunctionsById={functionsFeed.reduce((acc: Record<string, any>, f: any) => {
              acc[f.id] = f;
              return acc;
            }, {})}
            onNavigateToHost={(hostId) => { if (hostId === "__manage__") navigate("/profile", { state: { openTab: "functions" } }); else navigate(`/user/${hostId}`); }}
            onJoinFunction={handleJoinFunction}
            onOpenTicket={(f) => setFunctionTicket(f)}
            onShareInMessages={user ? (payload) => setShareFeedPayload(payload) : undefined}
            onMessageListing={user ? handleMessageListing : undefined}
            currentUserId={user?.id}
            taggedProfilesById={taggedProfilesById}
            onDeletePost={(postId) => {
              if (!user) return;
              void deletePublicPost(postId).then(loadFeed).catch((e) => {
                console.error(e);
                toast.error("Couldn't delete post.");
              });
            }}
          />

          <FunctionFeedSection
            functionsFeed={functionsFeed}
            loading={loading}
            currentUserId={user?.id}
            functionUnreadCounts={functionUnreadCounts}
            onNavigateToHost={(hostId) => { if (hostId === "__manage__") navigate("/profile", { state: { openTab: "functions" } }); else navigate(`/user/${hostId}`); }}
            onOpenFunctionThread={setActiveFunctionThread}
            onOpenFunctionAttendeeChat={user ? openFunctionAttendeeChat : undefined}
            onJoinFunction={handleJoinFunction}
            onOpenTicket={(f) => setFunctionTicket(f)}
            onShareInMessages={
              user ? (payload) => setShareFeedPayload(payload) : undefined
            }
            onDuplicateFunction={user ? handleDuplicateFunction : undefined}
            onMessageListing={user ? handleMessageListing : undefined}
          />
        </>
      )}

      <PlansFeedSection
        loading={loading}
        plans={plans}
        activeTab={activeTab}
        currentUserId={user?.id}
        joiningPlanId={joiningPlanId}
        onJoinOrLeavePlan={handleJoinOrLeavePlan}
        onDeletePlan={handleDelete}
        onYutoIt={handleYutoIt}
        onOpenPlanChat={setActivePlanChat}
        onNavigateToYutoGroup={(groupId) => navigate(`/yuto/${groupId}`)}
        onNavigateToCreator={(creatorId) => navigate(`/user/${creatorId}`)}
        onInviteFriends={() => navigate("/friends")}
        onSharePlan={
          user ? (plan) => setShareFeedPayload({ kind: "plan", plan_id: plan.id }) : undefined
        }
      />

      <HomeComposeSheet
        open={showCompose}
        onClose={() => { setShowCompose(false); setInitialComposeMode(null); }}
        initialMode={initialComposeMode as any}
        currentUserId={user?.id}
        onSubmitPlan={async (data) => {
          if (!user) return;
          const mediaFiles = Array.isArray(data?.mediaFiles) ? (data.mediaFiles as File[]) : [];
          const created = await createPlan(
            user.id,
            String(data?.title ?? "").trim(),
            data?.amount ? Number(data.amount) : null,
            null,
            null,
            mediaFiles,
          );
          analytics.planCreated({
            planId: (created as any)?.id ?? "unknown",
            amount: data?.amount ? Number(data.amount) : null,
            slots: null,
          });
          await loadFeed();
        }}
        onSubmitFunction={async (data) => {
          if (!user) return;
          const title = String(data?.title ?? "").trim();
          const amountPerPerson = Number(data?.amount_per_person ?? 0);
          const description = (data?.description ?? null) as string | null;
          const dateIso = data?.date ? new Date(String(data.date)).toISOString() : null;
          const location = (data?.location ?? null) as string | null;
          const maxCap = data?.max_capacity != null ? Number(data.max_capacity) : null;
          const mediaFiles = Array.isArray(data?.mediaFiles) ? (data.mediaFiles as File[]) : [];
          await createFunction(
            user.id,
            title,
            description,
            dateIso,
            location,
            amountPerPerson,
            Number.isFinite(maxCap as number) ? (maxCap as number) : null,
            null,
            mediaFiles,
          );
          await loadFeed();
        }}
        onSubmitPost={async (data) => {
          if (!user) return;
          const entity = (() => {
            const t = data.taggedEntity;
            if (!t) return null;
            if (t.kind === "plan") return { kind: "plan", plan_id: t.id };
            if (t.kind === "function") return { kind: "function", function_id: t.id };
            if (t.kind === "sell") return { kind: "listing", function_id: t.id, listing_kind: "sell" };
            if (t.kind === "service") return { kind: "listing", function_id: t.id, listing_kind: "service" };
            return null;
          })();

          const tag_payload = {
            entity,
            tagged_user_ids: data.taggedUserIds,
          };

          await createPublicPost({
            userId: user.id,
            contentText: data.text,
            mediaFiles: data.mediaFiles,
            tagPayload: tag_payload,
          });
          await loadFeed();
        }}
        onSubmitAnnouncement={async (data) => {
          if (!user) return;
          await supabase.from("dev_announcements").update({ active: false }).eq("active", true);
          await supabase.from("dev_announcements").insert({
            content: data.content,
            image_url: data.imageUrl,
            allow_replies: data.allowReplies,
            reply_mode: data.replyMode,
            active: true,
          });
          // Force announcement card to re-fetch
          setAnnouncementKey((k) => k + 1);
        }}
      />

      {/* Floating compose button */}
<div className="fixed bottom-24 left-1/2 -translate-x-1/2 flex items-center gap-3 z-40">
  <button
    onClick={() => setShowCompose(true)}
    className="px-6 py-3.5 bg-black text-white rounded-full shadow-lg flex items-center gap-2 font-bold text-sm hover:bg-gray-800 transition-colors"
  >
    <Send size={16} /> Post
  </button>
  <button
    onClick={() => setShowComposeAnywhere(true)}
    className="w-12 h-12 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-black dark:text-white rounded-full shadow-lg flex items-center justify-center hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors"
    aria-label="Message someone"
    title="Start a conversation"
  >
    <MessageCircle size={18} />
  </button>
</div>

{/* After the other modals: */}
{showComposeAnywhere && user && (
  <ComposeAnywhereSheet
    currentUserId={user.id}
    onClose={() => setShowComposeAnywhere(false)}
  />
)}
      {showFunctionTopUp && user && pendingJoinFunction && (
        <YutoBalanceTopUpModal
          open
          onClose={() => {
            setShowFunctionTopUp(false);
            setPendingJoinFunction(null);
            setFunctionTopUpAmount(MIN_MPESA_TOPUP_KES);
          }}
          userId={user.id}
          mpesaPhoneNumber={profile?.phone_number || getSavedPhoneNumber(user.id) || ""}
          initialAmount={functionTopUpAmount}
          contextLine={
            functionTopUpAmount < pendingJoinFunction.amount_per_person
              ? `Joining costs KSH ${pendingJoinFunction.amount_per_person.toLocaleString()}. You're about KSH ${functionTopUpAmount.toLocaleString()} short — add at least that to continue.`
              : `Joining costs KSH ${pendingJoinFunction.amount_per_person.toLocaleString()}. Add at least KSH ${functionTopUpAmount.toLocaleString()} to your balance to continue.`
          }
          retryCtaLabel="I've paid — try joining again"
          onRetryAfterPaid={async () => {
            await loadFeed();
            const fn = pendingJoinFunction;
            if (!fn) return;
            setShowFunctionTopUp(false);
            setPendingJoinFunction(null);
            setFunctionTopUpAmount(MIN_MPESA_TOPUP_KES);
            await handleJoinFunction(fn);
          }}
        />
      )}

      {/* Function Chat Modal */}
      {activeFunctionThread && user && (
        <FunctionMessagesModal
          functionItem={activeFunctionThread}
          currentUserId={user.id}
          onMessagesRead={(functionId) => setFunctionUnreadCounts((prev) => ({ ...prev, [functionId]: 0 }))}
          onClose={() => setActiveFunctionThread(null)}
        />
      )}

      {/* Plan Chat Modal */}
      {activePlanChat && user && (
        <PlanMessagesModal
          plan={activePlanChat}
          currentUserId={user.id}
          onClose={() => setActivePlanChat(null)}
        />
      )}

      {user && shareFeedPayload && (
        <ShareRecipientsSheet
          open
          onClose={() => setShareFeedPayload(null)}
          currentUserId={user.id}
          sharePayload={shareFeedPayload}
        />
      )}

      {functionTicket && user && (
        <FunctionTicketModal
          functionItem={functionsFeed.find((f) => f.id === functionTicket.id) ?? functionTicket}
          userId={user.id}
          attendeeDisplayName={profile?.display_name?.trim() || profile?.username?.trim() || "Guest"}
          onClose={() => setFunctionTicket(null)}
          showGroupBuy={(() => {
            const fn = functionsFeed.find((f) => f.id === functionTicket.id) ?? functionTicket;
            const isListing = fn.location === "__SELL__" || fn.location === "__SERVICE__";
            const me = (fn.function_members ?? []).find((m) => m.user_id === user.id);
            const isHost = fn.host_id === user.id;
            return !isListing && !isHost && fn.mode === "pay" && !!me?.has_paid;
          })()}
          groupBuyFriends={groupBuyFriends}
          groupBuySelectedIds={groupBuySelectedIds}
          onToggleGroupBuyFriend={(fid) =>
            setGroupBuySelectedIds((prev) => (prev.includes(fid) ? prev.filter((x) => x !== fid) : [...prev, fid]))
          }
          onBuyForGroupAndSplit={() => void handleBuyForGroupAndSplit()}
          groupBuyBusy={groupBuyBusy}
          groupBuyError={groupBuyError}
        />
      )}

    </div>
  );
}
