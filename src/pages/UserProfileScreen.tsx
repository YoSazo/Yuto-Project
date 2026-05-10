import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "../contexts/AuthContext";
import {
  supabase,
  getProfile,
  getFriends,
  sendFriendRequest,
  getHighlightsByUser,
  getUserListings,
  getUserHostedFunctions,
  getOrCreateDmConversation,
  joinFunction,
  payForFunctionWithLedger,
  getFunctionById,
  sendDmMessage,
  updateFunctionListingStatus,
  cancelHostListing,
  submitUserReport,
  sendDmShareMessage,
  upsertDmBusinessContext,
  getSavedPhoneNumber,
  fetchYutoBalance,
  type Highlight,
  type HostedFunctionItem,
  type StorefrontListingItem,
} from "../lib/supabase";
import UserAvatar from "../components/UserAvatar";
import { HighlightStillMedia, isHighlightVideoUrl } from "../components/highlights/HighlightStillMedia";
import { ArrowLeft, UserPlus, Check, Clock, MessageCircle, Send, Store, Volume2, VolumeX } from "lucide-react";
import { ShareRecipientsSheet } from "../components/profile/ShareRecipientsSheet";
import { ListingInquiryToSellerModal } from "../components/profile/ListingInquiryToSellerModal";
import { MIN_MPESA_TOPUP_KES, computeFunctionTopUpGapKes } from "./home/computeTopUp";
import type { FunctionListing } from "../lib/types";
import { FunctionTicketModal } from "../components/home/FunctionTicketModal";
import { YutoBalanceTopUpModal } from "../components/wallet/YutoBalanceTopUpModal";
import { FixedMediaCarousel, type CarouselMediaItem } from "../components/media/FixedMediaCarousel";
import { FunctionCard } from "../components/cards/FunctionCard";
import { toast } from "sonner";
import { ConfirmModal } from "../components/ConfirmModal";

const STAT_POSITIONS = [
  { id: "splits", angle: -2.4, label: "Splits" },
  { id: "paid", angle: -0.7, label: "KSH Paid" },
  { id: "friends", angle: 2.4, label: "Friends" },
  { id: "plans", angle: 0.7, label: "Plans" },
];

export default function UserProfileScreen() {
  const { id: targetUserId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile: viewerProfile } = useAuth();
  
  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState({ totalYutos: 0, totalSpent: 0, friendsCount: 0, plansCount: 0 });
  const [friendStatus, setFriendStatus] = useState<"none" | "pending" | "friends">("none");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [activeHighlight, setActiveHighlight] = useState<Highlight | null>(null);
  const [activeHighlightIdx, setActiveHighlightIdx] = useState<0 | 1>(0);
  const [activeHighlightMediaReady, setActiveHighlightMediaReady] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const activeHighlightMediaKey =
    activeHighlight?.photos?.[activeHighlightIdx]?.url ? `${activeHighlight.id}:${activeHighlightIdx}:${activeHighlight.photos[activeHighlightIdx]!.url}` : "";

  useLayoutEffect(() => {
    setActiveHighlightMediaReady(false);
  }, [activeHighlightMediaKey]);
  const [sendProfileOpen, setSendProfileOpen] = useState(false);
  const [userListings, setUserListings] = useState<StorefrontListingItem[]>([]);
  const [hostedFunctions, setHostedFunctions] = useState<FunctionListing[]>([]);
  const [shareHighlightOpen, setShareHighlightOpen] = useState(false);
  const [shareListingOpen, setShareListingOpen] = useState<StorefrontListingItem | null>(null);
  const [listingInquiry, setListingInquiry] = useState<StorefrontListingItem | null>(null);
  const [showcaseTab, setShowcaseTab] = useState<"functions" | "sell" | "service">("functions");
  const [ticketFunction, setTicketFunction] = useState<FunctionListing | null>(null);
  const [pendingJoinFunction, setPendingJoinFunction] = useState<FunctionListing | null>(null);
  const [showFunctionTopUp, setShowFunctionTopUp] = useState(false);
  const [functionTopUpAmount, setFunctionTopUpAmount] = useState(MIN_MPESA_TOPUP_KES);
  const [highlightReplyText, setHighlightReplyText] = useState("");
  const [highlightReplySending, setHighlightReplySending] = useState(false);
  const [highlightViewerMuted, setHighlightViewerMuted] = useState(true);
  const [listingOptionsOpen, setListingOptionsOpen] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    confirmLabel?: string;
    danger?: boolean;
    onConfirm: () => void;
  } | null>(null);

  const handleReportUser = async () => {
    if (!targetUserId || !reportReason.trim()) return;
    try {
      await submitUserReport(targetUserId, reportReason.trim());
      toast.success("User reported. Our team will review this profile.");
      setReportModalOpen(false);
      setReportReason("");
    } catch (e) {
      toast.error("Couldn't submit report. Try again.");
    }
  };

  const handleUpdateListingStatus = async (listingId: string, status: "active" | "sold" | "paused") => {
    if (!user) return;
    try {
      await updateFunctionListingStatus(user.id, listingId, status);
      setUserListings((prev) =>
        prev.map((l) => (l.id === listingId ? { ...l, listing_status: status } : l))
      );
      toast.success(`Listing marked as ${status}`);
    } catch (e) {
      console.error(e);
      toast.error("Couldn't update listing.");
    }
    setListingOptionsOpen(null);
  };

  const handleDeleteListing = async (listingId: string) => {
    if (!user) return;
    setListingOptionsOpen(null);
    setConfirmModal({
      title: "Delete this listing?",
      message: "This will permanently remove the listing. This can't be undone.",
      confirmLabel: "Delete",
      danger: true,
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          await cancelHostListing(user.id, listingId);
          setUserListings((prev) => prev.filter((l) => l.id !== listingId));
          toast.success("Listing deleted");
        } catch (e) {
          console.error(e);
          toast.error("Couldn't delete listing.");
        }
      },
    });
    setListingOptionsOpen(null);
  };

  useEffect(() => {
    const st = location.state as { openHighlightId?: string } | null;
    const hid = st?.openHighlightId;
    if (!hid || highlights.length === 0) return;
    const found = highlights.find((h) => h.id === hid);
    if (found) {
      setActiveHighlightIdx(0);
      setActiveHighlightMediaReady(false);
      setHighlightViewerMuted(true);
      setActiveHighlight(found);
    }
  }, [location.state, highlights]);

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
      const [statsRes, plansRes, friendsRes, friendshipRes, highlightRows, listingRows, hostedRows] = await Promise.all([
        supabase.from("group_members").select("has_paid, groups(per_person)").eq("user_id", targetUserId),
        supabase.from("plans").select("id", { count: "exact", head: true }).eq("creator_id", targetUserId),
        getFriends(targetUserId).catch(() => []), 
        supabase.from("friendships")
          .select("status")
          .or(`and(requester_id.eq.${user.id},addressee_id.eq.${targetUserId}),and(requester_id.eq.${targetUserId},addressee_id.eq.${user.id})`)
          .maybeSingle(),
        getHighlightsByUser(targetUserId).catch(() => []),
        getUserListings(targetUserId).catch(() => [] as StorefrontListingItem[]),
        supabase
          .from("functions")
          .select("*, host:profiles!functions_host_id_fkey(id, username, display_name, avatar_url), function_members(id, user_id, has_paid, joined_at, paid_at, buyer_confirmed_at, profiles(id, username, display_name, avatar_url)), media:function_media(id, media_url, media_type, sort_index)")
          .eq("host_id", targetUserId)
          .eq("status", "open")
          .neq("location", "__SELL__")
          .neq("location", "__SERVICE__")
          .order("created_at", { ascending: false })
          .then(res => (res.data || []) as FunctionListing[]),
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
      setUserListings(listingRows as StorefrontListingItem[]);
      setHostedFunctions(hostedRows);

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

  useEffect(() => {
    const hasFns = hostedFunctions.length > 0;
    const sellCount = userListings.filter((l) => l.kind === "sell").length;
    const serviceCount = userListings.filter((l) => l.kind === "service").length;

    const available: Array<"functions" | "sell" | "service"> = [];
    if (hasFns) available.push("functions");
    if (sellCount > 0) available.push("sell");
    if (serviceCount > 0) available.push("service");

    if (available.length === 0) return;
    if (!available.includes(showcaseTab)) {
      setShowcaseTab(available[0]!);
    }
  }, [hostedFunctions, userListings, showcaseTab]);

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
      toast.error("Couldn't open messages. Try again.");
    }
  };

  const handleBuyListing = async (listing: StorefrontListingItem) => {
    if (!user) return;
    const fn = listing as unknown as FunctionListing;
    try {
      await joinFunction(fn.id, user.id);

      try {
        await payForFunctionWithLedger(fn.id);
      } catch (rpcErr: any) {
        await supabase
          .from("function_members")
          .delete()
          .eq("function_id", fn.id)
          .eq("user_id", user.id)
          .eq("has_paid", false);

        const cachedBal = await fetchYutoBalance(user.id);
        const topUp = await computeFunctionTopUpGapKes({
          shareKes: Number(fn.amount_per_person) || 0,
          rpcErrorMessage: rpcErr?.message ?? "",
          userId: user.id,
          cachedBalance: cachedBal,
        });
        setFunctionTopUpAmount(topUp);
        setPendingJoinFunction(fn);
        setShowFunctionTopUp(true);
        return;
      }

      // Open proof modal in-place
      try {
        const full = (await getFunctionById(fn.id)) as unknown as FunctionListing;
        setTicketFunction(full);
      } catch {
        setTicketFunction(fn);
      }

      // Also drop the purchased listing into DM with provider
      try {
        const hostId = targetUserId;
        if (hostId) {
          const convo = await getOrCreateDmConversation(user.id, hostId);
          const isSell = fn.location === "__SELL__";
          const verb = isSell ? "bought" : "booked";
          await sendDmMessage(convo.id, user.id, `Hey! I just ${verb} “${fn.title}”.`);
          await sendDmShareMessage(convo.id, user.id, {
            kind: "listing",
            function_id: fn.id,
            listing_kind: isSell ? "sell" : "service",
          } as any);
          await upsertDmBusinessContext({
            conversation_id: convo.id,
            provider_id: hostId,
            buyer_id: user.id,
            function_id: fn.id,
            listing_kind: isSell ? "sell" : "service",
            listing_title: fn.title,
          });
        }
      } catch (e) {
        console.error(e);
      }
    } catch (err) {
      console.error(err);
      toast.error("Couldn't complete purchase. Try again.");
    }
  };

  const handleJoinHostedFunction = async (hosted: FunctionListing) => {
    if (!user) return;
    try {
      await joinFunction(hosted.id, user.id);
      try {
        await payForFunctionWithLedger(hosted.id);
      } catch (rpcErr: any) {
        await supabase
          .from("function_members")
          .delete()
          .eq("function_id", hosted.id)
          .eq("user_id", user.id)
          .eq("has_paid", false);

        const cachedBal = await fetchYutoBalance(user.id);
        const topUp = await computeFunctionTopUpGapKes({
          shareKes: Number(hosted.amount_per_person) || 0,
          rpcErrorMessage: rpcErr?.message ?? "",
          userId: user.id,
          cachedBalance: cachedBal,
        });
        setFunctionTopUpAmount(topUp);
        setPendingJoinFunction(hosted);
        setShowFunctionTopUp(true);
        return;
      }
      const full = (await getFunctionById(hosted.id)) as unknown as FunctionListing;
      setTicketFunction(full);
    } catch (e) {
      console.error(e);
      toast.error("Couldn't join. Try again.");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-full bg-white dark:bg-black transition-colors">
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
    <div className="flex flex-col min-h-full px-5 pt-10 pb-6 bg-white dark:bg-black text-black dark:text-white transition-colors">
      {/* Header with Back Button */}
      <div className="flex items-center justify-between gap-3 mb-6">
      <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 bg-transparent border-none cursor-pointer text-black dark:text-white hover:opacity-70 transition-opacity shrink-0">
            <ArrowLeft size={24} />
          </button>
          <span className="text-2xl font-bold text-black dark:text-white truncate">Profile</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {user && targetUserId && (
            <>
              <button
                type="button"
                onClick={() => setReportModalOpen(true)}
                className="w-11 h-11 rounded-2xl bg-gray-100 dark:bg-zinc-900 text-gray-500 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-zinc-800 transition-colors"
                aria-label="Report user"
                title="Report user"
              >
                <span className="text-xl font-bold mb-1">...</span>
              </button>
              <button
                type="button"
                onClick={() => setSendProfileOpen(true)}
                className="w-11 h-11 rounded-2xl bg-gray-100 dark:bg-zinc-900 text-black dark:text-white flex items-center justify-center hover:bg-gray-200 dark:hover:bg-zinc-800 transition-colors"
                aria-label="Send profile in messages"
                title="Send profile"
              >
                <Send size={20} strokeWidth={2} />
              </button>
            </>
          )}
        </div>
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

      {user && activeHighlight && targetUserId && (
        <ShareRecipientsSheet
          open={shareHighlightOpen}
          onClose={() => setShareHighlightOpen(false)}
          currentUserId={user.id}
          sharePayload={{ kind: "highlight", highlight_id: activeHighlight.id, user_id: targetUserId }}
        />
      )}

      {user && shareListingOpen && (
        <ShareRecipientsSheet
          open
          onClose={() => setShareListingOpen(null)}
          currentUserId={user.id}
          sharePayload={{ kind: "listing", function_id: shareListingOpen.id, listing_kind: shareListingOpen.kind }}
        />
      )}

      {user && targetUserId && listingInquiry && (
        <ListingInquiryToSellerModal
          open
          onClose={() => setListingInquiry(null)}
          buyerUserId={user.id}
          sellerUserId={targetUserId}
          listing={listingInquiry}
          onSent={(convoId) => navigate(`/messages/${convoId}`, { state: { otherUserId: targetUserId } })}
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
              <div className={`rounded-2xl px-5 py-3 text-center min-w-[88px] transition-colors ${isPaid ? "bg-black text-green-400 border-2 border-green-500 shadow-lg" : "bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 shadow-sm"}`}>
                <p className={`font-extrabold text-xl font-syne ${isPaid ? "text-green-400" : "text-black dark:text-white"}`}>{value}</p>
                <p className={`text-xs mt-0.5 ${isPaid ? "text-white/70" : "text-gray-400 dark:text-gray-500"}`}>{pos.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Name + Handle */}
      <div className="text-center -mt-2 mb-3">
        <p className="font-bold text-xl text-black dark:text-white">{userName}</p>
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
                setActiveHighlightIdx(0);
                setActiveHighlightMediaReady(false);
                setActiveHighlight(h);
              }}
              className="flex flex-col items-center gap-1 bg-transparent border-none p-0"
            >
              <motion.div
                layoutId={`highlight-container-${h.id}`}
                style={{ borderRadius: 9999 }}
                className="relative w-16 h-16 shrink-0 border-2 border-gray-200 dark:border-zinc-800 overflow-hidden bg-gray-100 dark:bg-zinc-900"
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

      {/* Functions / Sell / Service showcase */}
      {(() => {
        const sellListings = userListings.filter((l) => l.kind === "sell");
        const serviceListings = userListings.filter((l) => l.kind === "service");
        const hasFns = hostedFunctions.length > 0;
        const available: Array<{ id: "functions" | "sell" | "service"; label: string; count: number }> = [];
        if (hasFns) available.push({ id: "functions", label: "Functions", count: hostedFunctions.length });
        if (sellListings.length > 0) available.push({ id: "sell", label: "Storefront", count: sellListings.length });
        if (serviceListings.length > 0) available.push({ id: "service", label: "Services", count: serviceListings.length });
        if (available.length === 0) return null;

        return (
          <div className="mb-8">
            {available.length > 1 ? (
              <div className="flex justify-center mb-4">
                <div className="inline-flex rounded-full bg-gray-100 p-1">
                  {available.map((t) => {
                    const sel = t.id === showcaseTab;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setShowcaseTab(t.id)}
                        className={[
                          "px-4 py-2 rounded-full text-sm font-extrabold transition-colors border-none",
                          sel ? "bg-black dark:bg-white text-white dark:text-black" : "bg-transparent text-gray-400",
                        ].join(" ")}
                      >
                        {t.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3 text-center">{available[0]!.label}</p>
            )}

            {showcaseTab === "functions" ? (
              <div className="flex flex-col gap-4">
                {hostedFunctions.map((fn) => (
                  <FunctionCard
                    key={fn.id}
                    eventFunction={fn}
                    currentUserId={user?.id}
                    onNavigateToHost={() => {}}
                    onJoinFunction={(f) => void handleJoinHostedFunction(f)}
                    onOpenTicket={(f) => setTicketFunction(f)}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-5 w-full max-w-md mx-auto pb-4">
                {(showcaseTab === "sell" ? sellListings : serviceListings).map((listing) => {
                  const carouselItems: CarouselMediaItem[] = (listing.media || []).map((m) => ({
                    url: m.media_url,
                    type: (m.media_type || "").startsWith("video/") ? "video" : "image",
                  }));
                  if (carouselItems.length === 0 && listing.image_url) {
                    carouselItems.push({ url: listing.image_url, type: "image" });
                  }
                  return (
                  <div
                    key={listing.id}
                    className="rounded-3xl border border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-md overflow-hidden text-left"
                  >
                    <div
                      role="button"
                      tabIndex={0}
                      className="w-full relative tap-scale bg-transparent border-none p-0 block cursor-pointer"
                      onClick={() => navigate("/home", { state: { focus: { kind: "function", id: listing.id } } })}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          navigate("/home", { state: { focus: { kind: "function", id: listing.id } } });
                        }
                      }}
                    >
                      <div className="relative max-h-[min(52vh,28rem)] overflow-hidden">
                        {carouselItems.length > 0 ? (
                          <FixedMediaCarousel items={carouselItems} />
                        ) : (
                          <div className="aspect-[4/5] bg-gray-100 dark:bg-zinc-800 relative">
                            <div className="absolute inset-0 flex items-center justify-center text-gray-300">
                              <Store size={34} />
                            </div>
                          </div>
                        )}
                        
                        {listing.listing_status && listing.listing_status !== "active" && (
                          <div className="absolute inset-0 bg-black/50 z-10 flex items-center justify-center backdrop-blur-[2px]">
                            <span className="px-4 py-2 bg-white text-black font-extrabold text-lg uppercase tracking-widest rounded-xl transform -rotate-6">
                              {listing.listing_status}
                            </span>
                          </div>
                        )}

                        <span className="absolute top-3 left-3 text-[10px] font-bold uppercase px-2.5 py-1 rounded-full bg-black/80 text-white z-20">
                          {listing.kind === "sell" ? "Sell" : "Service"}
                        </span>
                        
                        {user?.id === targetUserId && (
                          <div className="absolute top-3 right-14 z-30">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setListingOptionsOpen(listingOptionsOpen === listing.id ? null : listing.id);
                              }}
                              className="w-10 h-10 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 border-none shadow-sm"
                            >
                              <span className="text-xl font-bold mb-2">...</span>
                            </button>
                            {listingOptionsOpen === listing.id && (
                              <div className="absolute top-12 right-0 w-36 bg-white dark:bg-zinc-900 rounded-xl shadow-xl border border-gray-100 dark:border-zinc-800 overflow-hidden flex flex-col py-1">
                                {listing.listing_status !== "active" && (
                                  <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleUpdateListingStatus(listing.id, "active"); }} className="px-4 py-2 text-sm font-bold text-left text-black dark:text-white hover:bg-gray-50 dark:hover:bg-zinc-800 border-none bg-transparent">Re-list</button>
                                )}
                                {listing.listing_status !== "sold" && (
                                  <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleUpdateListingStatus(listing.id, "sold"); }} className="px-4 py-2 text-sm font-bold text-left text-black dark:text-white hover:bg-gray-50 dark:hover:bg-zinc-800 border-none bg-transparent">Mark Sold</button>
                                )}
                                {listing.listing_status !== "paused" && (
                                  <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleUpdateListingStatus(listing.id, "paused"); }} className="px-4 py-2 text-sm font-bold text-left text-black dark:text-white hover:bg-gray-50 dark:hover:bg-zinc-800 border-none bg-transparent">Pause</button>
                                )}
                                <div className="h-px bg-gray-100 dark:bg-zinc-800 my-1 mx-2" />
                                <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteListing(listing.id); }} className="px-4 py-2 text-sm font-bold text-red-600 dark:text-red-400 text-left hover:bg-gray-50 dark:hover:bg-zinc-800 border-none bg-transparent">Delete</button>
                              </div>
                            )}
                          </div>
                        )}

                        {user && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setShareListingOpen(listing);
                            }}
                            className="absolute top-3 right-3 w-10 h-10 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 z-20 border-none"
                            aria-label="Share listing"
                            title="Share"
                          >
                            <Send size={16} className="-ml-0.5 mt-0.5" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="p-4 pb-5">
                      <p className="font-extrabold text-black dark:text-white text-base leading-snug line-clamp-2">{listing.title}</p>
                      <p className="text-sm text-gray-600 mt-2 font-bold">KSH {listing.amount_per_person.toLocaleString()}</p>
                      <div className="mt-4 flex gap-3 items-stretch">
                        <button
                          type="button"
                          onClick={() => {
                            if (!user || !targetUserId) return;
                            setListingInquiry(listing);
                          }}
                          className="shrink-0 w-[3.25rem] rounded-2xl bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-black dark:text-white flex items-center justify-center transition-colors tap-scale disabled:opacity-40"
                          aria-label="Message about listing"
                          title="Message seller"
                          disabled={!user || listing.listing_status === "sold"}
                        >
                          <MessageCircle size={22} strokeWidth={2} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (!user || !targetUserId) return;
                            setListingInquiry(listing); // Opens the DM flow instead of instant pay
                          }}
                          disabled={listing.listing_status === "sold" || listing.listing_status === "paused"}
                          className="flex-1 min-h-[3.25rem] rounded-2xl bg-black dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-200 text-white dark:text-black font-extrabold transition-colors inline-flex items-center justify-center px-4 disabled:opacity-40 disabled:bg-gray-200 disabled:text-gray-500"
                        >
                          {listing.listing_status === "sold" 
                            ? "Sold Out" 
                            : listing.listing_status === "paused" 
                              ? "Unavailable" 
                              : listing.kind === "service" ? "Message to book" : "Message to buy"}
                        </button>
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {ticketFunction && user && (
        <FunctionTicketModal
          functionItem={ticketFunction}
          userId={user.id}
          attendeeDisplayName={viewerProfile?.display_name?.trim() || viewerProfile?.username?.trim() || "Guest"}
          onClose={() => setTicketFunction(null)}
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
          mpesaPhoneNumber={viewerProfile?.phone_number || getSavedPhoneNumber(user.id) || ""}
          initialAmount={functionTopUpAmount}
          contextLine={`This costs KSH ${pendingJoinFunction.amount_per_person.toLocaleString("en-KE")}. Top up at least KSH ${functionTopUpAmount.toLocaleString("en-KE")} to continue.`}
          retryCtaLabel="I've paid — try again"
          onRetryAfterPaid={async () => {
            const fn = pendingJoinFunction;
            if (!fn) return;
            setShowFunctionTopUp(false);
            setPendingJoinFunction(null);
            setFunctionTopUpAmount(MIN_MPESA_TOPUP_KES);
            const loc = String((fn as any)?.location || "");
            if (loc === "__SELL__" || loc === "__SERVICE__") {
              await handleBuyListing(fn as any);
            } else {
              await handleJoinHostedFunction(fn as any);
            }
          }}
        />
      )}

      {/* Action Buttons */}
      <div className="px-2">
        {friendStatus === "friends" ? (
          <button
            onClick={() => void handleMessage()}
            className="w-full py-4 bg-black dark:bg-white text-white dark:text-black rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors shadow-lg shadow-black/10"
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
                  ? "bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200"
                  : "bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-gray-400 shadow-none"
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
              className="flex-1 py-4 bg-gray-100 dark:bg-zinc-800 text-black dark:text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors"
            >
              <MessageCircle size={20} /> Message
            </button>
          </div>
        )}
      </div>

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

              {user && targetUserId && (
                <div className="absolute bottom-0 left-0 right-0 z-50 px-4 pb-4 pt-3">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-12 rounded-2xl bg-white/12 border border-white/15 backdrop-blur-sm flex items-center overflow-hidden">
                      <input
                        value={highlightReplyText}
                        onChange={(e) => setHighlightReplyText(e.target.value)}
                        placeholder="Send message…"
                        className="flex-1 h-full bg-transparent border-none outline-none px-4 text-white placeholder:text-white/60 font-semibold text-sm"
                      />
                      <button
                        type="button"
                        disabled={highlightReplySending || !highlightReplyText.trim()}
                        onClick={async () => {
                          if (!user || !targetUserId) return;
                          const text = highlightReplyText.trim();
                          if (!text) return;
                          setHighlightReplySending(true);
                          try {
                            const convo = await getOrCreateDmConversation(user.id, targetUserId);
                            await sendDmMessage(convo.id, user.id, text);
                            setHighlightReplyText("");
                          } catch (e) {
                            console.error(e);
                            toast.error("Couldn't send message.");
                          } finally {
                            setHighlightReplySending(false);
                          }
                        }}
                        className="h-full px-4 text-white font-extrabold disabled:opacity-40"
                        aria-label="Send message"
                        title="Send"
                      >
                        Send
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShareHighlightOpen(true)}
                      className="w-12 h-12 rounded-2xl bg-white/15 text-white flex items-center justify-center hover:bg-white/25 border-none shrink-0"
                      aria-label="Send highlight to someone"
                      title="Send highlight"
                    >
                      <Send size={18} />
                    </button>
                  </div>
                </div>
              )}

              {(() => {
                const payload = (activeHighlight as any)?.commerce_payload as any;
                const fnId = payload?.function_id;
                const price = payload?.price_kes;
                if (!fnId) return null;
                return (
                  <button
                    type="button"
                    onClick={() => navigate("/home", { state: { focus: { kind: "function", id: String(fnId) } } })}
                    className="absolute bottom-4 left-4 z-50 px-4 h-12 rounded-2xl bg-white/15 text-white flex items-center gap-2 hover:bg-white/25 border-none font-extrabold"
                    aria-label="Buy now"
                    title="Buy now"
                  >
                    Buy now{price ? ` · KSH ${Number(price).toLocaleString("en-KE")}` : ""}
                  </button>
                );
              })()}

              <div className="absolute inset-0 flex items-center justify-center pb-24 pt-14">
                {(() => {
                  const active = activeHighlight.photos?.[activeHighlightIdx];
                  if (!active) return null;

                  const isVideo = isHighlightVideoUrl(active.url);
                  const hasImagePoster = !!(active.poster_url || active.thumb_url);
                  const placeholderImage = hasImagePoster
                    ? (active.poster_url || active.thumb_url)
                    : (!isVideo ? active.url : null);

                  return (
                    <div className="relative w-full h-full bg-black">
                      {placeholderImage && (
                        <img
                          src={placeholderImage as string}
                          alt=""
                          aria-hidden
                          className="absolute inset-x-0 top-1/2 -translate-y-1/2 w-full h-auto max-h-full object-contain pointer-events-none"
                          draggable={false}
                        />
                      )}

                      {isVideo ? (
                        <>
                          <video
                            src={active.url.includes("#") ? active.url : `${active.url}#t=0.001`}
                            key={`video-${activeHighlightMediaKey}`}
                            className={`absolute inset-x-0 top-1/2 -translate-y-1/2 w-full h-auto max-h-full object-contain pointer-events-none transition-opacity duration-200 ease-in-out ${
                              activeHighlightMediaReady || !placeholderImage ? "opacity-100" : "opacity-0"
                            }`}
                            playsInline
                            autoPlay
                            muted={highlightViewerMuted}
                            loop
                            onLoadedData={() => setActiveHighlightMediaReady(true)}
                          />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setHighlightViewerMuted((m) => !m);
                            }}
                            className="absolute top-3 right-3 z-50 w-10 h-10 rounded-2xl bg-black/60 hover:bg-black/70 text-white flex items-center justify-center backdrop-blur-sm"
                            aria-label={highlightViewerMuted ? "Unmute video" : "Mute video"}
                            title={highlightViewerMuted ? "Unmute" : "Mute"}
                          >
                            {highlightViewerMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                          </button>
                        </>
                      ) : (
                        <img
                          src={active.url}
                          alt=""
                          key={`img-${activeHighlightMediaKey}`}
                          className={`absolute inset-x-0 top-1/2 -translate-y-1/2 w-full h-auto max-h-full object-contain pointer-events-none transition-opacity duration-200 ease-in-out ${
                            activeHighlightMediaReady ? "opacity-100" : "opacity-0"
                          }`}
                          draggable={false}
                          onLoad={() => setActiveHighlightMediaReady(true)}
                        />
                      )}
                    </div>
                  );
                })()}
              </div>

              <button
                type="button"
                className="absolute inset-y-0 left-0 w-1/2 border-none bg-transparent z-40"
                aria-label="Previous photo"
                onClick={() => {
                  if (activeHighlightIdx === 1) {
                    setActiveHighlightIdx(0);
                    setActiveHighlightMediaReady(false);
                    setHighlightViewerMuted(true);
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
                    setHighlightViewerMuted(true);
                    return;
                  }
                  setActiveHighlight(null);
                }}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>


      {/* Custom Report Modal */}
      {reportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={() => setReportModalOpen(false)}>
          <div 
            className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-t-3xl p-6 pb-8 transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-xl font-bold text-black dark:text-white">Report User</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">This will be sent securely to our review team.</p>
              </div>
              <button onClick={() => setReportModalOpen(false)} className="w-8 h-8 border-none rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center text-gray-500 hover:bg-gray-200 dark:hover:bg-zinc-700">✕</button>
            </div>
            
            <textarea
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              placeholder="Why are you reporting this user? (Spam, inappropriate behavior, etc.)"
              className="w-full h-32 p-4 bg-transparent border border-gray-200 dark:border-zinc-800 rounded-2xl resize-none text-sm font-medium focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white text-black dark:text-white placeholder:text-gray-400"
            />
            
            <div className="mt-4 flex gap-3">
              <button 
                onClick={() => setReportModalOpen(false)}
                className="flex-1 py-3.5 border-none rounded-2xl bg-gray-100 dark:bg-zinc-800 text-black dark:text-white hover:bg-gray-200 dark:hover:bg-zinc-700 font-bold text-sm"
              >
                Cancel
              </button>
              <button 
                onClick={handleReportUser}
                disabled={!reportReason.trim()}
                className="flex-1 py-3.5 border-none rounded-2xl bg-red-600 text-white font-bold text-sm disabled:opacity-50"
              >
                Submit Report
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!confirmModal}
        title={confirmModal?.title || ""}
        message={confirmModal?.message || ""}
        confirmLabel={confirmModal?.confirmLabel}
        danger={confirmModal?.danger}
        onConfirm={() => confirmModal?.onConfirm()}
        onCancel={() => setConfirmModal(null)}
      />
    </div>
  );
}
