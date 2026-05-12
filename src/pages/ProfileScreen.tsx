import { useState, useEffect, useLayoutEffect, useRef, type ReactNode, type ChangeEvent } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "../contexts/AuthContext";
import {
  fetchYutoBalance,
  createHighlight,
  createWalletOffer,
  getFriends,
  getHighlightsByUser,
  getMyGroups,
  getPendingRequests,
  getOrCreateDmConversation,
  getSavedPhoneNumber,
  getUserListings,
  saveProfilePhoneNumber,
  sendDmMessage,
  sendDmShareMessage,
  uploadHighlightAsset,
  uploadAvatar,
  supabase,
  authFetch,
  type Highlight,
} from "../lib/supabase";
import UserAvatar from "../components/UserAvatar";
import { HighlightStillMedia, isHighlightVideoUrl } from "../components/highlights/HighlightStillMedia";
import { YutoBalanceTopUpModal } from "../components/wallet/YutoBalanceTopUpModal";
import { Wallet, History, Plus, Copy, Check, Send, Volume2, VolumeX, Store, ChevronDown, ArrowDownLeft, Sun, Moon } from "lucide-react";
import { ShareRecipientsSheet } from "../components/profile/ShareRecipientsSheet";
import { TransactionReceiptModal } from "../components/profile/TransactionReceiptModal";
import { useCountUp } from "../hooks/useCountUp";
import { toast } from "sonner";
import { haptics } from "../lib/haptics";
import {
  getUserHostedFunctions,
  getBusinessDashboard,
  updateFunctionListingStatus,
  cancelHostListing,
  duplicateFunction,
  type StorefrontListingItem,
  type HostedFunctionItem
} from "../lib/supabase";
import { useTheme } from "../contexts/ThemeContext";
import { FixedMediaCarousel } from "../components/media/FixedMediaCarousel";
import { ConfirmModal } from "../components/ConfirmModal";
import { HostFunctionDashboard } from "../components/profile/HostFunctionDashboard";
import { HostListingDashboard } from "../components/profile/HostListingDashboard";
import { EarningsTab } from "../components/profile/EarningsTab";

function ChevronRight() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

type TransactionRow = {
  id: string;
  user_id: string;
  amount: number | string;
  created_at: string;
  note: string | null;
  counterparty_id: string | null;
  kind: string | null;
  status?: string | null;
  method?: string | null;
  metadata?: Record<string, any> | null;
  counterparty?: {
    id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
};

const MIN_WITHDRAW_KES = 20;

function describeTransaction(tx: TransactionRow): { title: string; subtitle: string | null } {
  const cp = tx.counterparty;
  const name = cp ? (cp.display_name?.trim() || cp.username || "someone") : null;
  const note = tx.note?.trim() || null;
  const meta = tx.metadata || {};
  const fnTitle = (meta as any).function_title || (meta as any).plan_title || (meta as any).group_name || null;

  switch (tx.kind) {
    case "transfer_sent":
      return { title: name ? `Sent to ${name}` : "Sent", subtitle: note };
    case "transfer_received":
      return { title: name ? `Received from ${name}` : "Received", subtitle: note };
    case "wallet_offer_sent":
      return { title: name ? `Offer to ${name}` : "Wallet offer sent", subtitle: note ?? "Pending until claimed" };
    case "wallet_offer_received":
      return { title: name ? `Claimed from ${name}` : "Offer claimed", subtitle: note };
    case "topup":
    case "topup_completed":
    case "deposit":
      return { title: "Top-up via M-PESA", subtitle: note };
    case "withdrawal":
    case "withdraw":
      return { title: "Withdrawal to M-PESA", subtitle: note };
    case "split_paid":
    case "split_payment_sent":
      return { title: fnTitle ? `Paid split: ${fnTitle}` : (name ? `Paid split to ${name}` : "Split payment"), subtitle: note };
    case "split_received":
    case "split_payment_received":
      return { title: fnTitle ? `Split received: ${fnTitle}` : (name ? `Split paid by ${name}` : "Split received"), subtitle: note };
    case "function_payment_sent":
      return { title: fnTitle ? `Paid: ${fnTitle}` : "Function paid", subtitle: note };
    case "function_payment_received":
      return { title: fnTitle ? `Ticket sold: ${fnTitle}` : (name ? `Booking from ${name}` : "Booking received"), subtitle: note };
    case "function_group_payment_sent":
      return {
        title: fnTitle ? `Group buy: ${fnTitle}` : "Group ticket purchase",
        subtitle: (meta as any).ticket_count ? `${(meta as any).ticket_count} tickets` : note,
      };
    case "function_ticket_gifted":
      return { title: fnTitle ? `Gifted ticket: ${fnTitle}` : "Ticket gifted to you", subtitle: name ? `From ${name}` : note };
    case "purchase_sent":
      return { title: fnTitle ? `Bought: ${fnTitle}` : "Purchase", subtitle: note };
    case "purchase_received":
      return { title: fnTitle ? `Sale: ${fnTitle}` : (name ? `Sale to ${name}` : "Sale"), subtitle: note };
    case "booking_sent":
      return { title: fnTitle ? `Booked: ${fnTitle}` : "Booking", subtitle: note };
    case "booking_received":
      return { title: fnTitle ? `Booking: ${fnTitle}` : (name ? `Booking from ${name}` : "Booking received"), subtitle: note };
    case "referral_bonus":
      return { title: "Referral bonus", subtitle: note ?? (name ? `From ${name}'s first top-up` : null) };
    case "cancellation_refund":
      return { title: fnTitle ? `Refund: ${fnTitle}` : "Refund", subtitle: note ?? "Function was cancelled" };
    default:
      return {
        title: note || (Number(tx.amount) > 0 ? "Money in" : "Money out"),
        subtitle: tx.kind ? tx.kind.replace(/_/g, " ") : null,
      };
  }
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
        <div className={danger ? "text-red-500" : "text-black dark:text-white"}>{icon}</div>
        <div>
          <div className="flex items-center gap-2">
            <p className={`font-semibold text-[15px] ${danger ? "text-red-500" : "text-black dark:text-white"}`}>
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
  const { theme, toggleTheme } = useTheme();
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
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [receiptTx, setReceiptTx] = useState<TransactionRow | null>(null);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [withdrawError, setWithdrawError] = useState("");
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendFriends, setSendFriends] = useState<Array<{ id: string; username: string; display_name: string; avatar_url: string | null }>>([]);
  const [sendSelectedId, setSendSelectedId] = useState<string | null>(null);
  const [sendAmount, setSendAmount] = useState("");
  const [sendNote, setSendNote] = useState("");
  const [sendBusy, setSendBusy] = useState(false);
  const [sendError, setSendError] = useState("");

  // Confirm modal state (replaces native window.confirm)
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    confirmLabel?: string;
    danger?: boolean;
    onConfirm: () => void;
  } | null>(null);

  // Highlights (max 2, 2 photos each)
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [showHighlightCreate, setShowHighlightCreate] = useState(false);
  const [creatingHighlight, setCreatingHighlight] = useState(false);
  const [highlightFiles, setHighlightFiles] = useState<[File | null, File | null]>([null, null]);
  const [highlightPreviews, setHighlightPreviews] = useState<[string | null, string | null]>([null, null]);
  const [activeHighlight, setActiveHighlight] = useState<Highlight | null>(null);
  const [activeHighlightIdx, setActiveHighlightIdx] = useState<0 | 1>(0);
  const [activeHighlightMediaReady, setActiveHighlightMediaReady] = useState(false);
  const [highlightViewerMuted, setHighlightViewerMuted] = useState(true);
  const [shareHighlightOpen, setShareHighlightOpen] = useState(false);
  const [highlightReplyText, setHighlightReplyText] = useState("");
  const [highlightReplySending, setHighlightReplySending] = useState(false);
  const [highlightStickerOpen, setHighlightStickerOpen] = useState(false);
  const [highlightStickerListingId, setHighlightStickerListingId] = useState<string | null>(null);
  const highlightLongPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [highlightPendingDelete, setHighlightPendingDelete] = useState<string | null>(null);
  const [myListings, setMyListings] = useState<Array<{ id: string; title: string; kind: "sell" | "service"; amount_per_person: number }>>([]);
  const [ownListings, setOwnListings] = useState<StorefrontListingItem[]>([]);
  const [ownFunctions, setOwnHostedFunctions] = useState<HostedFunctionItem[]>([]);
  const [ownShowcaseTab, setOwnShowcaseTab] = useState<"profile" | "functions" | "sell" | "service">("profile");
  const [profileTopTab, setProfileTopTab] = useState<"profile" | "earnings">("profile");
  const [isHeaderDropdownOpen, setIsHeaderDropdownOpen] = useState(false);
  const [ownListingOptionsOpen, setOwnListingOptionsOpen] = useState<string | null>(null);
  const [expandedFunctionId, setExpandedFunctionId] = useState<string | null>(null);
  const [expandedListingId, setExpandedListingId] = useState<string | null>(null);
  const [bizDashboard, setBizDashboard] = useState<{
    revenueThisMonthKes: number;
    ordersThisMonth: number;
    activeListings: number;
    sellActive: number;
    serviceActive: number;
  } | null>(null);
  const animatedBalance = useCountUp(points, 1100);
  const prevBalanceRef = useRef<number | null>(null);
  const [balancePulse, setBalancePulse] = useState(false);


  useEffect(() => {
    if (prevBalanceRef.current === null) {
      prevBalanceRef.current = points;
      return;
    }
    if (points > prevBalanceRef.current) {
      setBalancePulse(true);
      haptics.success();
      const t = window.setTimeout(() => setBalancePulse(false), 1400);
      prevBalanceRef.current = points;
      return () => window.clearTimeout(t);
    }
    prevBalanceRef.current = points;
  }, [points]);

  const activeHighlightMediaKey =
    activeHighlight?.photos?.[activeHighlightIdx]?.url ? `${activeHighlight.id}:${activeHighlightIdx}:${activeHighlight.photos[activeHighlightIdx]!.url}` : "";

  useLayoutEffect(() => {
    // Prevent "previous image" lingering when switching items.
    setActiveHighlightMediaReady(false);
  }, [activeHighlightMediaKey]);

  useEffect(() => {
    return () => {
      if (highlightLongPressTimerRef.current) clearTimeout(highlightLongPressTimerRef.current);
    };
  }, []);
  const handleOpenHistory = async () => {
    setShowHistoryModal(true);
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from("transactions")
        .select("id, user_id, amount, created_at, note, counterparty_id, kind, status, method, metadata")
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      const rows = (data || []) as TransactionRow[];

      // Fetch counterparty profiles in one round-trip so we can render
      // "Sent to @sara" / "Received from @brian" instead of an empty row.
      const counterIds = Array.from(
        new Set(rows.map((r) => r.counterparty_id).filter((v): v is string => !!v)),
      );
      let profileMap: Record<string, NonNullable<TransactionRow["counterparty"]>> = {};
      if (counterIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url")
          .in("id", counterIds);
        for (const p of (profiles || []) as NonNullable<TransactionRow["counterparty"]>[]) {
          profileMap[p.id] = p;
        }
      }

      setTransactions(
        rows.map((r) => ({
          ...r,
          counterparty: r.counterparty_id ? profileMap[r.counterparty_id] || null : null,
        })),
      );
    } catch (err) {
      console.error("Failed to load history", err);
      toast.error("Couldn't load wallet history.");
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
    if (!amountNum || amountNum < MIN_WITHDRAW_KES) {
      setWithdrawError(`Minimum withdrawal is KSH ${MIN_WITHDRAW_KES}.`);
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
        p_amount: Math.round(amountNum)
      });

      if (dbError) throw new Error(dbError.message);

      // 2. Ping IntaSend B2C
      const res = await authFetch("/api/withdraw", {
        method: "POST",
        body: JSON.stringify({
          phone_number: phoneNumber,
          amount: amountNum,
          user_id: user.id,
          transaction_id: transactionId
        }),
      });

      const data = await res.json();

      if (data.success) {
        toast.success("Success! KSH " + amountNum + " has been sent to your M-PESA.");
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

        const [listingRows, hostedRows, dashData] = await Promise.all([
          getUserListings(user.id, user.id).catch(() => []),
          getUserHostedFunctions(user.id).catch(() => []),
          getBusinessDashboard(user.id).catch(() => null),
        ]);
        setOwnListings(listingRows as StorefrontListingItem[]);
        setOwnHostedFunctions(hostedRows as HostedFunctionItem[]);
        setBizDashboard(dashData);

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
    if (!showSendModal || !user) return;
    setSendSelectedId(null);
    setSendAmount("");
    setSendNote("");
    setSendBusy(false);
    setSendError("");
    getFriends(user.id)
      .then((data) => {
        const list = (data as any[]).map((f) => (f.requester_id === user.id ? f.addressee : f.requester));
        setSendFriends(list || []);
      })
      .catch(() => setSendFriends([]));
  }, [showSendModal, user]);

  useEffect(() => {
    if (!user) return;
    getHighlightsByUser(user.id)
      .then((rows) => setHighlights(rows))
      .catch(() => setHighlights([]));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    getUserListings(user.id)
      .then((rows) => setMyListings(rows as any))
      .catch(() => setMyListings([]));
  }, [user]);

  useEffect(() => {
    const st = location.state as { openHighlightId?: string; openTab?: string } | null;
    if (st?.openTab) {
      setOwnShowcaseTab(st.openTab as any);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
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
          toast.error("Please pick a video that is 30 seconds or less.");
          URL.revokeObjectURL(urlForPreview);
          return;
        }
      }
    } catch (err) {
      if (urlForPreview) URL.revokeObjectURL(urlForPreview);
      console.error(err);
      toast.error("Couldn't use that media file. Try again.");
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
      const listing = highlightStickerListingId ? myListings.find((l) => l.id === highlightStickerListingId) : null;
      const commercePayload =
        highlightStickerOpen && listing
          ? { function_id: listing.id, price_kes: listing.amount_per_person, kind: listing.kind }
          : null;
      await createHighlight(user.id, [a1, a2], commercePayload);
      const rows = await getHighlightsByUser(user.id);
      setHighlights(rows);
      setHighlightStickerOpen(false);
      setHighlightStickerListingId(null);
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
      toast.error(msg);
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

  // --- Compute Available Showcase Tabs ---
  // --- Compute Available Showcase Tabs ---
  const sellListings = ownListings.filter(l => l.kind === "sell");
  const serviceListings = ownListings.filter(l => l.kind === "service");

  // Always show all tabs — empty states guide users to create content
  const availableTabs: Array<{ id: "profile" | "functions" | "sell" | "service"; label: string }> = [
    { id: "profile", label: "Profile" },
    { id: "functions", label: "My Functions" },
    { id: "sell", label: "My Marketplace" },
    { id: "service", label: "My Services" },
  ];

  return (
    <div className="flex flex-col min-h-full px-5 pt-10 pb-6 bg-white dark:bg-black text-black dark:text-white transition-colors">
      {/* ── TOP LEVEL: Profile vs Earnings ── */}
      <div className="flex items-center justify-center mb-5">
        <div className="flex bg-gray-100 dark:bg-zinc-800 rounded-full p-1 w-[220px]">
          <button
            type="button"
            onClick={() => setProfileTopTab("profile")}
            className={`flex-1 py-2 rounded-full text-sm font-bold transition-colors border-none ${profileTopTab === "profile" ? "bg-white dark:bg-zinc-700 text-black dark:text-white shadow-sm" : "bg-transparent text-gray-500 dark:text-gray-400"}`}
          >
            Profile
          </button>
          <button
            type="button"
            onClick={() => setProfileTopTab("earnings")}
            className={`flex-1 py-2 rounded-full text-sm font-bold transition-colors border-none ${profileTopTab === "earnings" ? "bg-white dark:bg-zinc-700 text-black dark:text-white shadow-sm" : "bg-transparent text-gray-500 dark:text-gray-400"}`}
          >
            Earnings
          </button>
        </div>
      </div>

      {profileTopTab === "earnings" ? (
        <EarningsTab userId={user?.id || ""} username={profile?.username || ""} displayName={profile?.display_name || ""} />
      ) : (
      <>
      {/* ── HEADER & VIEW SWITCHER ── */}
      <div className="flex items-center justify-between mb-6 relative z-50">
        {availableTabs.length > 1 ? (
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsHeaderDropdownOpen(!isHeaderDropdownOpen)}
              className="flex items-center gap-1.5 bg-transparent border-none p-0 cursor-pointer"
            >
              <span className="text-2xl font-bold text-black dark:text-white">
                {availableTabs.find(t => t.id === ownShowcaseTab)?.label || "Profile"}
              </span>
              <ChevronDown size={22} className={`text-black dark:text-white transition-transform duration-200 ${isHeaderDropdownOpen ? "rotate-180" : ""}`} />
            </button>

            {isHeaderDropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsHeaderDropdownOpen(false)} />
                <div className="absolute top-8 left-0 mt-2 w-48 bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-gray-100 dark:border-zinc-800 overflow-hidden z-50 py-2 animate-in fade-in slide-in-from-top-2">
                  <div className="px-4 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
                    Switch View
                  </div>
                  {availableTabs.map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setOwnShowcaseTab(t.id);
                        setIsHeaderDropdownOpen(false);
                      }}
                      className={`w-full text-left px-4 py-3 text-sm font-extrabold transition-colors border-none ${ownShowcaseTab === t.id ? "bg-gray-50 dark:bg-zinc-800 text-black dark:text-white" : "bg-white dark:bg-zinc-900 text-gray-500 hover:bg-gray-50 dark:hover:bg-zinc-800 hover:text-black dark:hover:text-white"
                        }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        ) : (
          <span className="text-2xl font-bold text-black dark:text-white">Profile</span>
        )}

        {/* Dark mode toggle */}
        <button
          onClick={toggleTheme}
          className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-zinc-800 flex items-center justify-center text-black dark:text-white transition-all tap-scale hover:bg-gray-200 dark:hover:bg-zinc-700 border-none"
          aria-label="Toggle theme"
        >
          {theme === "light" ? <Moon size={20} strokeWidth={2.5} /> : <Sun size={20} strokeWidth={2.5} />}
        </button>
      </div>

      {/* ── MAIN CONTENT SWITCHER ── */}
      {ownShowcaseTab === "profile" ? (
        <>
          {/* Radial graph */}
          <div className="relative w-full max-w-[380px] mx-auto flex-shrink-0" style={{ height: 380 }}>
            <svg
              className="absolute inset-0 w-full h-full"
              viewBox="0 0 380 380"
              preserveAspectRatio="xMidYMid meet"
              style={{ zIndex: 1 }}
            >
              <circle cx={cx} cy={cy} r="85" fill="none" stroke={theme === "dark" ? "#27272a" : "#f0f0f0"} strokeWidth="1" />
              <circle
                cx={cx}
                cy={cy}
                r="135"
                fill="none"
                stroke={theme === "dark" ? "#27272a" : "#f0f0f0"}
                strokeWidth="1"
                strokeDasharray="4 6"
                style={{ animation: "orbitSpin 60s linear infinite", transformOrigin: "190px 190px" }}
              />
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
                      stroke={theme === "dark" ? "#27272a" : "#d1d5db"}
                      strokeWidth="2"
                      strokeDasharray="7 5"
                      strokeLinecap="round"
                      className="graph-line-flowing"
                    />
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
                  className={`w-[100px] h-[100px] rounded-full flex items-center justify-center overflow-hidden border-[3px] transition-all ${stats.totalSpent > 0 ? "border-green-500" : "border-gray-300"
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
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
              </div>
            </div>

            {/* Stat nodes */}
            {STAT_POSITIONS.map((pos) => {
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
                  style={{ transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`, zIndex: 20 }}
                >
                  <div className={`rounded-2xl px-5 py-3 text-center min-w-[88px] transition-colors ${isPaid ? "bg-black text-green-400 border-2 border-green-500 shadow-lg" : "bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 shadow-sm"}`}>
                    <p className={`font-extrabold text-xl font-syne ${isPaid ? "text-green-400" : "text-black dark:text-white"}`}>{value}</p>
                    <p className={`text-xs mt-0.5 ${isPaid ? "text-white/70" : "text-gray-400 dark:text-gray-500"}`}>{pos.label}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Name + handle */}
          <div className="text-center -mt-2 mb-3">
            <p className="font-bold text-xl text-black dark:text-white">{userName}</p>
            <p className="text-sm text-gray-400 dark:text-gray-500">{userHandle}</p>
          </div>

          {/* Highlights */}
          <div className="flex items-center justify-center gap-4 mb-6">
            {highlights.length < 2 && (
              <button type="button" onClick={() => setShowHighlightCreate(true)} className="w-16 h-16 rounded-full border-2 border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-black dark:text-white flex items-center justify-center shadow-sm">
                <Plus size={22} />
              </button>
            )}
            {highlights.length > 0 && (
              <div className="flex items-center justify-center gap-4">
                {highlights.slice(0, 2).map((h) => (
                  <div key={h.id} className="flex flex-col items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        if (highlightPendingDelete === h.id) { setHighlightPendingDelete(null); return; }
                        setActiveHighlightIdx(0);
                        setActiveHighlightMediaReady(false);
                        setHighlightViewerMuted(true);
                        setActiveHighlight(h);
                      }}
                      onPointerDown={() => {
                        if (highlightLongPressTimerRef.current) clearTimeout(highlightLongPressTimerRef.current);
                        highlightLongPressTimerRef.current = setTimeout(() => setHighlightPendingDelete(h.id), 550);
                      }}
                      onPointerUp={() => { if (highlightLongPressTimerRef.current) { clearTimeout(highlightLongPressTimerRef.current); highlightLongPressTimerRef.current = null; } }}
                      onPointerLeave={() => { if (highlightLongPressTimerRef.current) { clearTimeout(highlightLongPressTimerRef.current); highlightLongPressTimerRef.current = null; } }}
                      className="bg-transparent border-none p-0"
                    >
                      <motion.div layoutId={`highlight-container-${h.id}`} style={{ borderRadius: 9999 }} className="relative w-16 h-16 shrink-0 border-2 border-gray-200 dark:border-zinc-800 overflow-hidden bg-gray-100 dark:bg-zinc-800">
                        {h.photos[0]?.url ? <HighlightStillMedia url={(h.photos[0].thumb_url || h.photos[0].poster_url || h.photos[0].url) as string} className="absolute inset-0 h-full w-full object-cover pointer-events-none" /> : null}
                      </motion.div>
                    </button>
                    {highlightPendingDelete === h.id && (
                      <button type="button" className="text-[11px] font-bold text-red-500 bg-transparent border-none p-0" onClick={async () => {
                        try { await supabase.from("highlights").delete().eq("id", h.id); setHighlights(prev => prev.filter(x => x.id !== h.id)); } catch (e) { console.error(e); } finally { setHighlightPendingDelete(null); }
                      }}>Delete</button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Yuto Wallet Card */}
          <div className="bg-black rounded-3xl p-6 text-white mb-6 relative overflow-hidden shadow-lg">
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-3xl pointer-events-none" />
            <div className="relative z-10 mb-5">
              <div className="absolute left-0 top-0"><Wallet size={16} className="text-white/70" /></div>
              <div className="flex items-center justify-center gap-6 text-base font-extrabold">
                <button type="button" onClick={() => setWalletTab("balance")} className={`bg-transparent border-none p-0 transition-colors ${walletTab === "balance" ? "text-white" : "text-white/40"}`}>Balance</button>
                <button type="button" onClick={() => setWalletTab("points")} className={`bg-transparent border-none p-0 transition-colors ${walletTab === "points" ? "text-white" : "text-white/40"}`}>Points</button>
              </div>
            </div>

            {walletTab === "balance" ? (
              <div className="relative z-10">
                <div className="flex items-end justify-center pr-12">
                  <div className={`text-center transition-all duration-300 ${balancePulse ? "scale-105" : "scale-100"}`}>
                    <span className="text-gray-400 text-lg font-medium mr-1">KSH</span>
                    <span className={`text-4xl font-bold tracking-tight transition-colors duration-500 ${balancePulse ? "text-green-400" : "text-white"}`}>
                      {animatedBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
                <button onClick={() => setShowTopUpModal(true)} className="absolute right-0 top-1/2 -translate-y-1/2 w-10 h-10 bg-white text-black rounded-full flex items-center justify-center hover:scale-105 transition-transform shadow-md"><Plus size={20} strokeWidth={3} /></button>
              </div>
            ) : (
              <div className="relative z-10">
                <div className="text-center">
                  <span className="text-white/70 text-sm font-semibold">Earned</span>
                  <div className="mt-1">
                    <span className="text-white/60 text-lg font-medium mr-1">KSH</span>
                    <span className="text-5xl font-bold tracking-tight">{referralEarned.toLocaleString()}</span>
                  </div>
                  <p className="text-xs text-white/55 mt-2">{referralCount} converted</p>
                </div>
                <p className="text-xs text-white/60 mt-4">Earn <span className="text-white font-semibold">KSH 10</span> when a new user signs up with your link and tops up for the first time.</p>
                {profile?.username && (
                  <div className="mt-4 flex gap-2">
                    <button type="button" onClick={() => {
                      const text = `Join me on Yuto — the social payment app for Kenyan youth 🇰🇪\n\nSplit bills, host events, sell stuff, all with M-PESA.\n\n${inviteUrl}`;
                      const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
                      window.open(waUrl, "_blank");
                    }} className="flex-1 flex justify-center items-center gap-1.5 bg-green-500 text-white py-3 rounded-xl text-sm font-bold transition-colors active:bg-green-600">
                      <Send size={16} /> Send via WhatsApp
                    </button>
                    <button type="button" onClick={handleCopyInvite} className="flex-1 flex justify-center items-center gap-1.5 bg-white/10 text-white py-3 rounded-xl text-sm font-bold transition-colors active:bg-white/20">
                      {copiedLink ? <Check size={16} /> : <Copy size={16} />} {copiedLink ? "Copied!" : "Copy"}
                    </button>
                  </div>
                )}
              </div>
            )}

            {walletTab === "balance" && (
              <div className="relative z-10 mt-5">
                <div className="flex justify-center gap-3">
                  <button onClick={() => setShowWithdrawModal(true)} className="text-sm font-bold bg-white text-black hover:bg-gray-200 transition-colors px-4 py-2 rounded-full flex items-center gap-1.5 shadow-sm">Cash Out</button>
                  <button onClick={handleOpenHistory} className="text-sm font-bold bg-white/10 hover:bg-white/20 transition-colors px-4 py-2 rounded-full flex items-center gap-1.5"><History size={12} /> History</button>
                </div>
                <div className="mt-3 flex justify-center">
                  <button type="button" onClick={() => setShowSendModal(true)} className="w-full max-w-[360px] h-12 rounded-2xl bg-white text-black font-extrabold shadow-sm hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"><Send size={14} /> Send</button>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-4 mb-5 shadow-[0_8px_24px_rgba(0,0,0,0.04)]">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div>
                <p className="text-sm font-semibold text-black dark:text-white">M-PESA number</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Used to prefill payment prompts on this device.</p>
              </div>
              <span className="text-[10px] uppercase tracking-[0.2em] text-gray-400 mt-1">Saved</span>
            </div>
            <div className="flex gap-2">
              <input type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ""))} placeholder="254712345678" maxLength={12} className="flex-1 h-12 border border-gray-300 dark:border-zinc-700 dark:bg-zinc-800 rounded-full px-4 text-base outline-none focus:border-black dark:focus:border-white text-black dark:text-white transition-colors" />
              <button type="button" onClick={handleSavePhone} disabled={savingPhone} className="h-12 px-5 rounded-full bg-black dark:bg-white text-white dark:text-black font-semibold disabled:opacity-60 disabled:cursor-not-allowed">
                {savingPhone ? "Saving" : "Save"}
              </button>
            </div>
            {phoneMessage && <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 ml-1">{phoneMessage}</p>}
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl px-5 divide-y divide-gray-100 dark:divide-zinc-800">
            <MenuItem
              icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>}
              label="Friends"
              sublabel={pendingCount > 0 ? `${pendingCount} pending request${pendingCount > 1 ? "s" : ""}` : `${stats.friendsCount} friends`}
              badge={pendingCount}
              onClick={() => navigate("/friends")}
            />
            <MenuItem
              icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>}
              label="Split History"
              sublabel="View past splits"
              onClick={() => navigate("/activity")}
            />
            <MenuItem
              icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="red" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>}
              label="Log Out"
              danger
              onClick={handleLogout}
            />
          </div>
        </>
      ) : (
        /* ── BACK OFFICE VIEWS (Functions, Sell, Service) ── */
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
          {ownShowcaseTab === "functions" && (
            <div className="space-y-4">
              {/* Revenue mini-dashboard — always visible */}
              <div className="bg-black dark:bg-zinc-900 rounded-2xl p-5 text-white mb-2">
                <p className="text-xs text-white/50 font-semibold uppercase tracking-wider mb-2">This month</p>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-white/50 text-sm">KSH</span>
                    <span className="text-3xl font-bold ml-1">{(bizDashboard?.revenueThisMonthKes || 0).toLocaleString()}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold">{bizDashboard?.ordersThisMonth || 0}</p>
                    <p className="text-xs text-white/50">tickets sold</p>
                  </div>
                </div>
              </div>

              {ownFunctions.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-gray-400 dark:text-gray-500 text-sm mb-2">No functions yet</p>
                  <p className="text-gray-500 dark:text-gray-400 text-xs">Create your first function from the Home feed</p>
                </div>
              )}
              {ownFunctions.map(fn => (
                <div key={fn.id} className="flex flex-col p-4 rounded-3xl border border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm relative overflow-hidden">

                  {/* Functions 3-Dot Menu */}
                  <button
                    type="button"
                    onClick={() => setOwnListingOptionsOpen(ownListingOptionsOpen === fn.id ? null : fn.id)}
                    className="absolute top-3 right-3 z-20 w-8 h-8 rounded-full bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-400 flex items-center justify-center border-none hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors"
                  >
                    <span className="text-lg font-bold mb-2">...</span>
                  </button>

                  {ownListingOptionsOpen === fn.id && (
                    <>
                      <div className="fixed inset-0 z-20 cursor-default" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOwnListingOptionsOpen(null); }} />
                      <div className="absolute top-12 right-3 z-30 w-44 bg-white dark:bg-zinc-900 rounded-xl shadow-xl border border-gray-100 dark:border-zinc-700 overflow-hidden flex flex-col py-1">
                        {fn.status !== "cancelled" && (
                          <button type="button" onClick={() => {
                            setOwnListingOptionsOpen(null);
                            setConfirmModal({
                              title: "Cancel this event?",
                              message: "All guests will be notified and refunded to their Yuto Balance. This can't be undone.",
                              confirmLabel: "Cancel Event",
                              danger: true,
                              onConfirm: async () => {
                                setConfirmModal(null);
                                try {
                                  // Call the proper cancel API — this issues refunds + push notifications
                                  const res = await authFetch("/api/cancel-function", {
                                    method: "POST",
                                    body: JSON.stringify({ function_id: fn.id, host_id: user?.id }),
                                  });
                                  const data = await res.json();
                                  if (!res.ok) throw new Error(data.message || "Couldn't cancel event");
                                  setOwnHostedFunctions(prev => prev.map(f => f.id === fn.id ? { ...f, status: "cancelled" } as any : f));
                                  toast.success(`Event cancelled. ${data.refunded > 0 ? `${data.refunded} attendee${data.refunded === 1 ? "" : "s"} refunded.` : ""}`);
                                } catch (e: any) { toast.error(e?.message || "Couldn't cancel event"); }
                              },
                            });
                          }} className="px-4 py-2 text-sm font-bold text-left text-black dark:text-white hover:bg-gray-50 dark:hover:bg-zinc-800 border-none bg-transparent dark:bg-zinc-900">
                            Cancel Event
                          </button>
                        )}
                        <div className="h-px bg-gray-100 dark:bg-zinc-800 my-1 mx-2" />
                        <button type="button" onClick={() => {
                          setOwnListingOptionsOpen(null);
                          setConfirmModal({
                            title: "Delete this event?",
                            message: "If anyone has paid, they'll be refunded first. The event will be permanently removed.",
                            confirmLabel: "Delete",
                            danger: true,
                            onConfirm: async () => {
                              setConfirmModal(null);
                              try {
                                // Cancel first (refunds attendees + debits host) if not already cancelled
                                if (fn.status !== "cancelled") {
                                  const cancelRes = await authFetch("/api/cancel-function", {
                                    method: "POST",
                                    body: JSON.stringify({ function_id: fn.id, host_id: user?.id }),
                                  });
                                  if (!cancelRes.ok) {
                                    const err = await cancelRes.json();
                                    throw new Error(err.message || "Couldn't cancel before delete");
                                  }
                                }
                                // Then delete
                                await supabase.from("functions").delete().eq("id", fn.id);
                                setOwnHostedFunctions(prev => prev.filter(f => f.id !== fn.id));
                                toast.success("Event deleted");
                              } catch (e: any) { toast.error(e?.message || "Couldn't delete event"); }
                            },
                          });
                        }} className="px-4 py-2 text-sm font-bold text-red-600 text-left hover:bg-gray-50 dark:hover:bg-zinc-800 border-none bg-transparent dark:bg-zinc-900">
                          Delete
                        </button>
                      </div>
                    </>
                  )}

                  <div className="flex gap-4">
                    <div className="w-20 h-20 rounded-2xl bg-gray-100 dark:bg-zinc-800 overflow-hidden shrink-0 relative">
                      {fn.image_url ? (
                        <img src={fn.image_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-gray-300 dark:text-gray-600">
                          <Store size={22} />
                        </div>
                      )}
                      {fn.status === "cancelled" && (
                        <div className="absolute inset-0 bg-black/60 z-10 flex items-center justify-center backdrop-blur-[1px]">
                          <span className="px-2 py-1 bg-white text-black font-extrabold text-[10px] uppercase tracking-widest rounded-md -rotate-12">
                            DEAD
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1 py-0.5 pr-6">
                      <p className={`font-extrabold text-lg truncate ${fn.status === "cancelled" ? "text-gray-400 line-through" : "text-black dark:text-white"}`}>{fn.title}</p>
                      <p className="text-sm text-gray-400 dark:text-gray-500 font-semibold truncate mt-0.5">
                        {fn.date ? new Date(fn.date).toLocaleDateString("en-KE", { weekday: "short", month: "short", day: "numeric" }) : "Anytime"}
                        {fn.location ? ` · ${fn.location}` : ""}
                      </p>
                      <p className="text-sm font-black text-black dark:text-white mt-2">KSH {fn.amount_per_person.toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-50 dark:border-zinc-800 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setExpandedFunctionId(fn.id)}
                      className="flex-[1.5] h-10 rounded-xl bg-gray-100 dark:bg-zinc-800 text-black dark:text-white border-none font-extrabold text-sm hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors"
                    >
                      Attendees & Q&A
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const shareOrigin = window.location.hostname === "localhost" || window.location.hostname.startsWith("127.") ? window.location.origin : "https://yuto.social";
                        const link = `${shareOrigin}/f/\$\{fn.id\}`;
                        if (navigator.share) navigator.share({ title: fn.title, url: link });
                        else { navigator.clipboard.writeText(link); toast.success("Link copied!"); }
                      }}
                      className="flex-1 h-10 rounded-xl bg-gray-100 dark:bg-zinc-800 text-black dark:text-white border-none font-extrabold text-sm hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors flex items-center justify-center gap-1.5"
                    >
                      Share
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!user) return;
                        try {
                          await duplicateFunction(user.id, fn.id, 7);
                          toast.success("Duplicated for next week!");
                          const rows = await getUserHostedFunctions(user.id);
                          setOwnHostedFunctions(rows as HostedFunctionItem[]);
                        } catch (e: any) { toast.error(e?.message || "Couldn't duplicate"); }
                      }}
                      className="flex-1 h-10 rounded-xl bg-black dark:bg-white border-none text-white dark:text-black font-extrabold text-sm hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
                    >
                      Run again
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {(ownShowcaseTab === "sell" || ownShowcaseTab === "service") && (() => {
            const listings = ownShowcaseTab === "sell" ? sellListings : serviceListings;
            const tabRevenue = bizDashboard ? bizDashboard.revenueThisMonthKes : 0;
            const tabOrders = bizDashboard ? bizDashboard.ordersThisMonth : 0;
            if (listings.length === 0) {
              return (
                <div className="text-center py-16 px-6">
                  <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-zinc-800 mx-auto flex items-center justify-center mb-4">
                    <Store size={28} className="text-gray-300 dark:text-gray-600" />
                  </div>
                  <p className="font-bold text-black dark:text-white text-lg mb-2">
                    {ownShowcaseTab === "sell" ? "No listings yet" : "No services yet"}
                  </p>
                  <p className="text-gray-400 dark:text-gray-500 text-sm mb-6 max-w-[260px] mx-auto">
                    {ownShowcaseTab === "sell"
                      ? "Start selling on Yuto — list anything from food to fashion. Your friends see it first."
                      : "Offer your skills on Yuto — photography, tutoring, braids, anything. Get booked and paid instantly."}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      navigate("/home", { state: { openCompose: true, composeMode: ownShowcaseTab === "sell" ? "sell" : "service" } });
                    }}
                    className="px-6 py-3 bg-black dark:bg-white text-white dark:text-black rounded-2xl font-bold text-sm"
                  >
                    {ownShowcaseTab === "sell" ? "Create a listing" : "Offer a service"}
                  </button>
                </div>
              );
            }
            return (
              <div className="flex flex-col gap-6">
                {/* Revenue mini-dashboard — always visible */}
                <div className="bg-black dark:bg-zinc-900 rounded-2xl p-5 text-white">
                  <p className="text-xs text-white/50 font-semibold uppercase tracking-wider mb-2">This month</p>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-white/50 text-sm">KSH</span>
                      <span className="text-3xl font-bold ml-1">{tabRevenue.toLocaleString()}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold">{tabOrders}</p>
                      <p className="text-xs text-white/50">orders</p>
                    </div>
                  </div>
                </div>
                {listings.map(listing => (
                  <div key={listing.id} className="rounded-3xl border border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-md overflow-hidden relative">
                    <div className="relative">
                      {listing.media.length > 0 || listing.image_url ? (
                        <FixedMediaCarousel
                          items={(listing.media.length > 0 ? listing.media : [{ id: "", media_url: listing.image_url!, media_type: "image", sort_index: 0 }])
                            .map(m => ({ url: m.media_url, type: String(m.media_type || "").startsWith("video") ? "video" as const : "image" as const }))}
                        />
                      ) : (
                        <div className="aspect-[4/5] bg-gray-100 flex items-center justify-center text-gray-300">
                          <Store size={34} />
                        </div>
                      )}

                      {listing.listing_status && listing.listing_status !== "active" && (
                        <div className="absolute inset-0 bg-black/50 z-10 flex items-center justify-center backdrop-blur-[2px]">
                          <span className="px-4 py-2 bg-white text-black font-extrabold text-lg uppercase tracking-widest rounded-xl -rotate-6">
                            {listing.listing_status === "sold" ? "SOLD" : "PAUSED"}
                          </span>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => setOwnListingOptionsOpen(ownListingOptionsOpen === listing.id ? null : listing.id)}
                        className="absolute top-3 right-3 z-20 w-10 h-10 rounded-full bg-black/60 text-white flex items-center justify-center border-none"
                      >
                        <span className="text-xl font-bold mb-1.5">...</span>
                      </button>

                      {ownListingOptionsOpen === listing.id && (
                        <>
                          <div className="fixed inset-0 z-20 cursor-default" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOwnListingOptionsOpen(null); }} />
                          <div className="absolute top-14 right-3 z-30 w-36 bg-white dark:bg-zinc-900 rounded-xl shadow-xl border border-gray-100 dark:border-zinc-700 overflow-hidden flex flex-col py-1">
                            {listing.listing_status !== "active" && (
                              <button type="button" onClick={async () => { await updateFunctionListingStatus(user!.id, listing.id, "active"); setOwnListings(prev => prev.map(l => l.id === listing.id ? { ...l, listing_status: "active" } : l)); setOwnListingOptionsOpen(null); toast.success("Re-listed!"); }} className="px-4 py-2 text-sm font-bold text-left hover:bg-gray-50 border-none bg-transparent">Re-list</button>
                            )}
                            {listing.listing_status !== "sold" && (
                              <button type="button" onClick={async () => { await updateFunctionListingStatus(user!.id, listing.id, "sold"); setOwnListings(prev => prev.map(l => l.id === listing.id ? { ...l, listing_status: "sold" } : l)); setOwnListingOptionsOpen(null); toast.success("Marked sold!"); }} className="px-4 py-2 text-sm font-bold text-left text-black dark:text-white hover:bg-gray-50 dark:hover:bg-zinc-800 border-none bg-transparent dark:bg-zinc-900">Mark Sold</button>
                            )}
                            {listing.listing_status !== "paused" && (
                              <button type="button" onClick={async () => { await updateFunctionListingStatus(user!.id, listing.id, "paused"); setOwnListings(prev => prev.map(l => l.id === listing.id ? { ...l, listing_status: "paused" } : l)); setOwnListingOptionsOpen(null); toast.success("Paused!"); }} className="px-4 py-2 text-sm font-bold text-left hover:bg-gray-50 border-none bg-transparent">Pause</button>
                            )}
                            <div className="h-px bg-gray-100 my-1 mx-2" />
                            <button type="button" onClick={() => { setOwnListingOptionsOpen(null); setConfirmModal({ title: "Delete this listing?", message: "This will permanently remove the listing. Buyers who already paid won't be affected.", confirmLabel: "Delete", danger: true, onConfirm: async () => { setConfirmModal(null); await cancelHostListing(user!.id, listing.id); setOwnListings(prev => prev.filter(l => l.id !== listing.id)); toast.success("Deleted"); } }); }} className="px-4 py-2 text-sm font-bold text-red-600 text-left hover:bg-gray-50 dark:hover:bg-zinc-800 border-none bg-transparent dark:bg-zinc-900">Delete</button>
                          </div>
                        </>
                      )}
                    </div>
                    <div className="p-4">
                      <p className="font-extrabold text-black dark:text-white text-lg">{listing.title}</p>
                      <p className="text-base font-black mt-1 text-black dark:text-white">KSH {listing.amount_per_person.toLocaleString()}</p>
                      <p className="text-sm text-gray-400 mt-1 font-semibold">{listing.kind === "sell" ? "Storefront Listing" : "Service Booking"}</p>
                      <button
                        type="button"
                        onClick={() => setExpandedListingId(listing.id)}
                        className="mt-3 w-full py-2.5 rounded-xl bg-gray-100 dark:bg-zinc-800 text-black dark:text-white font-bold text-sm border-none hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors"
                      >
                        {listing.kind === "sell" ? "Buyers & Inquiries" : "Bookings & Inquiries"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      </>
      )}

      {/* ── GLOBAL MODALS & OVERLAYS ── */}
      {expandedFunctionId && user && (() => {
        const fn = ownFunctions.find(f => f.id === expandedFunctionId);
        if (!fn) return null;
        return <HostFunctionDashboard fn={fn} userId={user.id} onClose={() => setExpandedFunctionId(null)} />;
      })()}
      {expandedListingId && user && (() => {
        const listing = ownListings.find(l => l.id === expandedListingId);
        if (!listing) return null;
        return <HostListingDashboard listing={listing} userId={user.id} onClose={() => setExpandedListingId(null)} />;
      })()}
      <ConfirmModal
        open={!!confirmModal}
        title={confirmModal?.title || ""}
        message={confirmModal?.message || ""}
        confirmLabel={confirmModal?.confirmLabel}
        danger={confirmModal?.danger}
        onConfirm={() => confirmModal?.onConfirm()}
        onCancel={() => setConfirmModal(null)}
      />
      {showTopUpModal && user && (
        <YutoBalanceTopUpModal open={showTopUpModal} onClose={() => setShowTopUpModal(false)} userId={user.id} mpesaPhoneNumber={phoneNumber} />
      )}

      {showHistoryModal && (
        <div className="fixed inset-0 bg-black/60 flex items-end md:items-center justify-center z-50 fade-in">
          <div className="bg-white dark:bg-zinc-900 rounded-t-3xl md:rounded-3xl w-full max-w-md h-[75vh] md:h-[600px] flex flex-col overflow-hidden modal-slide-up">
            <div className="flex justify-between items-center p-6 border-b border-gray-100 dark:border-zinc-800 shrink-0">
              <h2 className="font-bold text-xl text-black dark:text-white">Wallet History</h2>
              <button onClick={() => setShowHistoryModal(false)} className="text-2xl text-gray-400 hover:text-black dark:hover:text-white bg-transparent border-none">✕</button>
            </div>
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
                <div className="space-y-4">
                  {transactions.map((tx) => {
                    const isPositive = Number(tx.amount) > 0;
                    const isSplitReceived = tx.kind === "split_payment_received" || tx.kind === "split_received";
                    const { title, subtitle } = describeTransaction(tx);
                    const cp = tx.counterparty;
                    return (
                      <button key={tx.id} type="button" onClick={() => setReceiptTx(tx)} className="w-full flex justify-between items-center text-left bg-transparent border-none p-0 cursor-pointer hover:opacity-80 transition-opacity">
                        <div className="flex items-center gap-3 min-w-0">
                          {cp ? (
                            <UserAvatar name={cp.display_name || cp.username || "?"} avatarUrl={cp.avatar_url} size="md" />
                          ) : (
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isPositive ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-600'}`}>
                              {isSplitReceived ? (
                                <ArrowDownLeft size={16} strokeWidth={3} />
                              ) : isPositive ? (
                                <Plus size={16} strokeWidth={3} />
                              ) : (
                                <span className="font-bold text-lg leading-none mb-1">-</span>
                              )}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-semibold text-sm text-black dark:text-white truncate">{title}</p>
                            <p className="text-xs text-gray-400 truncate">{subtitle ? `${subtitle} · ` : ""}{new Date(tx.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                          </div>
                        </div>
                        <span className={`font-bold text-sm shrink-0 ml-3 ${isPositive ? 'text-green-600' : 'text-black'}`}>
                          {isPositive ? '+' : '-'}KSH {Math.abs(Number(tx.amount)).toLocaleString()}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {receiptTx && (
        <TransactionReceiptModal tx={receiptTx} describe={(tx) => describeTransaction(tx as TransactionRow)} ownerName={profile?.display_name?.trim() || profile?.username?.trim() || "Yuto user"} onClose={() => setReceiptTx(null)} />
      )}

      {showWithdrawModal && (
        <div className="fixed inset-0 bg-black/60 flex items-end md:items-center justify-center z-50 fade-in">
          <div className="bg-white dark:bg-zinc-900 rounded-t-3xl md:rounded-3xl w-full max-w-md p-6 modal-slide-up">
            <div className="flex justify-between items-center mb-5">
              <h2 className="font-bold text-xl text-black dark:text-white">Withdraw to M-PESA</h2>
              <button onClick={() => setShowWithdrawModal(false)} className="text-2xl text-gray-400 hover:text-black dark:hover:text-white bg-transparent border-none">✕</button>
            </div>
            <div className="mb-6 flex flex-col items-center w-full">
              <span className="text-sm text-gray-400 font-semibold mb-2 uppercase tracking-wide">Amount (KSH)</span>
              <input type="text" inputMode="numeric" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value.replace(/\D/g, ""))} placeholder="0" className="text-[48px] font-bold text-center text-black dark:text-white bg-transparent border-none outline-none w-full mb-2" />
              <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mb-4">Available: KSH {points.toLocaleString()}</p>
              <div className="flex gap-2 w-full mb-2">
                {[MIN_WITHDRAW_KES, 500, 'MAX'].map((preset) => (
                  <button key={preset} onClick={() => setWithdrawAmount(preset === 'MAX' ? points.toString() : preset.toString())} className="flex-1 py-3 rounded-2xl font-bold text-sm bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors active:scale-95">
                    {preset === 'MAX' ? 'MAX' : `+${preset}`}
                  </button>
                ))}
              </div>
            </div>
            {withdrawError && <p className="text-sm text-center font-medium mb-4 text-red-500">{withdrawError}</p>}
            <button onClick={handleWithdraw} disabled={isWithdrawing || !withdrawAmount || parseInt(withdrawAmount) > points} className="w-full py-4 bg-black dark:bg-white text-white dark:text-black rounded-full font-bold text-lg disabled:opacity-50 transition-all active:scale-[0.98]">
              {isWithdrawing ? "Processing..." : "Withdraw"}
            </button>
          </div>
        </div>
      )}

      {showSendModal && user && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center fade-in bg-black/60 backdrop-blur-sm">
          <button type="button" className="absolute inset-0 z-0 cursor-default border-none bg-transparent" aria-label="Dismiss" onClick={() => setShowSendModal(false)} />
          <div className="relative z-10 bg-white dark:bg-zinc-900 rounded-t-3xl md:rounded-3xl w-full max-w-md p-6 modal-slide-up">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-bold text-xl text-black dark:text-white">Send</h2>
              <button onClick={() => setShowSendModal(false)} className="text-2xl text-gray-400 hover:text-black dark:hover:text-white bg-transparent border-none">✕</button>
            </div>
            <div className="rounded-3xl border border-gray-200 dark:border-zinc-800 p-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Amount (KSH)</p>
              <input inputMode="numeric" value={sendAmount} onChange={(e) => setSendAmount(e.target.value.replace(/[^\d]/g, ""))} placeholder="500" className="w-full text-4xl font-black tracking-tight outline-none border-none bg-transparent text-black dark:text-white" />
              <p className="text-xs text-gray-500 mt-1 font-semibold">Available: KSH {points.toLocaleString("en-KE")}</p>
              <div className="mt-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">To</p>
                <div className="flex flex-wrap gap-3">
                  {sendFriends.map((fr) => (
                    <button key={fr.id} type="button" onClick={() => setSendSelectedId(fr.id)} className={`flex items-center gap-2 px-4 py-2.5 rounded-full border-2 transition-all tap-scale ${sendSelectedId === fr.id ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black" : "border-gray-200 bg-white text-black dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"}`}>
                      <UserAvatar name={fr.display_name} avatarUrl={fr.avatar_url} size="sm" />
                      <span className="text-sm font-bold">{fr.display_name}</span>
                    </button>
                  ))}
                  {sendFriends.length === 0 && <p className="text-sm text-gray-400">No friends yet.</p>}
                </div>
              </div>
              <div className="mt-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Note (optional)</p>
                <input value={sendNote} onChange={(e) => setSendNote(e.target.value)} placeholder="For lunch…" maxLength={60} className="w-full h-12 rounded-2xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-black dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 px-4 text-sm outline-none focus:border-black dark:focus:border-white transition-colors" />
              </div>
            </div>
            {sendError && <p className="text-red-500 text-sm text-center mt-3">{sendError}</p>}
            <button type="button" disabled={sendBusy || !sendSelectedId || !sendAmount || Number(sendAmount || 0) > points} onClick={async () => {
              if (!sendSelectedId) return;
              const amt = Number(sendAmount || 0);
              if (!Number.isFinite(amt) || amt <= 0) return;
              setSendBusy(true); setSendError("");
              try {
                if (!user) return;
                const convo = await getOrCreateDmConversation(user.id, sendSelectedId);
                const offerId = await createWalletOffer({ amountKes: amt, note: sendNote.trim() || null, dmConversationId: convo.id, recipientUserId: sendSelectedId });
                await sendDmShareMessage(convo.id, user.id, { kind: "wallet_offer", offer_id: offerId } as any);
                setPoints(await fetchYutoBalance(user.id));
                setShowSendModal(false);
                navigate(`/messages/${convo.id}`, { state: { otherUserId: sendSelectedId } });
              } catch (e) { setSendError(e instanceof Error ? e.message : "Couldn't send."); } finally { setSendBusy(false); }
            }} className={`w-full mt-4 h-12 rounded-2xl font-extrabold text-base transition-colors ${sendBusy || !sendSelectedId || !sendAmount || Number(sendAmount || 0) > points ? "bg-gray-200 text-gray-400 cursor-not-allowed dark:bg-zinc-800 dark:text-gray-500" : "bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200"}`}>
              {sendBusy ? "Sending…" : `Send KSH ${Number(sendAmount || 0).toLocaleString("en-KE")}`}
            </button>
          </div>
        </div>
      )}

      {showHighlightCreate && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center fade-in bg-black/60 backdrop-blur-sm">
          <button type="button" className="absolute inset-0 z-0 cursor-default border-none bg-transparent" aria-label="Dismiss" onClick={closeHighlightCreate} />
          <div className="relative z-10 bg-white dark:bg-zinc-900 rounded-t-3xl md:rounded-3xl w-full max-w-md p-6 modal-slide-up transition-colors">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-xl text-black dark:text-white">New highlight</h2>
              <button onClick={closeHighlightCreate} className="text-2xl text-gray-400 hover:text-black dark:hover:text-white bg-transparent border-none">✕</button>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Add exactly 2 photos or videos (max 30s). You can only have 2 highlights.</p>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {[0, 1].map((i) => (
                <label key={i} className="rounded-2xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 overflow-hidden aspect-square flex items-center justify-center cursor-pointer">
                  {highlightPreviews[i as 0 | 1] ? (
                    <HighlightStillMedia url={highlightPreviews[i as 0 | 1] as string} className="h-full w-full object-cover pointer-events-none" />
                  ) : (
                    <span className="text-sm text-gray-400 font-semibold">Pick photo or video</span>
                  )}
                  <input type="file" accept="image/*,video/*" className="hidden" onChange={(e) => void handlePickHighlight(i as 0 | 1, e)} />
                </label>
              ))}
            </div>
            <div className="rounded-2xl border border-gray-200 dark:border-zinc-700 p-4 mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-extrabold text-black dark:text-white">Shoppable sticker</p>
                  <p className="text-xs text-gray-500">Optional “Buy now” pill on the highlight</p>
                </div>
                <button type="button" onClick={() => setHighlightStickerOpen((v) => !v)} className={`w-12 h-7 rounded-full p-1 transition-colors ${highlightStickerOpen ? "bg-black dark:bg-white" : "bg-gray-200 dark:bg-zinc-700"}`}>
                  <div className={`w-5 h-5 rounded-full bg-white transition-transform ${highlightStickerOpen ? "translate-x-5" : "translate-x-0"}`} />
                </button>
              </div>
              {highlightStickerOpen && (
                <div className="mt-3">
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 block">Listing</label>
                  <select value={highlightStickerListingId || ""} onChange={(e) => setHighlightStickerListingId(e.target.value || null)} className="w-full h-12 rounded-2xl border border-gray-200 dark:border-zinc-700 px-4 text-sm font-semibold outline-none focus:border-black dark:focus:border-white transition-colors bg-white dark:bg-zinc-800 text-black dark:text-white">
                    <option value="">Pick a listing…</option>
                    {myListings.map((l) => (
                      <option key={l.id} value={l.id}>{l.title} · KSH {Number(l.amount_per_person || 0).toLocaleString("en-KE")}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <button type="button" onClick={() => void handleCreateHighlight()} disabled={creatingHighlight || !highlightFiles[0] || !highlightFiles[1] || highlights.length >= 2} className="w-full py-4 bg-black dark:bg-white text-white dark:text-black rounded-2xl font-bold disabled:opacity-40">
              {creatingHighlight ? "Creating..." : "Create highlight"}
            </button>
          </div>
        </div>
      )}

      {user && activeHighlight && (
        <ShareRecipientsSheet open={shareHighlightOpen} onClose={() => setShareHighlightOpen(false)} currentUserId={user.id} sharePayload={{ kind: "highlight", highlight_id: activeHighlight.id, user_id: user.id }} />
      )}

      <AnimatePresence>
        {activeHighlight && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.006, ease: "linear" }} className="fixed inset-0 z-[100] bg-black" />
            <motion.div layoutId={`highlight-container-${activeHighlight.id}`} style={{ borderRadius: 0 }} transition={{ layout: { duration: 0.008, ease: [0.2, 0.9, 0.2, 1] }, opacity: { duration: 0.006, ease: "linear" } }} exit={{ opacity: 0 }} className="fixed inset-0 z-[110] flex items-center justify-center overflow-hidden" onKeyDown={(e) => { if (e.key === "Escape") setActiveHighlight(null); }} tabIndex={-1} drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={0.8} onDragEnd={(_, info) => { if (info.offset.y > 100 || info.velocity.y > 500) setActiveHighlight(null); }}>

              {/* Progress bars */}
              <div className="absolute top-12 left-3 right-3 z-50 flex gap-2">
                {Array.from({ length: Math.max(1, Math.min(2, activeHighlight.photos?.length || 0)) }).map((_, i) => (
                  <div key={i} className="flex-1 h-[3px] rounded-full bg-white/30 overflow-hidden">
                    <div className="h-full bg-white" style={{ width: activeHighlightIdx >= i ? "100%" : "0%" }} />
                  </div>
                ))}
              </div>

              {/* Close Button overlay */}
              <button onClick={() => setActiveHighlight(null)} className="absolute top-16 right-4 z-50 text-white p-2">✕</button>

              {user && (
                <div className="absolute bottom-0 left-0 right-0 z-50 px-4 pb-8 pt-3">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-12 rounded-2xl bg-white/12 border border-white/15 backdrop-blur-sm flex items-center overflow-hidden">
                      <input value={highlightReplyText} onChange={(e) => setHighlightReplyText(e.target.value)} placeholder="Send message…" className="flex-1 h-full bg-transparent border-none outline-none px-4 text-white placeholder:text-white/60 font-semibold text-sm" />
                      <button type="button" disabled={highlightReplySending || !highlightReplyText.trim()} onClick={async () => {
                        if (!user) return;
                        const text = highlightReplyText.trim();
                        if (!text) return;
                        setHighlightReplySending(true);
                        try {
                          const convo = await getOrCreateDmConversation(user.id, user.id);
                          await sendDmMessage(convo.id, user.id, text);
                          setHighlightReplyText("");
                        } catch (e) { toast.error("Couldn't send message."); } finally { setHighlightReplySending(false); }
                      }} className="h-full px-4 text-white font-extrabold disabled:opacity-40">Send</button>
                    </div>
                    <button type="button" onClick={() => setShareHighlightOpen(true)} className="w-12 h-12 rounded-2xl bg-white/15 text-white flex items-center justify-center hover:bg-white/25 border-none shrink-0"><Send size={18} /></button>
                  </div>
                </div>
              )}

              {/* Buy Now Sticker */}
              {(() => {
                const payload = (activeHighlight as any)?.commerce_payload as any;
                if (!payload?.function_id) return null;
                return (
                  <button type="button" onClick={() => navigate("/home", { state: { focus: { kind: "function", id: String(payload.function_id) } } })} className="absolute bottom-24 left-4 z-50 px-4 h-12 rounded-2xl bg-white/15 text-white flex items-center gap-2 hover:bg-white/25 border-none font-extrabold shadow-xl backdrop-blur-md">
                    Buy now{payload.price_kes ? ` · KSH ${Number(payload.price_kes).toLocaleString("en-KE")}` : ""}
                  </button>
                );
              })()}

              <div className="absolute inset-0 flex items-center justify-center pb-24 pt-14">
                {(() => {
                  const active = activeHighlight.photos?.[activeHighlightIdx];
                  if (!active) return null;
                  const isVideo = isHighlightVideoUrl(active.url);
                  const placeholderImage = (active.poster_url || active.thumb_url) || (!isVideo ? active.url : null);
                  return (
                    <div className="relative w-full h-full bg-black">
                      {placeholderImage && <img src={placeholderImage as string} alt="" className="absolute inset-x-0 top-1/2 -translate-y-1/2 w-full h-auto max-h-full object-contain pointer-events-none" />}
                      {isVideo ? (
                        <>
                          <video src={active.url.includes("#") ? active.url : `${active.url}#t=0.001`} key={`video-${activeHighlightMediaKey}`} className={`absolute inset-x-0 top-1/2 -translate-y-1/2 w-full h-auto max-h-full object-contain pointer-events-none transition-opacity duration-200 ease-in-out ${activeHighlightMediaReady || !placeholderImage ? "opacity-100" : "opacity-0"}`} playsInline autoPlay muted={highlightViewerMuted} loop onLoadedData={() => setActiveHighlightMediaReady(true)} />
                          <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setHighlightViewerMuted((m) => !m); }} className="absolute top-16 left-4 z-50 w-10 h-10 rounded-2xl bg-black/60 hover:bg-black/70 text-white flex items-center justify-center backdrop-blur-sm">
                            {highlightViewerMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                          </button>
                        </>
                      ) : (
                        <img src={active.url} alt="" key={`img-${activeHighlightMediaKey}`} className={`absolute inset-x-0 top-1/2 -translate-y-1/2 w-full h-auto max-h-full object-contain pointer-events-none transition-opacity duration-200 ease-in-out ${activeHighlightMediaReady ? "opacity-100" : "opacity-0"}`} onLoad={() => setActiveHighlightMediaReady(true)} />
                      )}
                    </div>
                  );
                })()}
              </div>

              <button type="button" className="absolute inset-y-0 left-0 w-1/2 border-none bg-transparent z-40" onClick={() => {
                if (activeHighlightIdx === 1) {
                  // Go back to first photo in this highlight
                  setActiveHighlightIdx(0); setActiveHighlightMediaReady(false); setHighlightViewerMuted(true); return;
                }
                // On first photo — try previous highlight
                const currentSlot = activeHighlight.slot;
                if (currentSlot === 2) {
                  const prevHighlight = highlights.find(h => h.slot === 1);
                  if (prevHighlight) {
                    setActiveHighlightIdx(1); // Start at last photo of previous highlight
                    setActiveHighlightMediaReady(false);
                    setHighlightViewerMuted(true);
                    setActiveHighlight(prevHighlight);
                    return;
                  }
                }
                setActiveHighlight(null);
              }} />
              <button type="button" className="absolute inset-y-0 right-0 w-1/2 border-none bg-transparent z-40" onClick={() => {
                if (activeHighlightIdx === 0 && activeHighlight.photos?.length > 1) {
                  // Go to second photo in this highlight
                  setActiveHighlightIdx(1); setActiveHighlightMediaReady(false); setHighlightViewerMuted(true); return;
                }
                // On last photo — try next highlight
                const currentSlot = activeHighlight.slot;
                if (currentSlot === 1) {
                  const nextHighlight = highlights.find(h => h.slot === 2);
                  if (nextHighlight) {
                    setActiveHighlightIdx(0); // Start at first photo of next highlight
                    setActiveHighlightMediaReady(false);
                    setHighlightViewerMuted(true);
                    setActiveHighlight(nextHighlight);
                    return;
                  }
                }
                setActiveHighlight(null);
              }} />
            </motion.div>
          </>
        )}
      </AnimatePresence>

    </div>
  );
}
