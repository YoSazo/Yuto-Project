import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import imgYutoMascot from "figma:asset/28c11cb437762e8469db46974f467144b8299a8c.png";
import { useAuth } from "../contexts/AuthContext";
import { supabase, getPlansPublic, getPlansFriends, createPlan, joinPlan, leavePlan, yutoItPlan, deletePlan, addPlanUpdate, getPlanUpdates } from "../lib/supabase";
import UserAvatar from "../components/UserAvatar";
import { Trash2, ClipboardList, Rocket, UserCheck, Send, Users, Globe } from "lucide-react";

interface PlanMember {
  id: string;
  user_id: string;
  profiles: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
  };
}

interface PlanUpdate {
  id: string;
  content: string;
  created_at: string;
  creator_id: string;
  profiles: {
    display_name: string;
    avatar_url: string | null;
  };
}

interface Plan {
  id: string;
  creator_id: string;
  title: string;
  amount: number | null;
  slots: number | null;
  created_at: string;
  status: string;
  creator: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
  };
  plan_members: PlanMember[];
}

export default function HomeScreen() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"public" | "friends">("public");
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  // Compose state
  const [showCompose, setShowCompose] = useState(false);
  const [planTitle, setPlanTitle] = useState("");
  const [planAmount, setPlanAmount] = useState("");
  const [planSlots, setPlanSlots] = useState("");
  const [isPosting, setIsPosting] = useState(false);

  // Plan updates state
  const [planUpdates, setPlanUpdates] = useState<Record<string, PlanUpdate[]>>({});
  const [updateInputs, setUpdateInputs] = useState<Record<string, string>>({});
  const [postingUpdate, setPostingUpdate] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!user) return;
    loadPlans();

    const channel = supabase
      .channel("plans-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "plans" }, () => loadPlans())
      .on("postgres_changes", { event: "*", schema: "public", table: "plan_members" }, () => loadPlans())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, activeTab]);

  const loadPlans = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = activeTab === "public"
        ? await getPlansPublic()
        : await getPlansFriends(user.id);
      const planList = (data as Plan[]) || [];
      setPlans(planList);
      const updatesMap: Record<string, PlanUpdate[]> = {};
      await Promise.all(planList.map(async (plan) => {
        try {
          const updates = await getPlanUpdates(plan.id);
          updatesMap[plan.id] = (updates as PlanUpdate[]) || [];
        } catch { /* ignore */ }
      }));
      setPlanUpdates(updatesMap);
    } catch { /* ignore */ }
    setLoading(false);
  };

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
        const memberIds = plan.plan_members.map((m) => m.user_id);
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

  const handlePost = async () => {
    if (!planTitle.trim() || !user) return;
    setIsPosting(true);
    try {
      await createPlan(
        user.id,
        planTitle.trim(),
        planAmount ? parseInt(planAmount) : null,
        planSlots ? parseInt(planSlots) : null
      );
      setPlanTitle(""); setPlanAmount(""); setPlanSlots("");
      setShowCompose(false);
      await loadPlans();
    } catch (err) {
      console.error(err);
    }
    setIsPosting(false);
  };

  const handleJoin = async (plan: Plan) => {
    if (!user) return;
    const isMember = plan.plan_members.some((m) => m.user_id === user.id);
    try {
      if (isMember) {
        await leavePlan(plan.id, user.id);
      } else {
        await joinPlan(plan.id, user.id, profile?.display_name || "Someone", plan.creator_id);
      }
      await loadPlans();
    } catch (err) { console.error(err); }
  };

  const handleYutoIt = async (plan: Plan) => {
    if (!user) return;
    if (!plan.amount) return;
    const memberIds = [plan.creator_id, ...plan.plan_members.map((m) => m.user_id).filter((id) => id !== plan.creator_id)];
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
    <div className="flex flex-col min-h-full overflow-y-auto pb-36 px-5 pt-6">
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

      {/* Plans board — same for both tabs */}
        <>
          {/* Plans board */}
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin" />
            </div>
          ) : plans.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <ClipboardList size={48} className="text-gray-300 mb-3" />
              <p className="font-bold text-black text-lg">
                {activeTab === "public" ? "No plans yet" : "No plans from friends yet"}
              </p>
              <p className="text-gray-400 text-sm mt-1">
                {activeTab === "public" ? "Be the first to post one!" : "Add friends to see their plans here"}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {plans.map((plan) => {
                const isMine = plan.creator_id === user?.id;
                const isMember = plan.plan_members.some((m) => m.user_id === user?.id);
                const joinedCount = plan.plan_members.length;
                const slotsLeft = plan.slots ? plan.slots - joinedCount : null;
                const allIn = plan.slots ? joinedCount >= plan.slots : false;
                const canYutoIt = isMine && plan.amount && plan.plan_members.length > 0;

                return (
                  <div key={plan.id}>
                  <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                    {/* Creator */}
                    <div className="flex items-center gap-2 mb-3">
                      <UserAvatar name={plan.creator.display_name} avatarUrl={plan.creator.avatar_url} size="sm" />
                      <div className="flex-1">
                        <p className="font-semibold text-sm text-black">{plan.creator.display_name}</p>
                        <p className="text-xs text-gray-400">{new Date(plan.created_at).toLocaleDateString("en-KE", { weekday: "short", month: "short", day: "numeric" })}</p>
                      </div>
                      {isMine && (
                        <button onClick={() => handleDelete(plan.id)} className="text-gray-300 hover:text-red-400 transition-colors"><Trash2 size={16} /></button>
                      )}
                    </div>

                    {/* Title */}
                    <p className="font-bold text-black text-lg mb-2">{plan.title}</p>

                    {/* Amount + slots */}
                    <div className="flex items-center gap-3 mb-3 flex-wrap">
                      {plan.amount && (
                        <span className="bg-green-50 text-green-700 font-bold text-sm px-3 py-1 rounded-full">
                          KSH {plan.amount.toLocaleString()}
                        </span>
                      )}
                      {plan.slots && (
                        <span className={`font-bold text-sm px-3 py-1 rounded-full ${allIn ? "bg-red-50 text-red-500" : "bg-gray-100 text-gray-600"}`}>
                          {allIn ? "Full 🔒" : `${slotsLeft} spot${slotsLeft === 1 ? "" : "s"} left`}
                        </span>
                      )}
                    </div>

                    {/* Members */}
                    {plan.plan_members.length > 0 && (
                      <div className="flex items-center gap-1 mb-3">
                        {plan.plan_members.slice(0, 5).map((m) => (
                          <UserAvatar key={m.id} name={m.profiles.display_name} avatarUrl={m.profiles.avatar_url} size="sm" className="-ml-1 first:ml-0 border-2 border-white" />
                        ))}
                        {plan.plan_members.length > 5 && (
                          <span className="text-xs text-gray-400 ml-1">+{plan.plan_members.length - 5} more</span>
                        )}
                        <span className="text-xs text-gray-400 ml-1">{joinedCount} {joinedCount === 1 ? "person" : "people"} in</span>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2">
                      {!isMine && !allIn && (
                        <button
                          onClick={() => handleJoin(plan)}
                          className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all ${isMember ? "bg-gray-100 text-gray-600" : "bg-black text-white"}`}
                        >
                          {isMember ? "Leave" : <span className="flex items-center justify-center gap-1.5"><UserCheck size={15} /> I'm in</span>}
                        </button>
                      )}
                      {canYutoIt && (
                        <button
                          onClick={() => handleYutoIt(plan)}
                          className="flex-1 py-2.5 bg-green-500 text-white rounded-xl font-bold text-sm hover:bg-green-600 transition-colors"
                        >
                          <span className="flex items-center justify-center gap-1.5"><Rocket size={15} /> Yuto it!</span>
                        </button>
                      )}
                    </div>
                  </div>
                  {/* Thread updates */}
                  {((planUpdates[plan.id] || []).length > 0 || isMine) && (
                    <div className="ml-4 mt-1">
                      {(planUpdates[plan.id] || []).map((update) => (
                        <div key={update.id} className="flex items-start gap-2 mt-2 pl-2">
                          <div className="flex items-start gap-2 flex-1 pb-2">
                            <UserAvatar name={update.profiles.display_name} avatarUrl={update.profiles.avatar_url} size="sm" className="!w-7 !h-7 flex-shrink-0 mt-0.5" />
                            <div className="flex-1 bg-gray-50 rounded-2xl rounded-tl-sm px-3 py-2">
                              <p className="text-sm text-black">{update.content}</p>
                              <p className="text-[10px] text-gray-400 mt-0.5">{new Date(update.created_at).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" })}</p>
                            </div>
                          </div>
                        </div>
                      ))}

                      {/* Update input — creator only */}
                      {isMine && (
                        <div className="flex gap-2 mt-2">
                          <div className="flex flex-col items-center w-5 flex-shrink-0">
                            <div className="w-px bg-gray-200 h-3" />
                          </div>
                          <div className="flex-1 flex gap-2 items-center pb-2">
                            <UserAvatar name={profile?.display_name || ""} avatarUrl={profile?.avatar_url} size="sm" className="!w-7 !h-7 flex-shrink-0" />
                            <input
                              type="text"
                              value={updateInputs[plan.id] || ""}
                              onChange={(e) => setUpdateInputs((prev) => ({ ...prev, [plan.id]: e.target.value }))}
                              onKeyDown={(e) => e.key === "Enter" && handlePostUpdate(plan.id)}
                              placeholder="Add an update..."
                              className="flex-1 bg-gray-50 border border-gray-200 rounded-full px-3 py-1.5 text-sm focus:outline-none focus:border-black transition-colors"
                              maxLength={200}
                            />
                            {updateInputs[plan.id]?.trim() && (
                              <button
                                onClick={() => handlePostUpdate(plan.id)}
                                disabled={postingUpdate[plan.id]}
                                className="w-8 h-8 bg-black text-white rounded-full flex items-center justify-center text-sm flex-shrink-0"
                              >
                                ↑
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  </div>
              );
            })}
          </div>
        )}
        </>

      {/* Compose sheet */}
      {showCompose && (
        <div className="fixed inset-0 z-50 flex items-end">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowCompose(false)} />
          <div className="relative w-full bg-white rounded-t-3xl px-5 pt-5 pb-10 z-10">
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
            <p className="font-bold text-xl text-black mb-4">Post a Plan</p>

            <textarea
              value={planTitle}
              onChange={(e) => setPlanTitle(e.target.value)}
              placeholder="Bowling Saturday? Who's in 🎳"
              className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-base resize-none h-24 focus:outline-none focus:border-black transition-colors mb-3"
              maxLength={200}
            />

            <div className="flex gap-3 mb-4">
              <div className="flex-1">
                <p className="text-xs text-gray-400 mb-1 font-semibold">Amount (KSH)</p>
                <input
                  type="number"
                  value={planAmount}
                  onChange={(e) => setPlanAmount(e.target.value)}
                  placeholder="e.g. 500"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-black transition-colors"
                />
              </div>
              <div className="flex-1">
                <p className="text-xs text-gray-400 mb-1 font-semibold">Slots</p>
                <input
                  type="number"
                  value={planSlots}
                  onChange={(e) => setPlanSlots(e.target.value)}
                  placeholder="e.g. 5"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-black transition-colors"
                />
              </div>
            </div>

            <button
              onClick={handlePost}
              disabled={!planTitle.trim() || isPosting}
              className="w-full py-4 bg-black text-white rounded-2xl font-bold text-base disabled:opacity-40 transition-opacity"
            >
              {isPosting ? "Posting..." : <span className="flex items-center justify-center gap-2"><Send size={16} /> Post Plan</span>}
            </button>
          </div>
        </div>
      )}

      {/* Floating compose button */}
      <button
          onClick={() => setShowCompose(true)}
          className="fixed bottom-36 left-1/2 -translate-x-1/2 px-8 py-3.5 bg-black text-white rounded-full shadow-lg flex items-center gap-2 font-bold text-sm z-40 hover:bg-gray-800 transition-colors"
        >
          <Send size={16} /> Post a Plan
        </button>
    </div>
  );
}
