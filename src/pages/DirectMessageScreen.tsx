import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Plus, Send, Trash2 } from "lucide-react";
import UserAvatar from "../components/UserAvatar";
import { useAuth } from "../contexts/AuthContext";
import {
  getSavedPhoneNumber,
  getDmMessages,
  joinFunction,
  joinPlan,
  leavePlan,
  markDmRead,
  getOrCreateDmConversation,
  sendDmMessage,
  sendDmShareMessage,
  deleteDmMessage,
  upsertDmBusinessContext,
  getHighlightById,
  ensureFunctionAttendeeChat,
  createWalletOffer,
  acceptWalletOffer,
  getWalletOfferById,
  fetchYutoBalance,
  supabase,
  type DmMessage,
  type DmSharePayload,
  type Highlight,
} from "../lib/supabase";
import { DmPlusModal } from "../components/dm/DmPlusModal";
import { DmSharedProfileCard } from "../components/dm/DmSharedProfileCard";
import { DmSharedHighlightCard } from "../components/dm/DmSharedHighlightCard";
import { FunctionTicketModal } from "../components/home/FunctionTicketModal";
import type { Plan, FunctionListing } from "./home/types";
import { PlanCard } from "../components/cards/PlanCard";
import { FunctionCard } from "../components/cards/FunctionCard";
import { MIN_MPESA_TOPUP_KES, computeFunctionTopUpGapKes } from "./home/computeTopUp";
import { YutoBalanceTopUpModal } from "../components/wallet/YutoBalanceTopUpModal";
import { useThreadScrollToBottom } from "../hooks/useThreadScrollToBottom";
import { GroupChargeModal } from "../components/wallet/GroupChargeModal";
import { ConfirmUnsendModal } from "../components/ui/ConfirmUnsendModal";
import { toast } from "sonner";
import { haptics } from "../lib/haptics";
import { SmartReplies } from "../components/chat/SmartReplies";

type ProfileRow = { id: string; username: string; display_name: string; avatar_url: string | null };

export default function DirectMessageScreen() {
  const { user, profile } = useAuth();
  const { conversationId } = useParams<{ conversationId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const otherUserId = (location.state as { otherUserId?: string } | null)?.otherUserId;

  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<DmMessage[]>([]);
  const [other, setOther] = useState<ProfileRow | null>(null);
  const [text, setText] = useState("");
  const [showSharePicker, setShowSharePicker] = useState(false);
  const [previewShare, setPreviewShare] = useState<{ title: string; subtitle: string; kindLabel: string } | null>(null);
  const { scrollViewportRef, bottomRef, contentRef, onScrollViewport } = useThreadScrollToBottom(
    conversationId,
    loading,
    messages.length,
  );
  const [shareCache, setShareCache] = useState<Record<string, Plan | FunctionListing | null>>({});
  const [highlightShareCache, setHighlightShareCache] = useState<Record<string, { highlight: Highlight; owner: ProfileRow }>>({});
  const [shareBusyId, setShareBusyId] = useState<string | null>(null);
  const [ticketFunction, setTicketFunction] = useState<FunctionListing | null>(null);
  const [showFunctionTopUp, setShowFunctionTopUp] = useState(false);
  const [functionTopUpAmount, setFunctionTopUpAmount] = useState(MIN_MPESA_TOPUP_KES);
  const [pendingJoinFunction, setPendingJoinFunction] = useState<FunctionListing | null>(null);
  const [groupPay, setGroupPay] = useState<{ groupId: string; amount: number } | null>(null);
  const [groupShareCache, setGroupShareCache] = useState<Record<string, { id: string; name: string; per_person: number; status: string }>>({});
  const [groupPaidById, setGroupPaidById] = useState<Record<string, boolean>>({});
  const [quickSplitTopUp, setQuickSplitTopUp] = useState<{ groupId: string; amount: number; perPerson: number } | null>(null);
  const [confirmDeleteMessageId, setConfirmDeleteMessageId] = useState<string | null>(null);
  const [walletOfferCache, setWalletOfferCache] = useState<Record<string, any | null>>({});
  const [composerYutoBalance, setComposerYutoBalance] = useState<number | null>(null);
  const [composerBalanceLoading, setComposerBalanceLoading] = useState(false);

  const parseShare = (m: DmMessage): DmSharePayload | null => {
    if (m.message_type !== "share") return null;
    const p = m.payload as any;
    if (!p || typeof p !== "object") return null;
    if (p.kind === "plan" && typeof p.plan_id === "string") return { kind: "plan", plan_id: p.plan_id };
    if (p.kind === "function" && typeof p.function_id === "string") return { kind: "function", function_id: p.function_id };
    if (p.kind === "listing" && typeof p.function_id === "string" && (p.listing_kind === "sell" || p.listing_kind === "service")) {
      return { kind: "listing", function_id: p.function_id, listing_kind: p.listing_kind };
    }
    if (p.kind === "group" && typeof p.group_id === "string") {
      return {
        kind: "group",
        group_id: p.group_id,
        amount_kes: typeof p.amount_kes === "number" ? p.amount_kes : undefined,
        memo: typeof p.memo === "string" ? p.memo : undefined,
        media_url: typeof p.media_url === "string" ? p.media_url : undefined,
        media_type: typeof p.media_type === "string" ? p.media_type : undefined,
      };
    }
    if (p.kind === "profile" && typeof p.user_id === "string") return { kind: "profile", user_id: p.user_id };
    if (p.kind === "highlight" && typeof p.highlight_id === "string" && typeof p.user_id === "string") {
      return { kind: "highlight", highlight_id: p.highlight_id, user_id: p.user_id };
    }
    if (p.kind === "wallet_offer" && typeof p.offer_id === "string") return { kind: "wallet_offer", offer_id: p.offer_id };
    return null;
  };

  useEffect(() => {
    if (!showSharePicker || !user?.id) return;
    let cancelled = false;
    setComposerBalanceLoading(true);
    void (async () => {
      try {
        const bal = await fetchYutoBalance(user.id);
        if (!cancelled) setComposerYutoBalance(bal);
      } catch {
        if (!cancelled) setComposerYutoBalance(null);
      } finally {
        if (!cancelled) setComposerBalanceLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showSharePicker, user?.id]);

  useEffect(() => {
    if (!user || !conversationId) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const rows = await getDmMessages(conversationId);
        if (cancelled) return;
        setMessages(rows);
        await markDmRead(conversationId, user.id);

        if (otherUserId) {
          const { data, error } = await supabase
            .from("profiles")
            .select("id, username, display_name, avatar_url")
            .eq("id", otherUserId)
            .single();
          if (error) throw error;
          setOther(data as ProfileRow);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, conversationId, otherUserId]);

  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`dm:${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "dm_messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const row = payload.new as DmMessage;
          setMessages((prev) => {
            const i = prev.findIndex((m) => m.id === row.id);
            if (i >= 0) {
              const next = [...prev];
              const cur = prev[i]!;
              next[i] = {
                ...cur,
                ...row,
                sender: cur.sender ?? (row as DmMessage).sender,
              } as DmMessage;
              return next;
            }
            if (prev.some((m) => m.id === row.id)) return prev;
            return [...prev, row];
          });
          if (row.sender_id !== user?.id) {
            void markDmRead(conversationId, user!.id);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, user]);

  const title = useMemo(() => other?.display_name || "Message", [other]);

  const lastReceivedMessage = useMemo(() => {
    if (!user) return null;
    return [...messages].reverse().find((m) => m.sender_id !== user.id) ?? null;
  }, [messages, user]);

  const sendWithContent = async (raw: string) => {
    if (!user || !conversationId) return;
    const content = raw.trim();
    if (!content) return;
    setText("");

    const optimisticId = globalThis.crypto.randomUUID();
    const optimisticMsg: DmMessage = {
      id: optimisticId,
      conversation_id: conversationId,
      sender_id: user.id,
      content,
      created_at: new Date().toISOString(),
      message_type: "text",
      sender: {
        id: user.id,
        username: profile?.username || "",
        display_name: profile?.display_name || "You",
        avatar_url: profile?.avatar_url ?? null,
      },
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    try {
      await sendDmMessage(conversationId, user.id, content, optimisticId);
      haptics.light();
    } catch (e) {
      console.error(e);
      toast.error("Couldn't send. Try again.");
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      setText(content);
    }
  };

  const onSend = async () => {
    await sendWithContent(text);
  };

  const sendShare = async (payload: DmSharePayload, preview: { title: string; subtitle: string; kindLabel: string }) => {
    if (!user || !conversationId) return;
    try {
      await sendDmShareMessage(conversationId, user.id, payload);
      setPreviewShare(preview);
      setTimeout(() => setPreviewShare(null), 1400);
    } catch (e) {
      console.error(e);
      toast.error("Couldn't send. Try again.");
    }
  };

  const requestSplitInDm = async (args: { amountKes: number; memo: string; mediaFile?: File | null }) => {
    if (!user || !conversationId) return;
    if (!otherUserId) throw new Error("Missing recipient. Open this DM from the inbox.");
    const { createGroup } = await import("../lib/supabase");
    const group = await createGroup(
      args.memo?.trim() ? args.memo.trim() : "Payment request",
      args.amountKes,
      args.amountKes,
      user.id,
      [user.id, otherUserId],
      "single",
    );
    setGroupShareCache((prev) => ({ ...prev, [group.id]: { id: group.id, name: group.name, per_person: group.per_person, status: group.status } }));
    let media_url: string | undefined;
    let media_type: string | undefined;
    if (args.mediaFile instanceof File) {
      try {
        const { uploadPlanOrFunctionMedia } = await import("../lib/supabase");
        media_url = await uploadPlanOrFunctionMedia(user.id, "group", args.mediaFile);
        media_type = args.mediaFile.type || "application/octet-stream";
      } catch (e) {
        console.error(e);
      }
    }
    await sendDmShareMessage(conversationId, user.id, { kind: "group", group_id: group.id, amount_kes: args.amountKes, memo: args.memo, media_url, media_type } as any);
  };

  const handleJoinFunction = async (eventFunction: FunctionListing) => {
    if (!user) return;
    const members = eventFunction.function_members ?? [];
    const isMember = members.some((m) => m.user_id === user.id);
    const cap = eventFunction.max_capacity;
    const isFull = cap != null ? members.length >= cap && !isMember : false;
    if (isFull) {
      toast.error("This function is currently full!");
      return;
    }

    try {
      if (!isMember) await joinFunction(eventFunction.id, user.id);

      const { error } = await supabase.rpc("pay_for_function", { p_function_id: eventFunction.id });

      if (error) {
        await supabase
          .from("function_members")
          .delete()
          .eq("function_id", eventFunction.id)
          .eq("user_id", user.id)
          .eq("has_paid", false);

        const cachedBal = await fetchYutoBalance(user.id);
        const topUp = await computeFunctionTopUpGapKes({
          shareKes: eventFunction.amount_per_person,
          rpcErrorMessage: error.message,
          userId: user.id,
          cachedBalance: cachedBal,
        });
        setFunctionTopUpAmount(topUp);
        setPendingJoinFunction(eventFunction);
        setShowFunctionTopUp(true);
        return;
      }

      const { data } = await supabase
        .from("functions")
        .select(
          "*, host:profiles!functions_host_id_fkey(id, username, display_name, avatar_url), function_members(id, user_id, has_paid, joined_at, paid_at, buyer_confirmed_at, profiles(id, username, display_name, avatar_url))",
        )
        .eq("id", eventFunction.id)
        .single();
      setShareCache((prev) => ({ ...prev, [`fn:${eventFunction.id}`]: data as any }));

      const isSell = eventFunction.location === "__SELL__";
      const isService = eventFunction.location === "__SERVICE__";
      if (isSell || isService) {
        try {
          const convo = await getOrCreateDmConversation(user.id, eventFunction.host.id);
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
          // In-message purchase should not kick you out of your current conversation.
        } catch (e) {
          console.error(e);
        }
      }

      // After successful pay, show proof/ticket in-place.
      setTicketFunction(data as FunctionListing);
    } catch (err) {
      console.error("Error joining function", err);
      toast.error("Couldn't complete that action. Try again.");
    }
  };

  useEffect(() => {
    if (!conversationId) return;
    const shares = messages
      .map((m) => ({ id: m.id, payload: parseShare(m) }))
      .filter((x): x is { id: string; payload: DmSharePayload } => !!x.payload && x.payload.kind !== "profile");

    const missing = shares.filter((s) => {
      if (s.payload.kind === "highlight") return false;
      if (s.payload.kind === "group") return !(s.payload.group_id in groupShareCache);
      if (s.payload.kind === "wallet_offer") return !(s.payload.offer_id in walletOfferCache);
      if (s.payload.kind === "plan") return !(`plan:${s.payload.plan_id}` in shareCache);
      if (s.payload.kind === "function" || s.payload.kind === "listing") return !(`fn:${s.payload.function_id}` in shareCache);
      return false;
    });
    if (missing.length === 0) return;

    let cancelled = false;
    (async () => {
      try {
        const groupIds = missing
          .filter((m) => m.payload.kind === "group")
          .map((m) => (m.payload as Extract<DmSharePayload, { kind: "group" }>).group_id);
        const offerIds = missing
          .filter((m) => m.payload.kind === "wallet_offer")
          .map((m) => (m.payload as Extract<DmSharePayload, { kind: "wallet_offer" }>).offer_id);
        const planIds = missing.filter((m) => m.payload.kind === "plan").map((m) => (m.payload as { plan_id: string }).plan_id);
        const fnIds = missing
          .filter((m) => m.payload.kind === "function" || m.payload.kind === "listing")
          .map((m) => (m.payload as { function_id: string }).function_id);

        const { data: planRows, error: planErr } =
          planIds.length === 0
            ? { data: [] as Record<string, unknown>[], error: null }
            : await supabase
                .from("plans")
                .select(
                  "*, creator:profiles!plans_creator_id_fkey(id, username, display_name, avatar_url), plan_members(id, user_id, profiles(id, username, display_name, avatar_url))",
                )
                .in("id", planIds);
        if (planErr) throw planErr;

        const { data: fnRows, error: fnErr } =
          fnIds.length === 0
            ? { data: [] as Record<string, unknown>[], error: null }
            : await supabase
                .from("functions")
                .select(
                  "*, host:profiles!functions_host_id_fkey(id, username, display_name, avatar_url), function_members(id, user_id, has_paid, joined_at, paid_at, buyer_confirmed_at, profiles(id, username, display_name, avatar_url))",
                )
                .in("id", fnIds);
        if (fnErr) throw fnErr;

        const { data: groupRows, error: groupErr } =
          groupIds.length === 0
            ? { data: [] as Record<string, unknown>[], error: null }
            : await supabase.from("groups").select("id, name, per_person, status").in("id", groupIds);
        if (groupErr) throw groupErr;

        const offers = await Promise.all(
          (offerIds || []).map(async (id) => {
            try {
              return await getWalletOfferById(id);
            } catch {
              return null;
            }
          }),
        );

        if (cancelled) return;
        setShareCache((prev) => {
          const next = { ...prev };
          (planRows || []).forEach((p) => (next[`plan:${(p as any).id}`] = p as any));
          (fnRows || []).forEach((f) => (next[`fn:${(f as any).id}`] = f as any));
          planIds.forEach((id) => {
            const k = `plan:${id}`;
            if (!(k in next) && !(planRows || []).some((p: any) => String(p.id) === String(id))) next[k] = null;
          });
          fnIds.forEach((id) => {
            const k = `fn:${id}`;
            if (!(k in next) && !(fnRows || []).some((f: any) => String(f.id) === String(id))) next[k] = null;
          });
          return next;
        });
        setGroupShareCache((prev) => {
          const next = { ...prev };
          (groupRows || []).forEach((g: any) => {
            next[String(g.id)] = {
              id: String(g.id),
              name: String(g.name || "Split"),
              per_person: Number(g.per_person || 0),
              status: String(g.status || "active"),
            };
          });
          groupIds.forEach((id) => {
            const k = String(id);
            if (!(k in next) && !(groupRows || []).some((g: any) => String(g.id) === String(id))) {
              next[k] = { id: k, name: "Deleted split", per_person: 0, status: "deleted" };
            }
          });
          return next;
        });

        setWalletOfferCache((prev) => {
          const next = { ...prev };
          (offerIds || []).forEach((id, idx) => {
            next[String(id)] = offers[idx] ?? null;
          });
          return next;
        });
      } catch (e) {
        console.error(e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [messages, shareCache, groupShareCache, walletOfferCache, conversationId]);

  // Live paid-state for quick split cards (flip Pay Now -> Paid).
  useEffect(() => {
    if (!user) return;
    const groupIds = Array.from(
      new Set(
        messages
          .map((m) => parseShare(m))
          .filter((p): p is Extract<DmSharePayload, { kind: "group" }> => p?.kind === "group")
          .map((p) => p.group_id),
      ),
    );
    if (groupIds.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from("group_members")
          .select("group_id, has_paid")
          .eq("user_id", user.id)
          .in("group_id", groupIds);
        if (cancelled) return;
        const next: Record<string, boolean> = {};
        (data || []).forEach((r: any) => {
          next[String(r.group_id)] = !!r.has_paid;
        });
        setGroupPaidById((prev) => ({ ...prev, ...next }));
      } catch (e) {
        console.error(e);
      }
    })();

    const channel = supabase
      .channel(`dm-quick-split-paid-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "group_members", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const row = payload.new as any;
          const gid = String(row.group_id || "");
          if (!gid || !groupIds.includes(gid)) return;
          setGroupPaidById((prev) => ({ ...prev, [gid]: !!row.has_paid }));
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [messages, user]);

  // Live accept-state for wallet offer cards.
  useEffect(() => {
    if (!user) return;
    const offerIds = Array.from(
      new Set(
        messages
          .map((m) => parseShare(m))
          .filter((p): p is Extract<DmSharePayload, { kind: "wallet_offer" }> => p?.kind === "wallet_offer")
          .map((p) => p.offer_id),
      ),
    );
    if (offerIds.length === 0) return;
    const channel = supabase
      .channel(`dm-wallet-offers-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "wallet_offers" }, (payload) => {
        const row = payload.new as any;
        const id = String(row?.id || "");
        if (!id || !offerIds.includes(id)) return;
        setWalletOfferCache((prev) => ({ ...prev, [id]: row }));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [messages, user]);

  useEffect(() => {
    if (!conversationId) return;
    const hlShares = messages
      .map((m) => ({ id: m.id, payload: parseShare(m) }))
      .filter((x): x is { id: string; payload: Extract<DmSharePayload, { kind: "highlight" }> } => x.payload?.kind === "highlight");
    const missing = hlShares.filter((s) => !highlightShareCache[`hl:${s.payload.highlight_id}`]);
    if (missing.length === 0) return;

    let cancelled = false;
    (async () => {
      try {
        for (const s of missing) {
          const hid = s.payload.highlight_id;
          const ownerId = s.payload.user_id;
          const [hl, ownerRes] = await Promise.all([
            getHighlightById(hid),
            supabase.from("profiles").select("id, username, display_name, avatar_url").eq("id", ownerId).single(),
          ]);
          if (cancelled) return;
          if (hl && ownerRes.data) {
            setHighlightShareCache((prev) => ({
              ...prev,
              [`hl:${hid}`]: { highlight: hl, owner: ownerRes.data as ProfileRow },
            }));
          }
        }
      } catch (e) {
        console.error(e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [messages, highlightShareCache, conversationId]);

  return (
    <div className="h-[100dvh] flex flex-col bg-white">
      <div className="px-5 pt-6 pb-4 border-b border-gray-100 flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
          <ArrowLeft size={18} />
        </button>
        <div className="flex items-center gap-2 min-w-0">
          <UserAvatar name={other?.display_name || "User"} avatarUrl={other?.avatar_url || null} size="sm" />
          <div className="min-w-0">
            <p className="font-extrabold text-black truncate">{title}</p>
            {other?.username && <p className="text-xs text-gray-400 truncate">@{other.username}</p>}
          </div>
        </div>
      </div>

      <div
        ref={scrollViewportRef}
        onScroll={onScrollViewport}
        className="flex-1 overflow-y-auto px-5 py-4 min-h-0 overscroll-contain"
      >
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div ref={contentRef} className="flex flex-col gap-2">
            {messages.map((m) => {
              const mine = m.sender_id === user?.id;
              const share = parseShare(m);
              const profileShare = share?.kind === "profile" ? share : null;
              const hlShare = share?.kind === "highlight" ? share : null;
              const listedShare =
                share && share.kind !== "profile" && share.kind !== "highlight"
                  ? (share as Exclude<DmSharePayload, { kind: "profile" } | { kind: "highlight" }>)
                  : null;
              const shareKey =
                listedShare?.kind === "plan"
                  ? `plan:${listedShare.plan_id}`
                  : listedShare && (listedShare as any).function_id
                    ? `fn:${listedShare.function_id}`
                    : null;
              const sharedItem = shareKey ? shareCache[shareKey] : null;
              const hlKey = hlShare ? `hl:${hlShare.highlight_id}` : null;
              const hlPack = hlKey ? highlightShareCache[hlKey] : null;
              const sharedGroup = listedShare?.kind === "group" ? groupShareCache[listedShare.group_id] : null;
              const groupPaid = listedShare?.kind === "group" ? !!groupPaidById[listedShare.group_id] : false;
              return (
                <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  {mine && (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteMessageId(m.id)}
                      className="mr-2 mt-2 w-8 h-8 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center shrink-0"
                      aria-label="Delete message"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                  {profileShare ? (
                    <div className="max-w-[95%] w-[95%] md:w-[268px]">
                      {user?.id ? (
                        <DmSharedProfileCard viewerUserId={user.id} sharedUserId={profileShare.user_id} />
                      ) : null}
                    </div>
                  ) : hlShare ? (
                    <div className="max-w-[96%] w-[96%] md:w-[380px]">
                      {hlPack ? (
                        <DmSharedHighlightCard
                          highlight={hlPack.highlight}
                          ownerName={hlPack.owner.display_name}
                          ownerAvatarUrl={hlPack.owner.avatar_url}
                          onOpen={() => {
                            if (!user) return;
                            if (hlPack.owner.id === user.id) {
                              navigate("/profile", { state: { openHighlightId: hlPack.highlight.id } });
                            } else {
                              navigate(`/user/${hlPack.owner.id}`, { state: { openHighlightId: hlPack.highlight.id } });
                            }
                          }}
                        />
                      ) : (
                        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm text-gray-400 font-semibold">
                          Loading…
                        </div>
                      )}
                    </div>
                  ) : listedShare ? (
                    <div className="max-w-[99%] w-[99%] md:w-[760px]">
                      {listedShare.kind === "wallet_offer" ? (
                        <div className="bg-white border border-gray-100 rounded-3xl shadow-sm overflow-hidden">
                          <div className="p-5">
                            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Money</p>
                            <p className="mt-1 font-extrabold text-black text-lg truncate">
                              {(walletOfferCache as any)[listedShare.offer_id]?.note || "Yuto send"}
                            </p>
                            <p className="text-sm text-gray-500 mt-1">
                              Amount:{" "}
                              <span className="font-bold text-black">
                                KSH {Number((walletOfferCache as any)[listedShare.offer_id]?.amount_kes || 0).toLocaleString("en-KE")}
                              </span>
                            </p>
                            <div className="mt-4">
                              {(() => {
                                const offer = (walletOfferCache as any)[listedShare.offer_id] as any;
                                const pending = offer?.status === "pending";
                                const accepted = offer?.status === "accepted";
                                const isSender = !!user && offer && String(offer.sender_id) === String(user.id);
                                const tallBtn = "w-full min-h-[4.5rem] py-5 rounded-2xl text-lg font-extrabold transition-colors";
                                if (!offer) {
                                  return (
                                    <div className={`${tallBtn} bg-gray-100 text-gray-400 flex items-center justify-center`}>Loading…</div>
                                  );
                                }
                                if (isSender) {
                                  if (accepted) {
                                    return (
                                      <button type="button" disabled className={`${tallBtn} bg-green-500 text-white opacity-90 cursor-not-allowed`}>
                                        Accepted
                                      </button>
                                    );
                                  }
                                  return (
                                    <button
                                      type="button"
                                      disabled
                                      className={`${tallBtn} bg-amber-50 text-amber-900 border border-amber-200 cursor-default`}
                                    >
                                      Pending
                                    </button>
                                  );
                                }
                                if (accepted) {
                                  return (
                                    <button type="button" disabled className={`${tallBtn} bg-green-500 text-white opacity-90 cursor-not-allowed`}>
                                      Accepted
                                    </button>
                                  );
                                }
                                if (!pending) {
                                  return (
                                    <button type="button" disabled className={`${tallBtn} bg-gray-200 text-gray-500 cursor-not-allowed`}>
                                      Unavailable
                                    </button>
                                  );
                                }
                                const canAccept =
                                  !!user &&
                                  (!offer.recipient_user_id ||
                                    String(offer.recipient_user_id) === String(user.id));
                                return (
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      if (!user) return;
                                      try {
                                        await acceptWalletOffer(listedShare.offer_id);
                                        const fresh = await getWalletOfferById(listedShare.offer_id);
                                        setWalletOfferCache((prev) => ({ ...prev, [listedShare.offer_id]: fresh }));
                                      } catch (e) {
                                        console.error(e);
                                        toast.error(e instanceof Error ? e.message : "Couldn't accept.");
                                      }
                                    }}
                                    disabled={!canAccept}
                                    className={`${tallBtn} whitespace-nowrap ${
                                      canAccept ? "bg-black hover:bg-gray-800 text-white" : "bg-gray-200 text-gray-400 cursor-not-allowed"
                                    }`}
                                  >
                                    Accept
                                  </button>
                                );
                              })()}
                            </div>
                          </div>
                        </div>
                      ) : listedShare.kind === "group" ? (
                        <div className="bg-white border border-gray-100 rounded-3xl shadow-sm overflow-hidden">
                          {(listedShare as any).media_url ? (
                            <FixedMediaCarousel
                              items={[
                                {
                                  url: String((listedShare as any).media_url),
                                  type: String((listedShare as any).media_type || "").startsWith("video") ? "video" : "image",
                                },
                              ]}
                              showDots={false}
                            />
                          ) : null}
                          <div className="p-5">
                            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Split request</p>
                          <p className="mt-1 font-extrabold text-black text-lg truncate">
                            {sharedGroup?.name || listedShare.memo || "Payment request"}
                          </p>
                          <p className="text-sm text-gray-500 mt-1">
                            Amount:{" "}
                            <span className="font-bold text-black">
                              KSH {(sharedGroup?.per_person || listedShare.amount_kes || 0).toLocaleString("en-KE")}
                            </span>
                          </p>
                          <div className="mt-4 flex flex-col sm:flex-row gap-3">
                            <button
                              type="button"
                              onClick={() => navigate(`/yuto/${listedShare.group_id}`)}
                              className="flex-1 inline-flex items-center justify-center min-h-[4.25rem] px-5 py-4 rounded-2xl bg-gray-100 hover:bg-gray-200 text-black font-bold transition-colors"
                            >
                              View split
                            </button>
                            {groupPaid ? (
                              <button
                                type="button"
                                disabled
                                className="flex-1 inline-flex items-center justify-center min-h-[4.25rem] px-5 py-4 rounded-2xl bg-green-500 text-white font-extrabold opacity-90 cursor-not-allowed"
                              >
                                Paid
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={async () => {
                                  if (!user) return;
                                  const perPerson = Number(sharedGroup?.per_person || listedShare.amount_kes || 0) || 0;
                                  try {
                                    const { error } = await supabase.rpc("pay_for_plan", {
                                      p_group_id: listedShare.group_id,
                                      p_amount: perPerson,
                                    });
                                    if (error) {
                                      const msg = error.message || "";
                                      if (/insufficient|not enough balance|balance too low/i.test(msg)) {
                                        setQuickSplitTopUp({ groupId: listedShare.group_id, amount: perPerson, perPerson });
                                        return;
                                      }
                                      toast.error(msg || "Payment failed.");
                                      return;
                                    }
                                  } catch (e) {
                                    console.error(e);
                                    // Fallback to STK push modal
                                    setGroupPay({ groupId: listedShare.group_id, amount: perPerson });
                                  }
                                }}
                                className="flex-1 inline-flex items-center justify-center min-h-[4.25rem] px-5 py-4 rounded-2xl bg-black hover:bg-gray-800 text-white font-extrabold transition-colors whitespace-nowrap"
                              >
                                Pay now
                              </button>
                            )}
                          </div>
                          </div>
                        </div>
                      ) : sharedItem ? (
                        listedShare.kind === "plan" ? (
                          <PlanCard
                            plan={sharedItem as Plan}
                            currentUserId={user?.id}
                            joiningPlanId={null}
                            onJoinOrLeavePlan={async (p) => {
                              if (!user) return;
                              const pm = p.plan_members ?? [];
                              const isMember = pm.some((mm) => mm.user_id === user.id);
                              if (shareBusyId) return;
                              setShareBusyId(shareKey!);
                              try {
                                if (isMember) await leavePlan(p.id, user.id);
                                else await joinPlan(p.id, user.id, (profile?.display_name || profile?.username || "Someone") as string, p.creator_id);
                                // refresh this plan in cache
                                const { data } = await supabase
                                  .from("plans")
                                  .select("*, creator:profiles!plans_creator_id_fkey(id, username, display_name, avatar_url), plan_members(id, user_id, profiles(id, username, display_name, avatar_url))")
                                  .eq("id", p.id)
                                  .single();
                                setShareCache((prev) => ({ ...prev, [`plan:${p.id}`]: data as any }));
                              } finally {
                                setShareBusyId(null);
                              }
                            }}
                            // No messaging inside DM share cards; go Home if needed.
                            onNavigateToCreator={(creatorId) => navigate(`/user/${creatorId}`)}
                            onNavigateToYutoGroup={(groupId) => navigate(`/yuto/${groupId}`)}
                            onOpenPeople={() => navigate("/home", { state: { focus: { kind: "plan", id: (sharedItem as Plan).id } } })}
                          />
                        ) : (
                          <FunctionCard
                            eventFunction={sharedItem as FunctionListing}
                            currentUserId={user?.id}
                            unreadCount={0}
                            onNavigateToHost={(hostId) => navigate(`/user/${hostId}`)}
                            onJoinFunction={(f) => void handleJoinFunction(f)}
                            onOpenTicket={(f) => setTicketFunction(f)}
                            onOpenFunctionAttendeeChat={async (f) => {
                              try {
                                const gid = await ensureFunctionAttendeeChat(f.id);
                                navigate(`/messages/group/${gid}`);
                              } catch (e) {
                                console.error(e);
                                toast.error("Couldn't open the event chat yet.");
                              }
                            }}
                            onOpenPeople={() => navigate("/home", { state: { focus: { kind: "function", id: (sharedItem as FunctionListing).id } } })}
                          />
                        )
                      ) : shareKey && shareCache[shareKey] === null ? (
                        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm text-gray-500 font-semibold">
                          This item was deleted.
                        </div>
                      ) : (
                        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm text-gray-400 font-semibold">
                          Loading…
                        </div>
                      )}
                      {listedShare.kind !== "group" && (
                        <div className="mt-2 flex justify-end">
                        <button
                          type="button"
                          onClick={() =>
                            navigate("/home", {
                              state: {
                                focus: {
                                  kind: listedShare.kind === "plan" ? "plan" : "function",
                                  id:
                                    listedShare.kind === "plan" ? listedShare.plan_id : listedShare.function_id,
                                },
                              },
                            })
                          }
                          className="text-xs font-bold text-gray-500 hover:text-black"
                        >
                          View on Home
                        </button>
                      </div>
                      )}
                    </div>
                  ) : (
                    <div
                      className={[
                        "max-w-[78%] px-4 py-3 rounded-2xl text-sm font-semibold whitespace-pre-wrap break-words",
                        mine ? "bg-black text-white rounded-br-md" : "bg-gray-100 text-black rounded-bl-md",
                      ].join(" ")}
                    >
                      {m.content}
                    </div>
                  )}
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <ConfirmUnsendModal
        open={!!confirmDeleteMessageId}
        onClose={() => setConfirmDeleteMessageId(null)}
        onConfirm={async () => {
          if (!user || !confirmDeleteMessageId) return;
          const messageId = confirmDeleteMessageId;
          setConfirmDeleteMessageId(null);
          try {
            await deleteDmMessage(messageId, user.id);
            setMessages((prev) => prev.filter((x) => x.id !== messageId));
          } catch (e) {
            console.error(e);
            toast.error("Couldn't delete message.");
          }
        }}
      />

      <div className="px-5 pb-[calc(18px+env(safe-area-inset-bottom))] pt-3 border-t border-gray-100">
        <SmartReplies
          lastMessage={lastReceivedMessage}
          onSelect={(reply) => {
            void sendWithContent(reply);
          }}
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowSharePicker(true)}
            className="w-12 h-12 rounded-2xl bg-gray-100 text-black flex items-center justify-center hover:bg-gray-200 transition-colors"
            aria-label="Share"
            title="Share"
          >
            <Plus size={18} />
          </button>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Message…"
            className="flex-1 bg-gray-100 rounded-2xl px-4 py-3 outline-none font-semibold min-w-0"
            onKeyDown={(e) => {
              if (e.key === "Enter") void onSend();
            }}
          />
          <button
            type="button"
            onClick={() => void onSend()}
            className="w-12 h-12 rounded-2xl bg-black text-white flex items-center justify-center"
            aria-label="Send"
            title="Send"
          >
            <Send size={18} />
          </button>
        </div>
      </div>

      <DmPlusModal
        open={showSharePicker}
        onClose={() => setShowSharePicker(false)}
        onPickPlan={(p: Plan) => {
          setShowSharePicker(false);
          void sendShare(
            { kind: "plan", plan_id: p.id },
            { title: p.title, subtitle: p.creator.display_name, kindLabel: "Plan" },
          );
        }}
        onPickFunction={(fn: FunctionListing, kind) => {
          setShowSharePicker(false);
          if (kind === "function") {
            void sendShare(
              { kind: "function", function_id: fn.id },
              { title: fn.title, subtitle: fn.host.display_name, kindLabel: "Function" },
            );
            return;
          }
          void sendShare(
            { kind: "listing", function_id: fn.id, listing_kind: kind },
            { title: fn.title, subtitle: fn.host.display_name, kindLabel: kind === "sell" ? "Sell" : "Service" },
          );
        }}
        onRequestSplit={(args) => requestSplitInDm(args)}
        onSendMoney={async ({ amountKes, note }) => {
          if (!user || !conversationId || !otherUserId) throw new Error("Missing DM context.");
          const offerId = await createWalletOffer({
            amountKes,
            note: note || null,
            dmConversationId: conversationId,
            recipientUserId: otherUserId,
          });
          await sendDmShareMessage(conversationId, user.id, { kind: "wallet_offer", offer_id: offerId } as any);
          try {
            setComposerYutoBalance(await fetchYutoBalance(user.id));
          } catch {
            /* ignore */
          }
        }}
        sendAvailableBalanceKes={composerYutoBalance}
        sendBalanceLoading={composerBalanceLoading}
      />

      {previewShare && (
        <div className="fixed inset-x-0 bottom-[calc(100px+env(safe-area-inset-bottom))] z-50 flex justify-center px-5 pointer-events-none">
          <div className="pointer-events-auto bg-black text-white rounded-2xl px-4 py-3 shadow-lg max-w-md w-full">
            <p className="font-extrabold">{previewShare.title}</p>
            <p className="text-sm text-white/70">{previewShare.subtitle}</p>
            <button
              type="button"
              className="mt-2 w-full py-2 rounded-xl bg-white text-black font-bold"
              onClick={() => navigate("/home")}
            >
              View on Home
            </button>
          </div>
        </div>
      )}

      {ticketFunction && user && (
        <FunctionTicketModal
          functionItem={shareCache[`fn:${ticketFunction.id}`] ? (shareCache[`fn:${ticketFunction.id}`] as FunctionListing) : ticketFunction}
          userId={user.id}
          attendeeDisplayName={profile?.display_name?.trim() || profile?.username?.trim() || "Guest"}
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
          mpesaPhoneNumber={profile?.phone_number || getSavedPhoneNumber(user.id) || ""}
          initialAmount={functionTopUpAmount}
          contextLine={
            functionTopUpAmount < pendingJoinFunction.amount_per_person
              ? `Joining costs KSH ${pendingJoinFunction.amount_per_person.toLocaleString()}. You're about KSH ${functionTopUpAmount.toLocaleString()} short — add at least that to continue.`
              : `Joining costs KSH ${pendingJoinFunction.amount_per_person.toLocaleString()}. Add at least KSH ${functionTopUpAmount.toLocaleString()} to your balance to continue.`
          }
          retryCtaLabel="I've paid — try joining again"
          onRetryAfterPaid={async () => {
            const fn = pendingJoinFunction;
            if (!fn) return;
            setShowFunctionTopUp(false);
            setPendingJoinFunction(null);
            setFunctionTopUpAmount(MIN_MPESA_TOPUP_KES);
            await handleJoinFunction(fn);
          }}
        />
      )}

      {groupPay && user && (
        <GroupChargeModal
          amount={groupPay.amount}
          groupId={groupPay.groupId}
          userId={user.id}
          defaultPhoneNumber={profile?.phone_number || getSavedPhoneNumber(user.id) || ""}
          onClose={() => setGroupPay(null)}
          onRefreshStatus={async () => {
            const { data } = await supabase
              .from("group_members")
              .select("has_paid")
              .eq("group_id", groupPay.groupId)
              .eq("user_id", user.id)
              .maybeSingle();
            if (data?.has_paid) setGroupPay(null);
          }}
        />
      )}

      {quickSplitTopUp && user && (
        <YutoBalanceTopUpModal
          open
          onClose={() => setQuickSplitTopUp(null)}
          userId={user.id}
          mpesaPhoneNumber={profile?.phone_number || getSavedPhoneNumber(user.id) || ""}
          initialAmount={Math.max(MIN_MPESA_TOPUP_KES, quickSplitTopUp.amount)}
          contextLine={`You're short on Yuto Balance — top up at least KSH ${Math.max(MIN_MPESA_TOPUP_KES, quickSplitTopUp.amount).toLocaleString("en-KE")} to pay this split.`}
          retryCtaLabel="I've paid — pay my share"
          onRetryAfterPaid={async () => {
            const g = quickSplitTopUp;
            if (!g) return;
            setQuickSplitTopUp(null);
            const { error } = await supabase.rpc("pay_for_plan", { p_group_id: g.groupId, p_amount: g.perPerson });
            if (error) {
              toast.error(error.message || "Couldn't pay share yet.");
            }
          }}
        />
      )}
    </div>
  );
}

