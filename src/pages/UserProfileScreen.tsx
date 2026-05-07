import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { supabase, getProfile, getFriends, sendFriendRequest, getHighlightsByUser, getOrCreateDmConversation, type Highlight } from "../lib/supabase";
import UserAvatar from "../components/UserAvatar";
import { HighlightStillMedia, isHighlightVideoUrl } from "../components/highlights/HighlightStillMedia";
import { ArrowLeft, UserPlus, Check, Clock, MessageCircle, Send } from "lucide-react";
import { ShareRecipientsSheet } from "../components/profile/ShareRecipientsSheet";

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
  const [activeHighlightIdx, setActiveHighlightIdx] = useState<0 | 1>(0);
  const [activeHighlightPos, setActiveHighlightPos] = useState(0);
  const [hlFade, setHlFade] = useState(false);
  const highlightGestureRef = useRef<{ startY: number; moved: boolean } | null>(null);
  const suppressHighlightTapRef = useRef(false);
  const [sendProfileOpen, setSendProfileOpen] = useState(false);
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

  const handleMessage = async () => {
    if (!user || !targetUserId) return;
    try {
      const convo = await getOrCreateDmConversation(user.id, targetUserId);
      navigate(`/messages/${convo.id}`, { state: { otherUserId: targetUserId } });
    } catch (err) {
      console.error(err);
      alert("Couldn't open messages. Try again.");
    }
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
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 bg-transparent border-none cursor-pointer text-black hover:opacity-70 transition-opacity shrink-0">
            <ArrowLeft size={24} />
          </button>
          <span className="text-2xl font-bold text-black truncate">Profile</span>
        </div>
        {user && targetUserId && (
          <button
            type="button"
            onClick={() => setSendProfileOpen(true)}
            className="w-11 h-11 rounded-2xl bg-gray-100 text-black flex items-center justify-center hover:bg-gray-200 transition-colors shrink-0"
            aria-label="Send profile in messages"
            title="Send profile"
          >
            <Send size={20} strokeWidth={2} />
          </button>
        )}
      </div>

      {user && targetUserId && (
        <ShareRecipientsSheet
          open={sendProfileOpen}
          onClose={() => setSendProfileOpen(false)}
          currentUserId={user.id}
          sharePayload={{ kind: "profile", user_id: targetUserId }}
          excludeUserIds={[targetUserId]}
        />
      )}

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
              onClick={() => {
                const pos = highlights.slice(0, 2).findIndex((x) => x.id === h.id);
                setActiveHighlightPos(Math.max(0, pos));
                setActiveHighlightIdx(0);
                setActiveHighlight(h);
              }}
              className="flex flex-col items-center gap-1 bg-transparent border-none p-0"
            >
              <div className="relative w-16 h-16 shrink-0 rounded-full border-2 border-gray-200 overflow-hidden bg-gray-100">
                {h.photos[0]?.url ? (
                  <HighlightStillMedia
                    url={h.photos[0].url}
                    className="absolute inset-0 h-full w-full object-cover pointer-events-none"
                  />
                ) : null}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Action Buttons */}
      <div className="px-2">
        {friendStatus === "friends" ? (
          <button
            onClick={() => void handleMessage()}
            className="w-full py-4 bg-black text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-gray-800 transition-colors shadow-lg shadow-black/10"
          >
            <MessageCircle size={20} /> Message
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <button
              onClick={handleAddFriend}
              disabled={actionLoading || friendStatus !== "none"}
              className={`flex-1 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-colors shadow-lg shadow-black/10 ${
                friendStatus === "none"
                  ? "bg-black text-white hover:bg-gray-800"
                  : "bg-gray-100 text-gray-500 shadow-none"
              }`}
            >
              {friendStatus === "pending" ? (
                <>
                  <Clock size={20} /> Pending
                </>
              ) : (
                <>
                  <UserPlus size={20} /> Add Friend
                </>
              )}
            </button>

            <button
              onClick={() => void handleMessage()}
              className="flex-1 py-4 bg-gray-100 text-black rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-gray-200 transition-colors"
            >
              <MessageCircle size={20} /> Message
            </button>
          </div>
        )}
      </div>

      {/* Highlight Viewer */}
      {activeHighlight && (
        <div
          className="fixed inset-0 z-50 fade-in bg-black"
          onKeyDown={(e) => {
            if (e.key === "Escape") setActiveHighlight(null);
          }}
          tabIndex={-1}
          onPointerDown={(e) => {
            highlightGestureRef.current = { startY: e.clientY, moved: false };
            suppressHighlightTapRef.current = false;
          }}
          onPointerMove={(e) => {
            const g = highlightGestureRef.current;
            if (!g) return;
            const dy = e.clientY - g.startY;
            if (dy > 18) {
              g.moved = true;
              suppressHighlightTapRef.current = true;
            }
            if (dy > 90) {
              highlightGestureRef.current = null;
              setActiveHighlight(null);
            }
          }}
          onPointerUp={() => {
            highlightGestureRef.current = null;
            window.setTimeout(() => (suppressHighlightTapRef.current = false), 0);
          }}
          onPointerCancel={() => {
            highlightGestureRef.current = null;
            window.setTimeout(() => (suppressHighlightTapRef.current = false), 0);
          }}
        >
          <div className="absolute top-3 left-3 right-3 z-20 flex gap-2">
            {(() => {
              const shown = highlights.slice(0, 2);
              const segs = shown.reduce((sum, h) => sum + Math.min(2, h.photos?.length || 0), 0);
              const total = segs > 0 ? segs : 2;
              const before = shown
                .slice(0, activeHighlightPos)
                .reduce((sum, h) => sum + Math.min(2, h.photos?.length || 0), 0);
              const segIndex = before + activeHighlightIdx;
              return Array.from({ length: total }).map((_, i) => (
                <div key={i} className="flex-1 h-[3px] rounded-full bg-white/30 overflow-hidden">
                  <div className="h-full bg-white" style={{ width: segIndex >= i ? "100%" : "0%" }} />
                </div>
              ));
            })()}
          </div>

          <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-150 ${hlFade ? "opacity-0" : "opacity-100"}`}>
            {isHighlightVideoUrl(activeHighlight.photos[activeHighlightIdx]?.url) ? (
              <video
                src={activeHighlight.photos[activeHighlightIdx]?.url}
                className="max-w-full max-h-full w-full h-full object-contain pointer-events-none"
                playsInline
                autoPlay
                muted
                loop
              />
            ) : (
              <img
                src={activeHighlight.photos[activeHighlightIdx]?.url}
                alt="Highlight"
                className="max-w-full max-h-full w-full h-full object-contain pointer-events-none"
                draggable={false}
              />
            )}
          </div>

          <button
            type="button"
            className="absolute inset-y-0 left-0 w-1/2 border-none bg-transparent z-30"
            aria-label="Previous photo"
            onClick={() => {
              if (suppressHighlightTapRef.current) return;
              if (activeHighlightIdx === 1) {
                setActiveHighlightIdx(0);
                return;
              }
              if (activeHighlightPos > 0) {
                const shown = highlights.slice(0, 2);
                const nextPos = activeHighlightPos - 1;
                const next = shown[nextPos];
                if (!next) return;
                setHlFade(true);
                window.setTimeout(() => {
                  setActiveHighlightPos(nextPos);
                  setActiveHighlightIdx(1);
                  setActiveHighlight(next);
                  setHlFade(false);
                }, 120);
              }
            }}
            onPointerDown={(e) => {
              highlightGestureRef.current = { startY: e.clientY, moved: false };
              suppressHighlightTapRef.current = false;
            }}
            onPointerMove={(e) => {
              const g = highlightGestureRef.current;
              if (!g) return;
              const dy = e.clientY - g.startY;
              if (dy > 18) {
                g.moved = true;
                suppressHighlightTapRef.current = true;
              }
              if (dy > 90) {
                highlightGestureRef.current = null;
                setActiveHighlight(null);
              }
            }}
            onPointerUp={() => {
              highlightGestureRef.current = null;
              window.setTimeout(() => (suppressHighlightTapRef.current = false), 0);
            }}
            onPointerCancel={() => {
              highlightGestureRef.current = null;
              window.setTimeout(() => (suppressHighlightTapRef.current = false), 0);
            }}
          />
          <button
            type="button"
            className="absolute inset-y-0 right-0 w-1/2 border-none bg-transparent z-30"
            aria-label="Next photo"
            onClick={() => {
              if (suppressHighlightTapRef.current) return;
              if (activeHighlightIdx === 0) {
                setActiveHighlightIdx(1);
                return;
              }
              const shown = highlights.slice(0, 2);
              const nextPos = activeHighlightPos + 1;
              if (nextPos < shown.length) {
                const next = shown[nextPos];
                if (!next) return;
                setHlFade(true);
                window.setTimeout(() => {
                  setActiveHighlightPos(nextPos);
                  setActiveHighlightIdx(0);
                  setActiveHighlight(next);
                  setHlFade(false);
                }, 120);
                return;
              }
              setActiveHighlight(null);
            }}
            onPointerDown={(e) => {
              highlightGestureRef.current = { startY: e.clientY, moved: false };
              suppressHighlightTapRef.current = false;
            }}
            onPointerMove={(e) => {
              const g = highlightGestureRef.current;
              if (!g) return;
              const dy = e.clientY - g.startY;
              if (dy > 18) {
                g.moved = true;
                suppressHighlightTapRef.current = true;
              }
              if (dy > 90) {
                highlightGestureRef.current = null;
                setActiveHighlight(null);
              }
            }}
            onPointerUp={() => {
              highlightGestureRef.current = null;
              window.setTimeout(() => (suppressHighlightTapRef.current = false), 0);
            }}
            onPointerCancel={() => {
              highlightGestureRef.current = null;
              window.setTimeout(() => (suppressHighlightTapRef.current = false), 0);
            }}
          />
        </div>
      )}
    </div>
  );
}