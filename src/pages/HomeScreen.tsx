import { useState, useEffect, useRef, type ChangeEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import imgYutoMascot from "figma:asset/28c11cb437762e8469db46974f467144b8299a8c.png";
import { useAuth } from "../contexts/AuthContext";
import {
  supabase,
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
  joinFunction,
  leaveFunction,
  ensureFunctionAttendeeChat,
  getOrCreateDmConversation,
  sendDmMessage,
  sendDmShareMessage,
  upsertDmBusinessContext,
  getSavedPhoneNumber,
  getMyDmAndGroupUnreadTotal,
  getFriends,
  createGroup,
  createGroupChat,
  payForFunctionGroup,
  createPublicPost,
  getPublicPosts,
  type PublicPost,
  type PublicPostTagPayload,
  type DmSharePayload,
} from "../lib/supabase";
import { ShareRecipientsSheet } from "../components/profile/ShareRecipientsSheet";
import { FunctionPayModal } from "../components/home/FunctionPayModal";
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
import { getUnreadFunctionMessageCount } from "./home/threadStorage";
import { Users, Globe, MessageCircle, Send } from "lucide-react";
import { SegmentedTabsBar } from "../components/ui/SegmentedTabsBar";

export default function HomeScreen() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<"public" | "friends">("public");
  const [plans, setPlans] = useState<Plan[]>([]);
  const [functionsFeed, setFunctionsFeed] = useState<FunctionListing[]>([]);
  const [publicPosts, setPublicPosts] = useState<PublicPost[]>([]);
  const [functionUnreadCounts, setFunctionUnreadCounts] = useState<Record<string, number>>({});
  const [dmUnreadTotal, setDmUnreadTotal] = useState(0);
  const focusAttemptRef = useRef<"none" | "public" | "friends">("none");
  const [loading, setLoading] = useState(true);
  const [joiningPlanId, setJoiningPlanId] = useState<string | null>(null);
  const [activePlanChat, setActivePlanChat] = useState<Plan | null>(null);
  // Compose state
  const [showCompose, setShowCompose] = useState(false);
  const [composeMode, setComposeMode] = useState<"plan" | "function" | "sell" | "service">("plan");
  const [planTitle, setPlanTitle] = useState("");
  const [planAmount, setPlanAmount] = useState("");
  const [planSlots, setPlanSlots] = useState("");
  const [planImageFile, setPlanImageFile] = useState<File | null>(null);
  const [planImagePreview, setPlanImagePreview] = useState<string | null>(null);
  const [functionImageFile, setFunctionImageFile] = useState<File | null>(null);
  const [functionImagePreview, setFunctionImagePreview] = useState<string | null>(null);
  const [functionTitle, setFunctionTitle] = useState("");
  const [functionDescription, setFunctionDescription] = useState("");
  const [functionDate, setFunctionDate] = useState("");
  const [functionLocation, setFunctionLocation] = useState("");
  const [functionAmount, setFunctionAmount] = useState("");
  const [functionCapacity, setFunctionCapacity] = useState("");
  const [sellFulfillment, setSellFulfillment] = useState("");
  const [serviceFulfillment, setServiceFulfillment] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const planImageInputRef = useRef<HTMLInputElement>(null);
  const functionImageInputRef = useRef<HTMLInputElement>(null);
  const activeTabRef = useRef(activeTab);
  /** Auto-show entry ticket once per function per mount (manual “Ticket” still works). */
  const autoShownTicketFnIdRef = useRef<string | null>(null);
  const [shareFeedPayload, setShareFeedPayload] = useState<DmSharePayload | null>(null);

  // Function payment state
  const [functionPayTarget, setFunctionPayTarget] = useState<FunctionListing | null>(null);
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

    const channel = supabase
      .channel("feed-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "plans" }, () => loadFeed())
      .on("postgres_changes", { event: "*", schema: "public", table: "plan_members" }, () => loadFeed())
      .on("postgres_changes", { event: "*", schema: "public", table: "functions" }, () => loadFeed())
      .on("postgres_changes", { event: "*", schema: "public", table: "function_members" }, () => loadFeed())
      .on("postgres_changes", { event: "*", schema: "public", table: "function_messages" }, () => loadFeed())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "dm_messages" }, () => {
        void getMyDmAndGroupUnreadTotal(user.id).then(setDmUnreadTotal).catch(() => {});
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "group_chat_messages" }, () => {
        void getMyDmAndGroupUnreadTotal(user.id).then(setDmUnreadTotal).catch(() => {});
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, activeTab]);

  useEffect(() => {
    if (!user) return;
    void getMyDmAndGroupUnreadTotal(user.id).then(setDmUnreadTotal).catch(() => {});
  }, [user]);

  useEffect(() => {
    const focus = (location.state as any)?.focus as { kind?: string; id?: string } | undefined;
    if (!focus?.kind || !focus?.id) return;
    if (focusAttemptRef.current === "none") {
      // Start by ensuring public tab is active (functions are public; plans might be public too).
      setActiveTab("public");
      focusAttemptRef.current = "public";
    }
  }, [location.state]);

  useEffect(() => {
    const focus = (location.state as any)?.focus as { kind?: string; id?: string } | undefined;
    if (!focus?.kind || !focus?.id) return;
    if (loading) return;

    const elId = focus.kind === "plan" ? `plan-${focus.id}` : `function-${focus.id}`;
    const el = document.getElementById(elId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      // Clear state so it doesn't keep jumping on re-renders.
      navigate(location.pathname, { replace: true, state: {} });
      focusAttemptRef.current = "none";
      return;
    }

    // If it was a plan and not found on public, try friends once.
    if (focus.kind === "plan" && focusAttemptRef.current === "public") {
      setActiveTab("friends");
      focusAttemptRef.current = "friends";
    }
  }, [loading, plans.length, functionsFeed.length, activeTab, location.state, navigate, location.pathname]);

  useEffect(() => {
    if (!user || !functionPayTarget) return;
    const refreshed = functionsFeed.find((f) => f.id === functionPayTarget.id);
    const hasPaid = refreshed?.function_members?.some((m) => m.user_id === user.id && m.has_paid);
    if (hasPaid) {
      if (autoShownTicketFnIdRef.current !== functionPayTarget.id) {
        autoShownTicketFnIdRef.current = functionPayTarget.id;
        setFunctionTicket(refreshed ?? functionPayTarget);
      }
      setFunctionPayTarget(null);
    }
  }, [functionsFeed, functionPayTarget, user]);

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
          (p) => !(fn.function_members ?? []).some((m) => m.user_id === p.id && m.has_paid),
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
      setPublicPosts(postsData as PublicPost[]);
      const updatesMap: Record<string, PlanUpdate[]> = {};
      if (tab === "public" && functionList.length > 0) {
        const { data: messageRows, error: messageError } = await supabase
          .from("function_messages")
          .select("function_id, user_id, created_at")
          .in("function_id", functionList.map((item) => item.id));
        if (messageError) {
          console.error("loadFeed function unread error:", messageError);
          setFunctionUnreadCounts({});
        } else {
          const counts: Record<string, number> = {};
          const groupedMessages = (messageRows || []) as Array<{ function_id: string; user_id: string; created_at: string }>;
          for (const functionItem of functionList) {
            counts[functionItem.id] = getUnreadFunctionMessageCount(user.id, functionItem.id, groupedMessages.filter((message) => message.function_id === functionItem.id));
          }
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
          fetch("/api/notify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
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

  const handlePlanImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    setPlanImageFile(file);
    const url = URL.createObjectURL(file);
    setPlanImagePreview(url);
  };

  const handleFunctionImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    setFunctionImageFile(file);
    const url = URL.createObjectURL(file);
    setFunctionImagePreview(url);
  };

  const clearPlanImage = () => {
    setPlanImageFile(null);
    if (planImagePreview) URL.revokeObjectURL(planImagePreview);
    setPlanImagePreview(null);
    planImageInputRef.current?.focus();
  };

  const clearFunctionImage = () => {
    setFunctionImageFile(null);
    if (functionImagePreview) URL.revokeObjectURL(functionImagePreview);
    setFunctionImagePreview(null);
  };

  const resetCompose = () => {
    setShowCompose(false);
    setPostError(null);
    setComposeMode("plan");
    setPlanTitle("");
    setPlanAmount("");
    setPlanSlots("");
    clearPlanImage();
    clearFunctionImage();
    setFunctionTitle("");
    setFunctionDescription("");
    setFunctionDate("");
    setFunctionLocation("");
    setFunctionAmount("");
    setFunctionCapacity("");
    setSellFulfillment("");
    setServiceFulfillment("");
  };

  const handlePost = async () => {
    if (!user) return;
    if (composeMode === "plan" && !planTitle.trim()) return;
    if ((composeMode === "function" || composeMode === "sell") && (!functionTitle.trim() || !functionAmount.trim())) return;
    setIsPosting(true);
    setPostError(null);
    try {
      if (composeMode === "plan") {
        let imageUrl: string | null = null;
        if (planImageFile) {
          try {
            imageUrl = await uploadPlanImage(user.id, planImageFile);
          } catch (uploadErr) {
            console.error("Image upload failed:", uploadErr);
            setPostError("Couldn't upload image — posting without it.");
            imageUrl = null;
          }
        }
        await createPlan(
          user.id,
          planTitle.trim(),
          planAmount ? parseInt(planAmount) : null,
          planSlots ? parseInt(planSlots) : null,
          imageUrl
        );
      } else if (composeMode === "function") {
        let imageUrl: string | null = null;
        if (functionImageFile) {
          try {
            imageUrl = await uploadPlanImage(user.id, functionImageFile);
          } catch (uploadErr) {
            console.error("Function image upload failed:", uploadErr);
            setPostError("Couldn't upload function photo — posting without it.");
            imageUrl = null;
          }
        }
        await createFunction(
          user.id,
          functionTitle.trim(),
          functionDescription.trim() || null,
          functionDate ? new Date(functionDate).toISOString() : null,
          functionLocation.trim() || null,
          parseInt(functionAmount),
          functionCapacity ? parseInt(functionCapacity) : null,
          imageUrl,
        );
      } else if (composeMode === "sell") {
        // Sell: stored in the existing functions table, but marked via a sentinel location value.
        let imageUrl: string | null = null;
        if (functionImageFile) {
          try {
            imageUrl = await uploadPlanImage(user.id, functionImageFile);
          } catch (uploadErr) {
            console.error("Sell image upload failed:", uploadErr);
            setPostError("Couldn't upload photo — posting without it.");
            imageUrl = null;
          }
        }
        const fulfillmentLine = "";
        await createFunction(
          user.id,
          functionTitle.trim(),
          ((functionDescription.trim() || "") + fulfillmentLine).trim() || null,
          null,
          "__SELL__",
          parseInt(functionAmount),
          functionCapacity ? parseInt(functionCapacity) : null,
          imageUrl,
        );
      } else {
        // Service: stored in the existing functions table, but marked via a sentinel location value.
        let imageUrl: string | null = null;
        if (functionImageFile) {
          try {
            imageUrl = await uploadPlanImage(user.id, functionImageFile);
          } catch (uploadErr) {
            console.error("Service image upload failed:", uploadErr);
            setPostError("Couldn't upload photo — posting without it.");
            imageUrl = null;
          }
        }
        const fulfillmentLine = "";
        await createFunction(
          user.id,
          functionTitle.trim(),
          ((functionDescription.trim() || "") + fulfillmentLine).trim() || null,
          null,
          "__SERVICE__",
          parseInt(functionAmount),
          functionCapacity ? parseInt(functionCapacity) : null,
          imageUrl,
        );
      }
      resetCompose();
      await loadFeed();
    } catch (err) {
      console.error(err);
      let msg: string =
        (err as { message?: string })?.message ||
        (err as { error?: { message?: string } })?.error?.message ||
        (err instanceof Error ? err.message : null) ||
        (typeof err === "string" ? err : null) ||
        "";
      if (!msg || msg === "[object Object]") msg = "Failed to post plan. Try again.";
      setPostError(msg);
    }
    setIsPosting(false);
  };

  const handlePublicPostSubmit = async (input: {
    contentText: string;
    mediaFile: File | null;
    tagPayload: PublicPostTagPayload | null;
  }) => {
    if (!user) return;
    try {
      await createPublicPost({
        userId: user.id,
        contentText: input.contentText,
        mediaFile: input.mediaFile,
        tagPayload: input.tagPayload,
      });
      await loadFeed();
    } catch (err) {
      console.error(err);
      setPostError(err instanceof Error ? err.message : "Failed to post.");
      throw err;
    }
  };

  const handleJoinFunction = async (eventFunction: FunctionListing) => {
    if (!user) return;
    const members = eventFunction.function_members ?? [];
    const isMember = members.some((m) => m.user_id === user.id);
    const cap = eventFunction.max_capacity;
    const isFull = cap != null ? members.length >= cap && !isMember : false;
    if (isFull) { alert("This function is currently full!"); return; }
  
    try {
      if (!isMember) await joinFunction(eventFunction.id, user.id);
  
      const { error } = await supabase.rpc("pay_for_function", { p_function_id: eventFunction.id });
  
      if (error) {
        // ✅ Roll back provisional member row, compute top-up gap (not always full ticket price)
        await supabase.from("function_members").delete()
          .eq("function_id", eventFunction.id).eq("user_id", user.id).eq("has_paid", false);
        const topUp = await computeFunctionTopUpGapKes({
          shareKes: eventFunction.amount_per_person,
          rpcErrorMessage: error.message,
          userId: user.id,
        });
        setFunctionTopUpAmount(topUp);
        setPendingJoinFunction(eventFunction);
        setShowFunctionTopUp(true);
        return;
      }
  
      await loadFeed();

      // Sell/Service: after a successful pay, jump into a DM with the provider.
      const isSell = eventFunction.location === "__SELL__";
      const isService = eventFunction.location === "__SERVICE__";
      if (isSell || isService) {
        try {
          const convo = await getOrCreateDmConversation(user.id, eventFunction.host.id);
          const kindLabel = isSell ? "Sell" : "Service";
          const verb = isSell ? "bought" : "booked";
          await sendDmMessage(convo.id, user.id, `Hey! I just ${verb} “${eventFunction.title}”.`);
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
        } catch (e) {
          console.error(e);
        }
      }

      if (autoShownTicketFnIdRef.current !== eventFunction.id) {
        autoShownTicketFnIdRef.current = eventFunction.id;
        setFunctionTicket(eventFunction);
      }
    } catch (err) {
      console.error("Error joining function", err);
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
        await createGroupChat(user.id, friendIds, `${fn.title} Tickets`);
      } catch (e) {
        console.error("Group chat after split:", e);
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
      alert("Couldn't open the attendee chat yet. Make sure the latest migrations are applied.");
    }
  };

  const refreshFunctionPaymentStatus = async () => {
    await loadFeed();
  };

  const handleJoinOrLeavePlan = async (plan: Plan) => {
    if (!user || !profile) return;

    const members = plan.plan_members ?? [];
    const isMember = members.some((m) => m.user_id === user.id);
    const joinerName =
      profile.display_name?.trim() || profile.username?.trim() || "Someone";

    setJoiningPlanId(plan.id);

    try {
      if (isMember) {
        await leavePlan(plan.id, user.id);
      } else {
        await joinPlan(plan.id, user.id, joinerName, plan.creator_id);
      }
      await loadFeed();
    } catch (error) {
      console.error(isMember ? "Error leaving plan:" : "Error joining plan:", error);
      alert(error instanceof Error ? error.message : "Something went wrong. Try again.");
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

  return (
    <div className="flex flex-col overflow-y-auto pb-28 px-5 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <img src={imgYutoMascot} alt="Yuto" className="w-10 h-10 object-contain" />
          <span className="text-2xl font-bold text-black">Home</span>
        </div>
        <button
          type="button"
          onClick={() => navigate("/messages")}
          className="w-11 h-11 rounded-2xl bg-gray-100 text-black flex items-center justify-center hover:bg-gray-200 transition-colors"
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

      {activeTab === "public" && (
        <>
          <PostsFeedSection
            posts={publicPosts}
            onNavigateToTag={(tag) => {
              const focus =
                tag.kind === "plan" ? { kind: "plan" as const, id: tag.plan_id } : { kind: "function" as const, id: tag.function_id };
              navigate("/home", { state: { focus } });
            }}
          />

          <FunctionFeedSection
            functionsFeed={functionsFeed}
            currentUserId={user?.id}
            functionUnreadCounts={functionUnreadCounts}
            onNavigateToHost={(hostId) => navigate(`/user/${hostId}`)}
            onOpenFunctionThread={setActiveFunctionThread}
            onOpenFunctionAttendeeChat={user ? openFunctionAttendeeChat : undefined}
            onJoinFunction={handleJoinFunction}
            onOpenTicket={(f) => setFunctionTicket(f)}
            onShareInMessages={
              user ? (payload) => setShareFeedPayload(payload) : undefined
            }
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
        onSharePlan={
          user ? (plan) => setShareFeedPayload({ kind: "plan", plan_id: plan.id }) : undefined
        }
      />

      <HomeComposeSheet
        open={showCompose}
        onDismiss={resetCompose}
        composeMode={composeMode}
        onComposeModeChange={setComposeMode}
        planTitle={planTitle}
        onPlanTitleChange={setPlanTitle}
        planAmount={planAmount}
        onPlanAmountChange={setPlanAmount}
        planSlots={planSlots}
        onPlanSlotsChange={setPlanSlots}
        planImagePreview={planImagePreview}
        planImageInputRef={planImageInputRef}
        onPlanImageChange={handlePlanImageChange}
        onClearPlanImage={clearPlanImage}
        functionTitle={functionTitle}
        onFunctionTitleChange={setFunctionTitle}
        functionDescription={functionDescription}
        onFunctionDescriptionChange={setFunctionDescription}
        functionDate={functionDate}
        onFunctionDateChange={setFunctionDate}
        functionLocation={functionLocation}
        onFunctionLocationChange={setFunctionLocation}
        functionAmount={functionAmount}
        onFunctionAmountChange={setFunctionAmount}
        functionCapacity={functionCapacity}
        onFunctionCapacityChange={setFunctionCapacity}
        sellFulfillment={sellFulfillment}
        onSellFulfillmentChange={setSellFulfillment}
        serviceFulfillment={serviceFulfillment}
        onServiceFulfillmentChange={setServiceFulfillment}
        functionImagePreview={functionImagePreview}
        functionImageInputRef={functionImageInputRef}
        onFunctionImageChange={handleFunctionImageChange}
        onClearFunctionImage={clearFunctionImage}
        postError={postError}
        isPosting={isPosting}
        onPost={handlePost}
        onSubmitPublicPost={handlePublicPostSubmit}
      />

      {/* Floating compose button */}
      <button
        onClick={() => setShowCompose(true)}
        className="fixed bottom-24 left-1/2 -translate-x-1/2 px-8 py-3.5 bg-black text-white rounded-full shadow-lg flex items-center gap-2 font-bold text-sm z-40 hover:bg-gray-800 transition-colors"
      >
        <Send size={16} /> Post
      </button>
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

      {/* Function Payment Modal */}
      {functionPayTarget && user && (
        <FunctionPayModal
          amount={functionPayTarget.amount_per_person}
          functionId={functionPayTarget.id}
          userId={user.id}
          defaultPhoneNumber={profile?.phone_number || getSavedPhoneNumber(user.id) || undefined}
          onClose={() => setFunctionPayTarget(null)}
          onRefreshStatus={refreshFunctionPaymentStatus}
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
            return !isListing && fn.mode === "pay" && !!me?.has_paid;
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