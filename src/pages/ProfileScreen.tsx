import { useState, useEffect, useLayoutEffect, useRef, type ReactNode, type ChangeEvent } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "../contexts/AuthContext";
import {
  fetchYutoBalance,
  createHighlight,
  getFriends,
  getHighlightsByUser,
  getMyGroups,
  getPendingRequests,
  getSavedPhoneNumber,
  saveProfilePhoneNumber,
  uploadHighlightAsset,
  uploadAvatar,
  supabase,
  type Highlight,
} from "../lib/supabase";
import UserAvatar from "../components/UserAvatar";
import { HighlightStillMedia, isHighlightVideoUrl } from "../components/highlights/HighlightStillMedia";
import { YutoBalanceTopUpModal } from "../components/wallet/YutoBalanceTopUpModal";
import { Wallet, History, Plus, Copy, Check, Send } from "lucide-react";
import { ShareRecipientsSheet } from "../components/profile/ShareRecipientsSheet";


function ChevronRight() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function MenuItem({
  icon,
  label,
  sublabel,
  onClick,
  danger = false,
  badge,
}: {
  icon: ReactNode;
  label: string;
  sublabel?: string;
  onClick?: () => void;
  danger?: boolean;
  badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between py-4 px-1 bg-transparent border-none cursor-pointer text-left"
    >
      <div className="flex items-center gap-4">
        <div className={danger ? "text-red-500" : "text-black"}>{icon}</div>
        <div>
          <div className="flex items-center gap-2">
            <p className={`font-semibold text-[15px] ${danger ? "text-red-500" : "text-black"}`}>
              {label}
            </p>
            {badge && badge > 0 ? (
              <span className="bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {badge}
              </span>
            ) : null}
          </div>
          {sublabel && (
            <p className={`text-xs mt-0.5 ${badge && badge > 0 ? "text-red-400" : "text-gray-400"}`}>
              {sublabel}
            </p>
          )}
        </div>
      </div>
      {!danger && <ChevronRight />}
    </button>
  );
}

const STAT_POSITIONS = [
  { id: "splits", angle: -2.4, label: "Splits" },
  { id: "paid", angle: -0.7, label: "KSH Paid" },
  { id: "friends", angle: 2.4, label: "Friends" },
  { id: "plans", angle: 0.7, label: "Plans" },
];

export default function ProfileScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, signOut, refreshProfile } = useAuth();
  const [stats, setStats] = useState({ totalYutos: 0, totalSpent: 0, friendsCount: 0, plansCount: 0 });
  const [pendingCount, setPendingCount] = useState(0);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile?.avatar_url || null);
  const [phoneNumber, setPhoneNumber] = useState(profile?.phone_number || "");
  const [savingPhone, setSavingPhone] = useState(false);
  const [phoneMessage, setPhoneMessage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [points, setPoints] = useState(0);
  const [copiedLink, setCopiedLink] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [walletTab, setWalletTab] = useState<"balance" | "points">("balance");
  const [referralCount, setReferralCount] = useState(0);
  const [referralEarned, setReferralEarned] = useState(0);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [withdrawError, setWithdrawError] = useState("");

  // Highlights (max 2, 2 photos each)
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [showHighlightCreate, setShowHighlightCreate] = useState(false);
  const [creatingHighlight, setCreatingHighlight] = useState(false);
  const [highlightFiles, setHighlightFiles] = useState<[File | null, File | null]>([null, null]);
  const [highlightPreviews, setHighlightPreviews] = useState<[string | null, string | null]>([null, null]);
  const [activeHighlight, setActiveHighlight] = useState<Highlight | null>(null);
  const [activeHighlightIdx, setActiveHighlightIdx] = useState<0 | 1>(0);
  const [activeHighlightMediaReady, setActiveHighlightMediaReady] = useState(false);
  const [shareHighlightOpen, setShareHighlightOpen] = useState(false);

  const activeHighlightMediaKey =
    activeHighlight?.photos?.[activeHighlightIdx]?.url ? `${activeHighlight.id}:${activeHighlightIdx}:${activeHighlight.photos[activeHighlightIdx]!.url}` : "";

  useLayoutEffect(() => {
    // Prevent "previous image" lingering when switching items.
    setActiveHighlightMediaReady(false);
  }, [activeHighlightMediaKey]);
  const handleOpenHistory = async () => {
    setShowHistoryModal(true);
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false })
        .limit(30);

      if (!error && data) {
        setTransactions(data);
      }
    } catch (err) {
      console.error("Failed to load history", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleWithdraw = async () => {
    if (!user || !phoneNumber || phoneNumber.length < 12) {
      setWithdrawError("Please save a valid M-PESA number first.");
      return;
    }
    const amountNum = parseInt(withdrawAmount);
    if (!amountNum || amountNum < 100) {
      setWithdrawError("Minimum withdrawal is KSH 100.");
      return;
    }
    if (amountNum > points) {
      setShowWithdrawModal(false);
      setWithdrawAmount("");
      setTimeout(() => setShowTopUpModal(true), 300); // slight delay so withdraw modal closes first
      return;
    }

    setIsWithdrawing(true);
    setWithdrawError("");

    try {
      // 1. Lock funds in Supabase
      const { data: transactionId, error: dbError } = await supabase.rpc("initiate_withdrawal", {
        p_amount: amountNum
      });

      if (dbError) throw new Error(dbError.message);

      // 2. Ping IntaSend B2C
      const res = await fetch("/api/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone_number: phoneNumber,
          amount: amountNum,
          user_id: user.id,
          transaction_id: transactionId
        }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        alert("Success! KSH " + amountNum + " has been sent to your M-PESA.");
        setShowWithdrawModal(false);
        setWithdrawAmount("");
        try {
          setPoints(await fetchYutoBalance(user.id));
        } catch {
          setPoints((p) => Math.max(0, p - amountNum));
        }
      } else {
        setWithdrawError(data.message || "Withdrawal failed. Your Yuto Balance has been refunded.");
      }
    } catch (err: any) {
      setWithdrawError(err.message || "Network error. Try again.");
    } finally {
      setIsWithdrawing(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    setPhoneNumber(profile?.phone_number || getSavedPhoneNumber(user.id) || "");
  }, [profile?.phone_number, user]);

  const handleAvatarUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    try {
      const url = await uploadAvatar(user.id, file);
      setAvatarUrl(url);
    } catch (err) {
      console.error("Failed to upload avatar:", err);
    } finally {
      setUploading(false);
    }
  };

  const handleSavePhone = async () => {
    if (!user) return;
    const cleaned = phoneNumber.replace(/\D/g, "");
    if (cleaned.length < 12) {
      setPhoneMessage("Enter a valid M-PESA number like 254712345678.");
      return;
    }
    setSavingPhone(true);
    setPhoneMessage(null);
    try {
      await saveProfilePhoneNumber(user.id, cleaned);
      await refreshProfile();
      setPhoneNumber(cleaned);
      setPhoneMessage("Saved for payments.");
    } catch (err) {
      console.error("Failed to save phone number:", err);
      setPhoneMessage("Could not save phone number. Try again.");
    } finally {
      setSavingPhone(false);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!user) return;
  
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();
        if (profileError) throw profileError;
        if (profileData?.avatar_url) setAvatarUrl(profileData.avatar_url);
  
        setPoints(await fetchYutoBalance(user.id));

        // Referral stats (minimal): count converted referrals + total earned from bonus transactions
        const [refs, bonusTx] = await Promise.all([
          supabase.from("referrals").select("id", { count: "exact", head: true }).eq("referrer_id", user.id).eq("converted", true),
          supabase
            .from("transactions")
            .select("amount")
            .eq("user_id", user.id)
            .eq("type", "deposit")
            .ilike("description", "Referral bonus%"),
        ]);
        setReferralCount(refs.count ?? 0);
        const earned = (bonusTx.data || []).reduce((sum, t: any) => sum + Math.max(0, Number(t.amount) || 0), 0);
        setReferralEarned(earned);
  
        const [groups, friends, pending, plansRes] = await Promise.all([
          getMyGroups(),
          getFriends(user.id),
          getPendingRequests(user.id),
          supabase.from("plans").select("id", { count: "exact", head: true }).eq("creator_id", user.id),
        ]);
  
        const paidGroups = (groups as any[]).filter((g: any) =>
          (g.group_members ?? []).some((m: any) => m.user_id === user.id && m.has_paid)
        );
        const totalSpent = paidGroups.reduce((sum: number, g: any) => sum + g.per_person, 0);
  
        setStats({
          totalYutos: groups.length,
          totalSpent,
          friendsCount: friends.length,
          plansCount: (plansRes as { count?: number })?.count ?? 0,
        });
        setPendingCount(pending.length);
      } catch (err) {
        console.error("Error fetching profile", err);
      } finally {
        setLoading(false);
      }
    };
  
    fetchData();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    getHighlightsByUser(user.id)
      .then((rows) => setHighlights(rows))
      .catch(() => setHighlights([]));
  }, [user]);

  useEffect(() => {
    const st = location.state as { openHighlightId?: string } | null;
    const hid = st?.openHighlightId;
    if (!hid || highlights.length === 0) return;
    const found = highlights.find((h) => h.id === hid);
    if (found) {
      setActiveHighlightIdx(0);
      setActiveHighlightMediaReady(false);
      setActiveHighlight(found);
    }
  }, [location.state, highlights]);

  const handlePickHighlight = async (idx: 0 | 1, e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");
    if (!isImage && !isVideo) return;

    let urlForPreview: string | null = null;
    try {
      urlForPreview = URL.createObjectURL(file);
      if (isVideo) {
        const durationSeconds = await new Promise<number>((resolve, reject) => {
          const v = document.createElement("video");
          v.preload = "metadata";
          v.muted = true;
          v.playsInline = true;
          v.src = urlForPreview as string;
          v.onloadedmetadata = () => resolve(Number(v.duration) || 0);
          v.onerror = () => reject(new Error("Couldn't read video metadata"));
        });
        if (durationSeconds > 30) {
          alert("Please pick a video that is 30 seconds or less.");
          URL.revokeObjectURL(urlForPreview);
          return;
        }
      }
    } catch (err) {
      if (urlForPreview) URL.revokeObjectURL(urlForPreview);
      console.error(err);
      alert("Couldn't use that media file. Try again.");
      return;
    }

    setHighlightFiles((prev) => {
      const next: [File | null, File | null] = [prev[0], prev[1]];
      next[idx] = file;
      return next;
    });
    setHighlightPreviews((prev) => {
      const next: [string | null, string | null] = [prev[0], prev[1]];
      if (next[idx]) URL.revokeObjectURL(next[idx] as string);
      next[idx] = urlForPreview;
      return next;
    });
  };

  const closeHighlightCreate = () => {
    setShowHighlightCreate(false);
    setHighlightFiles([null, null]);
    setHighlightPreviews((prev) => {
      prev.forEach((u) => u && URL.revokeObjectURL(u));
      return [null, null];
    });
  };

  const handleCreateHighlight = async () => {
    if (!user) return;
    if (!highlightFiles[0] || !highlightFiles[1]) return;
    setCreatingHighlight(true);
    try {
      const [a1, a2] = await Promise.all([
        uploadHighlightAsset(user.id, highlightFiles[0]),
        uploadHighlightAsset(user.id, highlightFiles[1]),
      ]);
      await createHighlight(user.id, [a1, a2]);
      const rows = await getHighlightsByUser(user.id);
      setHighlights(rows);
      closeHighlightCreate();
    } catch (err) {
      console.error(err);
      const msg =
        (err as { message?: string })?.message ||
        (err as { error?: { message?: string } })?.error?.message ||
        (err as { details?: string })?.details ||
        (err as { hint?: string })?.hint ||
        (typeof err === "string" ? err : "") ||
        "Couldn't create highlight.";
      alert(msg);
    }
    setCreatingHighlight(false);
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/auth");
  };

  const userName = profile?.display_name || "User";
  const userHandle = profile?.username ? `@${profile.username}` : "";
  const publicOrigin =
    typeof window === "undefined"
      ? "https://yuto.social"
      : window.location.hostname === "localhost" || window.location.hostname.startsWith("127.")
        ? window.location.origin
        : "https://yuto.social";
  const inviteUrl = profile?.username ? `${publicOrigin}/i/${profile.username}` : "";

  const handleCopyInvite = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 1500);
    } catch {
      // ignore
    }
  };

  const cx = 190;
  const cy = 190;
  const nodeRadius = 125;

  return (
    <div className="flex flex-col min-h-full px-5 pt-10 pb-6">
      <div className="flex items-center justify-between mb-6">
        <span className="text-2xl font-bold text-black">Profile</span>
      </div>

      {/* Radial graph — YutoGroupScreen inspired */}
      <div className="relative w-full max-w-[380px] mx-auto flex-shrink-0" style={{ height: 380 }}>
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 380 380"
          preserveAspectRatio="xMidYMid meet"
          style={{ zIndex: 1 }}
        >
          <circle cx={cx} cy={cy} r="85" fill="none" stroke="#f0f0f0" strokeWidth="1" />
          <circle
            cx={cx}
            cy={cy}
            r="135"
            fill="none"
            stroke="#f0f0f0"
            strokeWidth="1"
            strokeDasharray="4 6"
            style={{ animation: "orbitSpin 60s linear infinite", transformOrigin: "190px 190px" }}
          />
          {/* Connection ropes — curved with flowing dashes */}
          {STAT_POSITIONS.map((pos, i) => {
            const nx = cx + Math.cos(pos.angle) * nodeRadius;
            const ny = cy + Math.sin(pos.angle) * nodeRadius;
            const midX = (cx + nx) / 2;
            const midY = (cy + ny) / 2;
            const perpX = -Math.sin(pos.angle) * 25;
            const perpY = Math.cos(pos.angle) * 25;
            const cpX = midX + perpX;
            const cpY = midY + perpY;
            const pathD = `M ${cx} ${cy} Q ${cpX} ${cpY} ${nx} ${ny}`;
            const motionD = `M 0 0 Q ${cpX - cx} ${cpY - cy} ${nx - cx} ${ny - cy}`;
            return (
              <g key={pos.id}>
                <path
                  d={pathD}
                  fill="none"
                  stroke="#d1d5db"
                  strokeWidth="2"
                  strokeDasharray="7 5"
                  strokeLinecap="round"
                  className="graph-line-flowing"
                />
                {/* Local path from (0,0) inside translated g — avoids default circle at SVG 0,0 flashing in corners */}
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

        {/* Center avatar */}
        <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 10 }}>
          <div className="relative">
            <div
              className={`w-[100px] h-[100px] rounded-full flex items-center justify-center overflow-hidden border-[3px] transition-all ${
                stats.totalSpent > 0 ? "border-green-500" : "border-gray-300"
              }`}
              style={
                stats.totalSpent > 0
                  ? { boxShadow: "0 0 0 6px rgba(34,197,94,0.2), 0 0 0 14px rgba(34,197,94,0.08)" }
                  : {}
              }
            >
              <UserAvatar name={userName} avatarUrl={avatarUrl} size="xl" className="!w-full !h-full" />
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="absolute -bottom-0.5 -right-0.5 w-7 h-7 bg-green-500 rounded-full flex items-center justify-center border-2 border-white shadow"
            >
              {uploading ? (
                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <span className="text-white text-sm font-bold leading-none">+</span>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarUpload}
            />
          </div>
        </div>

        {/* Stat nodes */}
        {STAT_POSITIONS.map((pos, i) => {
          const value =
            pos.id === "splits" ? stats.totalYutos :
            pos.id === "paid" ? stats.totalSpent.toLocaleString() :
            pos.id === "friends" ? stats.friendsCount :
            stats.plansCount;
          const isPaid = pos.id === "paid" && stats.totalSpent > 0;
          const x = Math.cos(pos.angle) * nodeRadius;
          const y = Math.sin(pos.angle) * nodeRadius;

          return (
            <div
              key={pos.id}
              className="absolute left-1/2 top-1/2 flex flex-col items-center"
              style={{
                transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
                zIndex: 20,
              }}
            >
              <div
                className={`rounded-2xl px-5 py-3 text-center min-w-[88px] transition-colors ${
                  isPaid
                    ? "bg-black text-green-400 border-2 border-green-500 shadow-lg"
                    : "bg-white border border-gray-200 shadow-sm"
                }`}
              >
                <p className={`font-extrabold text-xl font-syne ${isPaid ? "text-green-400" : "text-black"}`}>
                  {value}
                </p>
                <p className={`text-xs mt-0.5 ${isPaid ? "text-white/70" : "text-gray-400"}`}>
                  {pos.label}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Name + handle */}
      <div className="text-center -mt-2 mb-3">
        <p className="font-bold text-xl text-black">{userName}</p>
        <p className="text-sm text-gray-400">{userHandle}</p>
      </div>

      {/* Highlights — no + when both slots are used; row stays centered */}
      <div className="flex items-center justify-center gap-4 mb-6">
        {highlights.length < 2 && (
          <button
            type="button"
            onClick={() => setShowHighlightCreate(true)}
            className="w-16 h-16 rounded-full border-2 border-gray-200 bg-white text-black flex items-center justify-center shadow-sm"
            aria-label="Add highlight"
            title="Add highlight"
          >
            <Plus size={22} />
          </button>
        )}

        {highlights.length > 0 && (
          <div className="flex items-center justify-center gap-4">
            {highlights.slice(0, 2).map((h) => (
              <button
                key={h.id}
                type="button"
                onClick={() => {
                  setActiveHighlightIdx(0);
                  setActiveHighlightMediaReady(false);
                  setActiveHighlight(h);
                }}
                className="bg-transparent border-none p-0"
              >
                <motion.div
                  layoutId={`highlight-container-${h.id}`}
                  style={{ borderRadius: 9999 }}
                  className="relative w-16 h-16 shrink-0 border-2 border-gray-200 overflow-hidden bg-gray-100"
                >
                  {h.photos[0]?.url ? (
                    <HighlightStillMedia
                      url={(h.photos[0].thumb_url || h.photos[0].poster_url || h.photos[0].url) as string}
                      className="absolute inset-0 h-full w-full object-cover pointer-events-none"
                    />
                  ) : null}
                </motion.div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* NEW: Yuto Wallet Card */}
      <div className="bg-black rounded-3xl p-6 text-white mb-6 relative overflow-hidden shadow-lg">
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 mb-5">
          <div className="absolute left-0 top-0">
            <Wallet size={16} className="text-white/70" />
          </div>
          <div className="flex items-center justify-center gap-6 text-base font-extrabold">
            <button
              type="button"
              onClick={() => setWalletTab("balance")}
              className={`bg-transparent border-none p-0 cursor-pointer transition-colors ${
                walletTab === "balance" ? "text-white" : "text-white/40"
              }`}
            >
              Balance
            </button>
            <button
              type="button"
              onClick={() => setWalletTab("points")}
              className={`bg-transparent border-none p-0 cursor-pointer transition-colors ${
                walletTab === "points" ? "text-white" : "text-white/40"
              }`}
            >
              Points
            </button>
          </div>
        </div>

        {walletTab === "balance" ? (
          <div className="relative z-10">
            <div className="flex items-end justify-center">
              <div className="text-center">
                <span className="text-gray-400 text-lg font-medium mr-1">KSH</span>
                <span className="text-5xl font-bold tracking-tight">
                  {points.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
            <button
              onClick={() => setShowTopUpModal(true)}
              className="absolute right-0 top-1/2 -translate-y-1/2 w-10 h-10 bg-white text-black rounded-full flex items-center justify-center hover:scale-105 transition-transform shadow-md"
              aria-label="Top up"
            >
              <Plus size={20} strokeWidth={3} />
            </button>
          </div>
        ) : (
          <div className="relative z-10">
            <div className="text-center">
              <span className="text-white/70 text-sm font-semibold">Earned</span>
              <div className="mt-1">
                <span className="text-white/60 text-lg font-medium mr-1">KSH</span>
                <span className="text-5xl font-bold tracking-tight">{referralEarned.toLocaleString()}</span>
              </div>
              <p className="text-xs text-white/55 mt-2">
                {referralCount} converted
              </p>
            </div>

            <p className="text-xs text-white/60 mt-4">
              Earn <span className="text-white font-semibold">KSH 10</span> when a new user signs up with your link and tops up for the first time.
            </p>

            {profile?.username && (
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={handleCopyInvite}
                  className="flex-1 flex justify-center items-center gap-1.5 bg-white text-black py-3 rounded-xl text-sm font-bold transition-colors active:bg-gray-200"
                >
                  {copiedLink ? <Check size={16} /> : <Copy size={16} />}
                  {copiedLink ? "Copied!" : "Copy Link"}
                </button>
                <button
                  type="button"
                  disabled
                  className="flex-1 bg-white/10 text-white/60 py-3 rounded-xl text-sm font-bold cursor-not-allowed"
                >
                  Redeem (Soon)
                </button>
              </div>
            )}
          </div>
        )}

        {walletTab === "balance" && (
          <div className="relative z-10 mt-5 flex justify-center gap-3">
            <button
              onClick={() => setShowWithdrawModal(true)}
              className="text-sm font-bold bg-white text-black hover:bg-gray-200 transition-colors px-4 py-2 rounded-full flex items-center gap-1.5 shadow-sm"
            >
              Cash Out
            </button>
            <button
              onClick={handleOpenHistory}
              className="text-sm font-bold bg-white/10 hover:bg-white/20 transition-colors px-4 py-2 rounded-full flex items-center gap-1.5"
            >
              <History size={12} />
              History
            </button>
          </div>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-5 shadow-[0_8px_24px_rgba(0,0,0,0.04)]">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            <p className="text-sm font-semibold text-black">M-PESA number</p>
            <p className="text-xs text-gray-500">Used to prefill payment prompts on this device.</p>
          </div>
          <span className="text-[10px] uppercase tracking-[0.2em] text-gray-400 mt-1">Saved</span>
        </div>
        <div className="flex gap-2">
          <input
            type="tel"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ""))}
            placeholder="254712345678"
            maxLength={12}
            className="flex-1 h-12 border border-gray-300 rounded-full px-4 text-base outline-none focus:border-black transition-colors"
          />
          <button
            type="button"
            onClick={handleSavePhone}
            disabled={savingPhone}
            className="h-12 px-5 rounded-full bg-black text-white font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {savingPhone ? "Saving" : "Save"}
          </button>
        </div>
        {phoneMessage && <p className="text-xs text-gray-500 mt-2 ml-1">{phoneMessage}</p>}
      </div>

{/* Menu */}
      <div className="bg-white border border-gray-200 rounded-2xl px-5 divide-y divide-gray-100">
        <MenuItem
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          }
          label="Friends"
          sublabel={pendingCount > 0 ? `${pendingCount} pending request${pendingCount > 1 ? "s" : ""}` : `${stats.friendsCount} friends`}
          badge={pendingCount}
          onClick={() => navigate("/friends")}
        />
        <MenuItem
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          }
          label="Split History"
          sublabel="View past splits"
          onClick={() => navigate("/activity")}
        />
        <MenuItem
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="red" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          }
          label="Log Out"
          danger
          onClick={handleLogout}
        />
      </div>

      {showTopUpModal && user && (
        <YutoBalanceTopUpModal open={showTopUpModal} onClose={() => setShowTopUpModal(false)} userId={user.id} mpesaPhoneNumber={phoneNumber} />
      )}

      {/* Highlight Create Modal */}
      {showHighlightCreate && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center fade-in bg-black/60 backdrop-blur-sm">
          <button type="button" className="absolute inset-0 z-0 cursor-default border-none bg-transparent" aria-label="Dismiss" onClick={closeHighlightCreate} />
          <div className="relative z-10 bg-white rounded-t-3xl md:rounded-3xl w-full max-w-md p-6 modal-slide-up">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-xl text-black">New highlight</h2>
              <button onClick={closeHighlightCreate} className="text-2xl text-gray-400 hover:text-black bg-transparent border-none">✕</button>
            </div>
            <p className="text-sm text-gray-500 mb-4">Add exactly 2 photos or videos (max 30s). You can only have 2 highlights.</p>

            <div className="grid grid-cols-2 gap-3 mb-4">
              {[0, 1].map((i) => (
                <label
                  key={i}
                  className="rounded-2xl border border-gray-200 bg-gray-50 overflow-hidden aspect-square flex items-center justify-center cursor-pointer"
                >
                  {highlightPreviews[i as 0 | 1] ? (
                    <HighlightStillMedia
                      url={highlightPreviews[i as 0 | 1] as string}
                      className="h-full w-full object-cover pointer-events-none"
                    />
                  ) : (
                    <span className="text-sm text-gray-400 font-semibold">Pick photo or video</span>
                  )}
                  <input
                    type="file"
                    accept="image/*,video/*"
                    className="hidden"
                    onChange={(e) => void handlePickHighlight(i as 0 | 1, e)}
                  />
                </label>
              ))}
            </div>

            <button
              type="button"
              onClick={() => void handleCreateHighlight()}
              disabled={creatingHighlight || !highlightFiles[0] || !highlightFiles[1] || highlights.length >= 2}
              className="w-full py-4 bg-black text-white rounded-2xl font-bold disabled:opacity-40"
            >
              {creatingHighlight ? "Creating..." : "Create highlight"}
            </button>
          </div>
        </div>
      )}

      {/* Highlight Viewer */}
      <AnimatePresence>
        {activeHighlight && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.006, ease: "linear" }}
              className="fixed inset-0 z-40 bg-black"
            />

            <motion.div
              layoutId={`highlight-container-${activeHighlight.id}`}
              style={{ borderRadius: 0 }}
              transition={{
                layout: { duration: 0.008, ease: [0.2, 0.9, 0.2, 1] },
                opacity: { duration: 0.006, ease: "linear" },
              }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden"
              onKeyDown={(e) => {
                if (e.key === "Escape") setActiveHighlight(null);
              }}
              tabIndex={-1}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={0.8}
              onDragEnd={(_, info) => {
                if (info.offset.y > 100 || info.velocity.y > 500) setActiveHighlight(null);
              }}
            >
              {/* Progress bars */}
              <div className="absolute top-3 left-3 right-3 z-50 flex gap-2">
                {(() => {
                  const total = Math.max(1, Math.min(2, activeHighlight.photos?.length || 0));
                  return Array.from({ length: total }).map((_, i) => (
                    <div key={i} className="flex-1 h-[3px] rounded-full bg-white/30 overflow-hidden">
                      <div className="h-full bg-white" style={{ width: activeHighlightIdx >= i ? "100%" : "0%" }} />
                    </div>
                  ));
                })()}
              </div>

              {user && (
                <button
                  type="button"
                  onClick={() => setShareHighlightOpen(true)}
                  className="absolute bottom-4 right-4 z-50 w-12 h-12 rounded-2xl bg-white/15 text-white flex items-center justify-center hover:bg-white/25 border-none"
                  aria-label="Share highlight"
                  title="Share highlight"
                >
                  <Send size={18} />
                </button>
              )}

              <div className="absolute inset-0 flex items-center justify-center">
                {(() => {
                  const active = activeHighlight.photos?.[activeHighlightIdx];
                  if (!active) return null;
                  const isVideo = isHighlightVideoUrl(active.url);
                  const hasImagePoster = !!(active.poster_url || active.thumb_url);
                  const placeholderImage = hasImagePoster
                    ? (active.poster_url || active.thumb_url)
                    : (!isVideo ? active.url : null);

                  return (
                    <>
                      {placeholderImage && (
                        <img
                          src={placeholderImage as string}
                          alt=""
                          aria-hidden
                          className="absolute inset-0 max-w-full max-h-full w-full h-full object-contain pointer-events-none"
                          draggable={false}
                        />
                      )}

                      {isVideo ? (
                        <video
                          src={active.url.includes("#") ? active.url : `${active.url}#t=0.001`}
                          key={`video-${activeHighlightMediaKey}`}
                          className={`absolute inset-0 max-w-full max-h-full w-full h-full object-contain pointer-events-none transition-opacity duration-200 ease-in-out ${
                            activeHighlightMediaReady || !placeholderImage ? "opacity-100" : "opacity-0"
                          }`}
                          playsInline
                          autoPlay
                          muted
                          loop
                          onLoadedData={() => setActiveHighlightMediaReady(true)}
                        />
                      ) : (
                        <img
                          src={active.url}
                          alt=""
                          key={`img-${activeHighlightMediaKey}`}
                          className={`absolute inset-0 max-w-full max-h-full w-full h-full object-contain pointer-events-none transition-opacity duration-200 ease-in-out ${
                            activeHighlightMediaReady ? "opacity-100" : "opacity-0"
                          }`}
                          draggable={false}
                          onLoad={() => setActiveHighlightMediaReady(true)}
                        />
                      )}
                    </>
                  );
                })()}
              </div>

              {/* Tap zones */}
              <button
                type="button"
                className="absolute inset-y-0 left-0 w-1/2 border-none bg-transparent z-40"
                aria-label="Previous photo"
                onClick={() => {
                  if (activeHighlightIdx === 1) {
                    setActiveHighlightIdx(0);
                    setActiveHighlightMediaReady(false);
                    return;
                  }
                  setActiveHighlight(null);
                }}
              />

              <button
                type="button"
                className="absolute inset-y-0 right-0 w-1/2 border-none bg-transparent z-40"
                aria-label="Next photo"
                onClick={() => {
                  if (activeHighlightIdx === 0) {
                    setActiveHighlightIdx(1);
                    setActiveHighlightMediaReady(false);
                    return;
                  }
                  setActiveHighlight(null);
                }}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>


      {/* Transaction History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-black/60 flex items-end md:items-center justify-center z-50 fade-in">
          <div className="bg-white rounded-t-3xl md:rounded-3xl w-full max-w-md h-[75vh] md:h-[600px] flex flex-col overflow-hidden modal-slide-up">
            
            {/* Header */}
            <div className="flex justify-between items-center p-6 border-b border-gray-100 shrink-0">
              <h2 className="font-bold text-xl text-black">Wallet History</h2>
              <button onClick={() => setShowHistoryModal(false)} className="text-2xl text-gray-400 hover:text-black bg-transparent border-none">✕</button>
            </div>
            
            {/* Ledger List */}
            <div className="flex-1 overflow-y-auto p-6">
              {loadingHistory ? (
                <div className="flex justify-center items-center h-full">
                  <div className="w-8 h-8 border-4 border-gray-200 border-t-black rounded-full animate-spin"></div>
                </div>
              ) : transactions.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                  <History size={48} className="mb-4 opacity-20" />
                  <p>No transactions yet.</p>
                </div>
              ) : (
                <div className="space-y-5">
                  {transactions.map((tx) => {
                    const isPositive = Number(tx.amount) > 0;
                    return (
                      <div key={tx.id} className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isPositive ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-600'}`}>
                            {isPositive ? <Plus size={16} strokeWidth={3} /> : <span className="font-bold text-lg leading-none mb-1">-</span>}
                          </div>
                          <div>
                            <p className="font-semibold text-sm text-black">{tx.description || tx.type}</p>
                            <p className="text-xs text-gray-400">
                              {new Date(tx.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                        <span className={`font-bold text-sm ${isPositive ? 'text-green-600' : 'text-black'}`}>
                          {isPositive ? '+' : ''}KSH {Math.abs(Number(tx.amount)).toLocaleString()}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}


      {/* Withdraw Modal */}
      {user && activeHighlight && (
        <ShareRecipientsSheet
          open={shareHighlightOpen}
          onClose={() => setShareHighlightOpen(false)}
          currentUserId={user.id}
          sharePayload={{ kind: "highlight", highlight_id: activeHighlight.id, user_id: user.id }}
        />
      )}

      {showWithdrawModal && (
        <div className="fixed inset-0 bg-black/60 flex items-end md:items-center justify-center z-50 fade-in">
          <div className="bg-white rounded-t-3xl md:rounded-3xl w-full max-w-md p-6 modal-slide-up">
            <div className="flex justify-between items-center mb-5">
              <h2 className="font-bold text-xl text-black">Withdraw to M-PESA</h2>
              <button onClick={() => setShowWithdrawModal(false)} className="text-2xl text-gray-400 hover:text-black bg-transparent border-none">✕</button>
            </div>
            
            <div className="mb-6 flex flex-col items-center w-full">
              <span className="text-sm text-gray-400 font-semibold mb-2 uppercase tracking-wide">Amount (KSH)</span>
              <input
                type="text"
                inputMode="numeric"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value.replace(/\D/g, ""))}
                placeholder="0"
                className="text-[48px] font-bold text-center text-black bg-transparent border-none outline-none w-full mb-2"
              />
              <p className="text-sm text-gray-500 font-medium mb-4">Available: KSH {points.toLocaleString()}</p>
              
              <div className="flex gap-2 w-full mb-2">
                {[100, 500, 'MAX'].map((preset) => (
                  <button
                    key={preset}
                    onClick={() => setWithdrawAmount(preset === 'MAX' ? points.toString() : preset.toString())}
                    className="flex-1 py-3 rounded-2xl font-bold text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors active:scale-95"
                  >
                    {preset === 'MAX' ? 'MAX' : `+${preset}`}
                  </button>
                ))}
              </div>
            </div>

            {withdrawError && <p className="text-sm text-center font-medium mb-4 text-red-500">{withdrawError}</p>}

            <button
              onClick={handleWithdraw}
              disabled={isWithdrawing || !withdrawAmount || parseInt(withdrawAmount) > points}
              className="w-full py-4 bg-black text-white rounded-full font-bold text-lg disabled:opacity-50 transition-all active:scale-[0.98]"
            >
              {isWithdrawing ? "Processing..." : "Withdraw"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}