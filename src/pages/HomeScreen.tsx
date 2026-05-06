import { useState, useEffect, useRef, type ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
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
  getSavedPhoneNumber,
} from "../lib/supabase";
import { FunctionPayModal } from "../components/home/FunctionPayModal";
import { FunctionTicketModal } from "../components/home/FunctionTicketModal";
import { YutoBalanceTopUpModal } from "../components/wallet/YutoBalanceTopUpModal";
import { FunctionMessagesModal } from "../components/home/FunctionMessagesModal";
import { PlanMessagesModal } from "../components/home/PlanMessagesModal";
import { HomeComposeSheet } from "../components/home/HomeComposeSheet";
import { FunctionFeedSection } from "../components/home/FunctionFeedSection";
import { PlansFeedSection } from "../components/home/PlansFeedSection";
import { type Plan, type PlanUpdate, type FunctionListing } from "./home/types";
import { MIN_MPESA_TOPUP_KES, computeFunctionTopUpGapKes } from "./home/computeTopUp";
import { getUnreadFunctionMessageCount } from "./home/threadStorage";
import { Send, Users, Globe } from "lucide-react";

export default function HomeScreen() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"public" | "friends">("public");
  const [plans, setPlans] = useState<Plan[]>([]);
  const [functionsFeed, setFunctionsFeed] = useState<FunctionListing[]>([]);
  const [functionUnreadCounts, setFunctionUnreadCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [joiningPlanId, setJoiningPlanId] = useState<string | null>(null);
  const [activePlanChat, setActivePlanChat] = useState<Plan | null>(null);
  // Compose state
  const [showCompose, setShowCompose] = useState(false);
  const [composeMode, setComposeMode] = useState<"plan" | "function" | "sell">("plan");
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
  const [isPosting, setIsPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const planImageInputRef = useRef<HTMLInputElement>(null);
  const functionImageInputRef = useRef<HTMLInputElement>(null);
  const activeTabRef = useRef(activeTab);
  /** Auto-show entry ticket once per function per mount (manual “Ticket” still works). */
  const autoShownTicketFnIdRef = useRef<string | null>(null);

  // Function payment state
  const [functionPayTarget, setFunctionPayTarget] = useState<FunctionListing | null>(null);
  const [showFunctionTopUp, setShowFunctionTopUp] = useState(false);
  const [functionTopUpAmount, setFunctionTopUpAmount] = useState(MIN_MPESA_TOPUP_KES);
  const [pendingJoinFunction, setPendingJoinFunction] = useState<FunctionListing | null>(null);
  const [activeFunctionThread, setActiveFunctionThread] = useState<FunctionListing | null>(null);
  const [functionTicket, setFunctionTicket] = useState<FunctionListing | null>(null);

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
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, activeTab]);

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

  const loadFeed = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const tab = activeTabRef.current;
      const [planData, functionData] = await Promise.all([
        tab === "public" ? getPlansPublic() : getPlansFriends(user.id),
        tab === "public" ? getFunctionsPublic() : Promise.resolve([]),
      ]);
      const planList = (planData as Plan[]) || [];
      const functionList = (functionData as FunctionListing[]) || [];
      setPlans(planList);
      setFunctionsFeed(functionList);
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
      } else {
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
        const fulfillmentLine = sellFulfillment.trim() ? `\n\nFulfillment: ${sellFulfillment.trim()}` : "";
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
      if (autoShownTicketFnIdRef.current !== eventFunction.id) {
        autoShownTicketFnIdRef.current = eventFunction.id;
        setFunctionTicket(eventFunction);
      }
    } catch (err) {
      console.error("Error joining function", err);
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
      <div className="flex items-center gap-3 mb-6">
        <img src={imgYutoMascot} alt="Yuto" className="w-10 h-10 object-contain" />
        <span className="text-2xl font-bold text-black">Home</span>
      </div>

      {/* Tab switcher */}
      <div className="relative flex bg-gray-100 rounded-2xl p-1 mb-6">
        <div
          className="absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white rounded-xl shadow-sm transition-transform duration-300 ease-in-out"
          style={{ transform: activeTab === "public" ? "translateX(0px)" : "translateX(calc(100% + 8px))" }}
        />
        <button
          onClick={() => setActiveTab("public")}
          className={`relative flex-1 py-2 rounded-xl text-sm font-semibold transition-colors duration-200 ${activeTab === "public" ? "text-black" : "text-gray-400"}`}
        >
          <span className="flex items-center justify-center gap-1.5">
            <Globe size={14} /> Public
          </span>
        </button>
        <button
          onClick={() => setActiveTab("friends")}
          className={`relative flex-1 py-2 rounded-xl text-sm font-semibold transition-colors duration-200 ${activeTab === "friends" ? "text-black" : "text-gray-400"}`}
        >
          <span className="flex items-center justify-center gap-1.5">
            <Users size={14} /> Friends
          </span>
        </button>
      </div>

      {activeTab === "public" && (
        <FunctionFeedSection
          functionsFeed={functionsFeed}
          currentUserId={user?.id}
          functionUnreadCounts={functionUnreadCounts}
          onNavigateToHost={(hostId) => navigate(`/user/${hostId}`)}
          onOpenFunctionThread={setActiveFunctionThread}
          onJoinFunction={handleJoinFunction}
          onOpenTicket={(f) => setFunctionTicket(f)}
        />
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
        functionImagePreview={functionImagePreview}
        functionImageInputRef={functionImageInputRef}
        onFunctionImageChange={handleFunctionImageChange}
        onClearFunctionImage={clearFunctionImage}
        postError={postError}
        isPosting={isPosting}
        onPost={handlePost}
      />
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

      {functionTicket && user && (
        <FunctionTicketModal
          functionItem={functionsFeed.find((f) => f.id === functionTicket.id) ?? functionTicket}
          userId={user.id}
          attendeeDisplayName={profile?.display_name?.trim() || profile?.username?.trim() || "Guest"}
          onClose={() => setFunctionTicket(null)}
        />
      )}

      {/* Floating compose button */}
      <button
        onClick={() => setShowCompose(true)}
        className="fixed bottom-24 left-1/2 -translate-x-1/2 px-8 py-3.5 bg-black text-white rounded-full shadow-lg flex items-center gap-2 font-bold text-sm z-40 hover:bg-gray-800 transition-colors"
      >
        <Send size={16} /> Post
      </button>
    </div>
  );
}