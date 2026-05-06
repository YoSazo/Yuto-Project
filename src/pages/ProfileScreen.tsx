import { useState, useEffect, useRef, type ReactNode, type ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  fetchYutoBalance,
  getFriends,
  getMyGroups,
  getPendingRequests,
  getSavedPhoneNumber,
  saveProfilePhoneNumber,
  uploadAvatar,
  supabase,
} from "../lib/supabase";
import UserAvatar from "../components/UserAvatar";
import { Wallet, History, Plus, Copy, Check } from "lucide-react";


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
  const [topUpAmount, setTopUpAmount] = useState("");
  const [isToppingUp, setIsToppingUp] = useState(false);
  const [topUpError, setTopUpError] = useState("");
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [withdrawError, setWithdrawError] = useState("");

  const handleTopUp = async () => {
    if (!user || !phoneNumber || phoneNumber.length < 12) {
      setTopUpError("Please save a valid M-PESA number first.");
      return;
    }
    const amountNum = parseInt(topUpAmount);
    if (!amountNum || amountNum < 10) {
      setTopUpError("Minimum top-up is KSH 10.");
      return;
    }

    setIsToppingUp(true);
    setTopUpError("");
    try {
      const res = await fetch("/api/charge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone_number: phoneNumber,
          amount: amountNum,
          user_id: user.id,
          is_topup: true,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTopUpError("Check your phone for the M-PESA prompt! Balance will update automatically.");
        setTimeout(() => setShowTopUpModal(false), 4000);
      } else {
        setTopUpError(data.message || "Failed to initiate STK push.");
      }
    } catch {
      setTopUpError("Network error. Try again.");
    }
    setIsToppingUp(false);
  };

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
        setPoints(points - amountNum); // Update UI optimistically
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
  
        const [groups, friends, pending, plansRes] = await Promise.all([
          getMyGroups(),
          getFriends(user.id),
          getPendingRequests(user.id),
          supabase.from("plans").select("id", { count: "exact", head: true }).eq("creator_id", user.id),
        ]);
  
        const paidGroups = (groups as any[]).filter((g: any) =>
          g.group_members.some((m: any) => m.user_id === user.id && m.has_paid)
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

  const handleLogout = async () => {
    await signOut();
    navigate("/auth");
  };

  const userName = profile?.display_name || "User";
  const userHandle = profile?.username ? `@${profile.username}` : "";

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
                <circle r="3.5" fill="#5493b3" opacity="0.7">
                  <animateMotion dur="2s" repeatCount="indefinite" begin={`${i * 0.5}s`} path={pathD} />
                  <animate attributeName="opacity" values="0;0.8;0.8;0" dur="2s" repeatCount="indefinite" begin={`${i * 0.5}s`} />
                </circle>
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
      <div className="text-center -mt-2 mb-6">
        <p className="font-bold text-xl text-black">{userName}</p>
        <p className="text-sm text-gray-400">{userHandle}</p>
      </div>

      {/* NEW: Yuto Wallet Card */}
      <div className="bg-black rounded-3xl p-6 text-white mb-6 relative overflow-hidden shadow-lg">
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center justify-between mb-4 relative z-10">
            <h2 className="text-gray-400 font-medium text-sm flex items-center gap-2">
              <Wallet size={16} />
              Yuto Balance
            </h2>
            <div className="flex gap-2">
              <button onClick={() => setShowWithdrawModal(true)} className="text-xs font-bold bg-white text-black hover:bg-gray-200 transition-colors px-3 py-1.5 rounded-full flex items-center gap-1 shadow-sm">
                Cash Out
              </button>
              <button onClick={handleOpenHistory} className="text-xs font-bold bg-white/10 hover:bg-white/20 transition-colors px-3 py-1.5 rounded-full flex items-center gap-1">
                <History size={12} />
                History
              </button>
            </div>
          </div>

        <div className="flex items-end justify-between relative z-10">
          <div>
            <span className="text-gray-400 text-lg font-medium mr-1">KSH</span>
            <span className="text-4xl font-bold tracking-tight">
              {points.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          <button 
              onClick={() => setShowTopUpModal(true)}
              className="w-10 h-10 bg-white text-black rounded-full flex items-center justify-center hover:scale-105 transition-transform shadow-md"
            >
              <Plus size={20} strokeWidth={3} />
            </button>
        </div>
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
          sublabel="View past fare splits"
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

      {/* Top-Up Modal */}
      {showTopUpModal && (
        <div className="fixed inset-0 bg-black/60 flex items-end md:items-center justify-center z-50 fade-in">
          <div className="bg-white rounded-t-3xl md:rounded-3xl w-full max-w-md p-6 modal-slide-up">
            <div className="flex justify-between items-center mb-5">
              <h2 className="font-bold text-xl text-black">Top Up Yuto Balance</h2>
              <button onClick={() => setShowTopUpModal(false)} className="text-2xl text-gray-400 hover:text-black bg-transparent border-none">✕</button>
            </div>
            
            <div className="mb-6 flex flex-col items-center w-full">
              <span className="text-sm text-gray-400 font-semibold mb-2 uppercase tracking-wide">Amount (KSH)</span>
              <input
                type="text"
                inputMode="numeric"
                value={topUpAmount}
                onChange={(e) => setTopUpAmount(e.target.value.replace(/\D/g, ""))}
                placeholder="0"
                className="text-[48px] font-bold text-center text-black bg-transparent border-none outline-none w-full mb-4"
              />
              
              {/* Frictionless Quick Buttons */}
              <div className="flex gap-2 w-full mb-2">
                {[100, 250, 500, 1000].map((preset) => (
                  <button
                    key={preset}
                    onClick={() => setTopUpAmount(preset.toString())}
                    className="flex-1 py-3 rounded-2xl font-bold text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors active:scale-95"
                  >
                    +{preset}
                  </button>
                ))}
              </div>
            </div>

            {topUpError && (
              <p className={`text-sm text-center font-medium mb-4 ${topUpError.includes("Check your phone") ? "text-green-600" : "text-red-500"}`}>
                {topUpError}
              </p>
            )}

            <button
              onClick={handleTopUp}
              disabled={isToppingUp || !topUpAmount}
              className="w-full py-4 bg-black text-white rounded-full font-bold text-lg disabled:opacity-50 transition-all active:scale-[0.98]"
            >
              {isToppingUp ? "Sending STK Push..." : "Top Up"}
            </button>
          </div>
        </div>
      )}


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