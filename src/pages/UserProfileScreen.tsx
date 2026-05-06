import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { supabase, getProfile, getFriends, sendFriendRequest, getHighlightsByUser, type Highlight } from "../lib/supabase";
import UserAvatar from "../components/UserAvatar";
import { ArrowLeft, UserPlus, Check, Clock } from "lucide-react";

const STAT_POSITIONS = [
  { id: "splits", angle: -2.4, label: "Splits" },
  { id: "paid", angle: -0.7, label: "KSH Paid" },
  { id: "friends", angle: 2.4, label: "Friends" },
  { id: "plans", angle: 0.7, label: "Plans" },
];

export default function UserProfileScreen() {
  const { id: targetUserId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState({ totalYutos: 0, totalSpent: 0, friendsCount: 0, plansCount: 0 });
  const [friendStatus, setFriendStatus] = useState<"none" | "pending" | "friends">("none");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [activeHighlight, setActiveHighlight] = useState<Highlight | null>(null);

  useEffect(() => {
    // If they click their own profile, redirect to their main profile tab
    if (targetUserId === user?.id) {
      navigate("/profile", { replace: true });
      return;
    }
    loadUserProfile();
  }, [targetUserId, user]);

  const loadUserProfile = async () => {
    if (!targetUserId || !user) return;
    setLoading(true);
    try {
      // 1. Load Profile
      const userProfile = await getProfile(targetUserId);
      setProfile(userProfile);

      // 2. Load Stats (Safe queries that don't violate RLS)
      const [statsRes, plansRes, friendsRes, friendshipRes, highlightRows] = await Promise.all([
        supabase.from("group_members").select("has_paid, groups(per_person)").eq("user_id", targetUserId),
        supabase.from("plans").select("id", { count: "exact", head: true }).eq("creator_id", targetUserId),
        getFriends(targetUserId).catch(() => []), 
        supabase.from("friendships")
          .select("status")
          .or(`and(requester_id.eq.${user.id},addressee_id.eq.${targetUserId}),and(requester_id.eq.${targetUserId},addressee_id.eq.${user.id})`)
          .maybeSingle(),
        getHighlightsByUser(targetUserId).catch(() => []),
      ]);

      const membersData = statsRes.data || [];
      const paidMemberships = membersData.filter((m: any) => m.has_paid);
      const totalSpent = paidMemberships.reduce((sum, m: any) => sum + (m.groups?.per_person || 0), 0);

      setStats({
        totalYutos: membersData.length,
        totalSpent,
        friendsCount: friendsRes.length || 0,
        plansCount: plansRes.count || 0,
      });
      setHighlights(highlightRows as Highlight[]);

      // 3. Determine Friendship Status
      if (friendshipRes.data) {
        setFriendStatus(friendshipRes.data.status === "accepted" ? "friends" : "pending");
      } else {
        setFriendStatus("none");
      }
    } catch (err) {
      console.error("Failed to load user profile:", err);
    }
    setLoading(false);
  };

  const handleAddFriend = async () => {
    if (!user || !targetUserId) return;
    setActionLoading(true);
    try {
      await sendFriendRequest(user.id, targetUserId);
      setFriendStatus("pending");
    } catch (err) {
      console.error(err);
    }
    setActionLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-full">
        <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile) return <div className="p-5 text-center text-gray-500">User not found</div>;

  const userName = profile.display_name || "User";
  const userHandle = profile.username ? `@${profile.username}` : "";
  const cx = 190;
  const cy = 190;
  const nodeRadius = 125;

  return (
    <div className="flex flex-col min-h-full px-5 pt-10 pb-6">
      {/* Header with Back Button */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 bg-transparent border-none cursor-pointer text-black hover:opacity-70 transition-opacity">
          <ArrowLeft size={24} />
        </button>
        <span className="text-2xl font-bold text-black">Profile</span>
      </div>

      {/* Radial Graph */}
      <div className="relative w-full max-w-[380px] mx-auto flex-shrink-0" style={{ height: 380 }}>
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 380 380" preserveAspectRatio="xMidYMid meet" style={{ zIndex: 1 }}>
          <circle cx={cx} cy={cy} r="85" fill="none" stroke="#f0f0f0" strokeWidth="1" />
          <circle cx={cx} cy={cy} r="135" fill="none" stroke="#f0f0f0" strokeWidth="1" strokeDasharray="4 6" style={{ animation: "orbitSpin 60s linear infinite", transformOrigin: "190px 190px" }} />
          
          {STAT_POSITIONS.map((pos, i) => {
            const nx = cx + Math.cos(pos.angle) * nodeRadius;
            const ny = cy + Math.sin(pos.angle) * nodeRadius;
            const ctrlX = cx + -Math.sin(pos.angle) * 25;
            const ctrlY = cy + Math.cos(pos.angle) * 25;
            const pathD = `M ${cx} ${cy} Q ${ctrlX} ${ctrlY} ${nx} ${ny}`;
            const motionD = `M 0 0 Q ${ctrlX - cx} ${ctrlY - cy} ${nx - cx} ${ny - cy}`;
            return (
              <g key={pos.id}>
                <path d={pathD} fill="none" stroke="#d1d5db" strokeWidth="2" strokeDasharray="7 5" strokeLinecap="round" />
                <g transform={`translate(${cx},${cy})`}>
                  <circle r="3.5" fill="#5493b3">
                    <animateMotion dur="2s" repeatCount="indefinite" begin={`${i * 0.5}s`} path={motionD} rotate="0" />
                    <animate attributeName="opacity" values="0;0.8;0.8;0" dur="2s" repeatCount="indefinite" begin={`${i * 0.5}s`} />
                  </circle>
                </g>
              </g>
            );
          })}
        </svg>

        {/* Center Avatar */}
        <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 10 }}>
          <div className="relative">
            <div className={`w-[100px] h-[100px] rounded-full flex items-center justify-center overflow-hidden border-[3px] transition-all ${stats.totalSpent > 0 ? "border-green-500" : "border-gray-300"}`} style={stats.totalSpent > 0 ? { boxShadow: "0 0 0 6px rgba(34,197,94,0.2), 0 0 0 14px rgba(34,197,94,0.08)" } : {}}>
              <UserAvatar name={userName} avatarUrl={profile.avatar_url} size="xl" className="!w-full !h-full" />
            </div>
          </div>
        </div>

        {/* Stat Nodes */}
        {STAT_POSITIONS.map((pos) => {
          const value = pos.id === "splits" ? stats.totalYutos : pos.id === "paid" ? stats.totalSpent.toLocaleString() : pos.id === "friends" ? stats.friendsCount : stats.plansCount;
          const isPaid = pos.id === "paid" && stats.totalSpent > 0;
          return (
            <div key={pos.id} className="absolute left-1/2 top-1/2 flex flex-col items-center" style={{ transform: `translate(calc(-50% + ${Math.cos(pos.angle) * nodeRadius}px), calc(-50% + ${Math.sin(pos.angle) * nodeRadius}px))`, zIndex: 20 }}>
              <div className={`rounded-2xl px-5 py-3 text-center min-w-[88px] transition-colors ${isPaid ? "bg-black text-green-400 border-2 border-green-500 shadow-lg" : "bg-white border border-gray-200 shadow-sm"}`}>
                <p className={`font-extrabold text-xl font-syne ${isPaid ? "text-green-400" : "text-black"}`}>{value}</p>
                <p className={`text-xs mt-0.5 ${isPaid ? "text-white/70" : "text-gray-400"}`}>{pos.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Name + Handle */}
      <div className="text-center -mt-2 mb-3">
        <p className="font-bold text-xl text-black">{userName}</p>
        <p className="text-sm text-gray-400">{userHandle}</p>
      </div>

      {/* Highlights (viewer) */}
      {highlights.length > 0 && (
        <div className="flex items-center justify-center gap-4 mb-6">
          {highlights.slice(0, 2).map((h) => (
            <button
              key={h.id}
              type="button"
              onClick={() => setActiveHighlight(h)}
              className="flex flex-col items-center gap-1 bg-transparent border-none p-0"
            >
              <div className="w-16 h-16 rounded-full border-2 border-gray-200 overflow-hidden bg-gray-100">
                {h.photos[0]?.url ? (
                  <img src={h.photos[0].url} alt="Highlight" className="w-full h-full object-cover" />
                ) : null}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Action Buttons */}
      <div className="px-2">
        {friendStatus === "none" && (
          <button onClick={handleAddFriend} disabled={actionLoading} className="w-full py-4 bg-black text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-gray-800 transition-colors shadow-lg shadow-black/10">
            <UserPlus size={20} /> Add Friend
          </button>
        )}
        {friendStatus === "pending" && (
          <button disabled className="w-full py-4 bg-gray-100 text-gray-500 rounded-2xl font-bold flex items-center justify-center gap-2">
            <Clock size={20} /> Request Pending
          </button>
        )}
        {friendStatus === "friends" && (
          <button disabled className="w-full py-4 bg-green-50 text-green-600 rounded-2xl font-bold flex items-center justify-center gap-2 border border-green-200">
            <Check size={20} /> You are friends
          </button>
        )}
      </div>

      {/* Highlight Viewer */}
      {activeHighlight && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center fade-in bg-black/70 backdrop-blur-sm">
          <button type="button" className="absolute inset-0 z-0 cursor-default border-none bg-transparent" aria-label="Dismiss" onClick={() => setActiveHighlight(null)} />
          <div className="relative z-10 bg-white rounded-t-3xl md:rounded-3xl w-full max-w-md p-4 modal-slide-up">
            <div className="flex items-center justify-between mb-3">
              <p className="font-bold text-black">Highlight</p>
              <button onClick={() => setActiveHighlight(null)} className="text-2xl text-gray-400 hover:text-black bg-transparent border-none">✕</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {activeHighlight.photos.slice(0, 2).map((p) => (
                <div key={p.id} className="rounded-2xl overflow-hidden bg-gray-100 aspect-square">
                  <img src={p.url} alt="Highlight photo" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}