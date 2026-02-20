import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import imgYutoMascot from "figma:asset/28c11cb437762e8469db46974f467144b8299a8c.png";
import { useAuth } from "../contexts/AuthContext";
import { supabase, getPlans, createPlan, joinPlan, leavePlan, yutoItPlan, deletePlan } from "../lib/supabase";
import UserAvatar from "../components/UserAvatar";

interface LeaderboardEntry {
  user_id: string;
  display_name: string;
  username: string;
  avatar_url: string | null;
  total_paid: number;
  rank: number;
}

interface BrokestEntry {
  user_id: string;
  display_name: string;
  username: string;
  avatar_url: string | null;
  total_paid: number;
}

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
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"friends" | "leaderboard">("friends");
  const [plans, setPlans] = useState<Plan[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [myTotalPaid, setMyTotalPaid] = useState(0);
  const [brokest, setBrokest] = useState<BrokestEntry | null>(null);
  const [bestGroupName, setBestGroupName] = useState<string | null>(null);
  const [bestGroupTotal, setBestGroupTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // Compose state
  const [showCompose, setShowCompose] = useState(false);
  const [planTitle, setPlanTitle] = useState("");
  const [planAmount, setPlanAmount] = useState("");
  const [planSlots, setPlanSlots] = useState("");
  const [isPosting, setIsPosting] = useState(false);

  useEffect(() => {
    if (!user) return;
    loadData();

    // Realtime for plans
    const channel = supabase
      .channel("plans-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "plans" }, () => loadPlans())
      .on("postgres_changes", { event: "*", schema: "public", table: "plan_members" }, () => loadPlans())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const loadPlans = async () => {
    if (!user) return;
    try {
      const data = await getPlans(user.id);
      setPlans((data as Plan[]) || []);
    } catch { /* ignore */ }
  };

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await loadPlans();

      // Leaderboard
      const { data: board } = await supabase.from("leaderboard").select("*");
      if (board) {
        const ranked = board.map((entry: any, i: number) => ({ ...entry, rank: i + 1 }));
        setLeaderboard(ranked.slice(0, 10));
        const myEntry = ranked.find((e: any) => e.user_id === user.id);
        if (myEntry) { setMyRank(myEntry.rank); setMyTotalPaid(myEntry.total_paid); }
        const withActivity = ranked.filter((e: any) => e.total_paid > 0);
        if (withActivity.length > 0) {
          const last = withActivity[withActivity.length - 1];
          setBrokest({ user_id: last.user_id, display_name: last.display_name, username: last.username, avatar_url: last.avatar_url, total_paid: last.total_paid });
        }
      }

      // Best group
      const { data: bestGroups } = await supabase
        .from("public_groups")
        .select("id, name, total_amount")
        .order("total_amount", { ascending: false })
        .limit(1);
      if (bestGroups && bestGroups.length > 0) {
        setBestGroupName(bestGroups[0].name);
        setBestGroupTotal(bestGroups[0].total_amount);
      }
    } catch { /* ignore */ }
    setLoading(false);
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
        await joinPlan(plan.id, user.id);
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

  const getMedal = (rank: number) => {
    if (rank === 1) return "🥇";
    if (rank === 2) return "🥈";
    if (rank === 3) return "🥉";
    return `#${rank}`;
  };

  const getRankEmoji = (rank: number | null) => {
    if (!rank) return "🏅";
    if (rank === 1) return "🥇";
    if (rank === 2) return "🥈";
    if (rank === 3) return "🥉";
    return `#${rank}`;
  };

  return (
    <div className="flex flex-col min-h-full overflow-y-auto pb-36 px-5 pt-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <img src={imgYutoMascot} alt="Yuto" className="w-10 h-10 object-contain" />
        <span className="text-2xl font-bold text-black">Home</span>
      </div>

      {/* Tab switcher with sliding pill */}
      <div className="relative flex bg-gray-100 rounded-2xl p-1 mb-6">
        {/* Sliding pill */}
        <div
          className="absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white rounded-xl shadow-sm transition-transform duration-300 ease-in-out"
          style={{ transform: activeTab === "friends" ? "translateX(0px)" : "translateX(calc(100% + 8px))" }}
        />
        <button
          onClick={() => setActiveTab("friends")}
          className={`relative flex-1 py-2 rounded-xl text-sm font-semibold transition-colors duration-200 ${activeTab === "friends" ? "text-black" : "text-gray-400"}`}
        >
          Plans 📋
        </button>
        <button
          onClick={() => setActiveTab("leaderboard")}
          className={`relative flex-1 py-2 rounded-xl text-sm font-semibold transition-colors duration-200 ${activeTab === "leaderboard" ? "text-black" : "text-gray-400"}`}
        >
          Leaderboard 🏆
        </button>
      </div>

      {activeTab === "friends" ? (
        <>
          {/* Plans board */}
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin" />
            </div>
          ) : plans.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <p className="text-4xl mb-3">📋</p>
              <p className="font-bold text-black text-lg">The board is empty</p>
              <p className="text-gray-400 text-sm mt-1">Post a plan and see who's in</p>
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
                  <div key={plan.id} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                    {/* Creator */}
                    <div className="flex items-center gap-2 mb-3">
                      <UserAvatar name={plan.creator.display_name} avatarUrl={plan.creator.avatar_url} size="sm" />
                      <div className="flex-1">
                        <p className="font-semibold text-sm text-black">{plan.creator.display_name}</p>
                        <p className="text-xs text-gray-400">{new Date(plan.created_at).toLocaleDateString("en-KE", { weekday: "short", month: "short", day: "numeric" })}</p>
                      </div>
                      {isMine && (
                        <button onClick={() => handleDelete(plan.id)} className="text-gray-300 hover:text-red-400 text-lg transition-colors">🗑</button>
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
                          {isMember ? "Leave" : "I'm in ✋"}
                        </button>
                      )}
                      {canYutoIt && (
                        <button
                          onClick={() => handleYutoIt(plan)}
                          className="flex-1 py-2.5 bg-green-500 text-white rounded-xl font-bold text-sm hover:bg-green-600 transition-colors"
                        >
                          Yuto it! 🚀
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <>
          {/* Your rank card */}
          <div className="bg-black rounded-2xl p-5 mb-5">
            <p className="text-white/60 text-sm mb-1">Your Kenyan rank</p>
            <div className="flex items-center justify-between">
              <span className="text-4xl">{getRankEmoji(myRank)}</span>
              <div className="text-right">
                <p className="text-white/60 text-xs">Total paid</p>
                <p className="text-green-400 font-bold text-2xl">KSH {myTotalPaid.toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* Best group + Watu Broke */}
          <div className="flex gap-3 mb-5">
            {bestGroupName && (
              <div className="flex-1 bg-gray-50 border border-gray-200 rounded-2xl p-4">
                <p className="text-gray-500 font-bold text-xs mb-2">🔥 Most Active</p>
                <p className="font-bold text-black text-sm truncate">{bestGroupName}</p>
                <p className="text-gray-600 font-bold text-lg">KSH {bestGroupTotal?.toLocaleString()}</p>
              </div>
            )}
            {brokest && (
              <div className="flex-1 bg-gray-50 border border-gray-200 rounded-2xl p-4">
                <p className="text-gray-500 font-bold text-xs mb-2">💸 Watu Broke</p>
                <div className="flex items-center gap-2 mb-1">
                  <UserAvatar name={brokest.display_name} avatarUrl={brokest.avatar_url} size="sm" />
                  <p className="font-bold text-black text-sm truncate">{brokest.display_name}</p>
                </div>
                <p className="text-gray-600 font-bold text-lg">KSH {brokest.total_paid.toLocaleString()}</p>
                <p className="text-gray-400 text-xs">@{brokest.username}</p>
                <span className="inline-block mt-2 text-[10px] font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded-full">
                  Tumeshangaa this brokeness 😭
                </span>
              </div>
            )}
          </div>

          {/* Kenyan Leaderboard */}
          <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden mb-6">
            <div className="px-4 py-4 border-b border-gray-50">
              <p className="font-bold text-black">🏆 Watu Pesa | Kenya Leaderboard</p>
              <p className="text-xs text-gray-400 mt-0.5">Ranked by KSH paid</p>
            </div>
            {leaderboard.map((entry) => {
              const isMe = entry.user_id === user?.id;
              return (
                <div
                  key={entry.user_id}
                  onClick={() => navigate(`/user/${entry.username}`)}
                  className={`flex items-center gap-3 px-4 py-4 border-b border-gray-50 last:border-0 cursor-pointer active:bg-gray-50 transition-colors ${isMe ? "bg-green-50" : ""}`}
                >
                  <span className="text-lg w-8 text-center">{getMedal(entry.rank)}</span>
                  <UserAvatar name={entry.display_name} avatarUrl={entry.avatar_url} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold text-sm truncate ${isMe ? "text-green-700" : "text-black"}`}>
                      {entry.display_name} {isMe && "(you)"}
                    </p>
                    <p className="text-xs text-gray-400">@{entry.username}</p>
                  </div>
                  <p className={`font-bold text-sm ${isMe ? "text-green-600" : "text-black"}`}>
                    KSH {entry.total_paid.toLocaleString()}
                  </p>
                </div>
              );
            })}
          </div>
        </>
      )}

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
              {isPosting ? "Posting..." : "Post Plan 📋"}
            </button>
          </div>
        </div>
      )}

      {/* Floating compose button */}
      <button
        onClick={() => setShowCompose(true)}
        className="fixed bottom-24 left-1/2 -translate-x-1/2 px-8 py-3.5 bg-black text-white rounded-full shadow-lg flex items-center gap-2 font-bold text-sm z-40 hover:bg-gray-800 transition-colors"
      >
        <span className="text-lg">+</span> Post a Plan
      </button>
    </div>
  );
}
