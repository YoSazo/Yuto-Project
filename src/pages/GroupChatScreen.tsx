import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Pencil, Plus, Send } from "lucide-react";
import UserAvatar from "../components/UserAvatar";
import { useAuth } from "../contexts/AuthContext";
import {
  getGroupChatMessages,
  getGroupMemberIds,
  getSavedPhoneNumber,
  joinFunction,
  joinPlan,
  leavePlan,
  markGroupChatRead,
  getOrCreateDmConversation,
  sendDmMessage,
  sendDmShareMessage,
  upsertDmBusinessContext,
  sendGroupChatMessage,
  sendGroupChatShareMessage,
  setGroupChatTitle,
  getHighlightById,
  ensureFunctionAttendeeChat,
  supabase,
  type DmSharePayload,
  type GroupChatMessage,
  type GroupChatRow,
  type Highlight,
} from "../lib/supabase";
import { DmPlusModal } from "../components/dm/DmPlusModal";
import type { Plan, FunctionListing } from "./home/types";
import { PlanCard } from "../components/cards/PlanCard";
import { FunctionCard } from "../components/cards/FunctionCard";
import { MIN_MPESA_TOPUP_KES, computeFunctionTopUpGapKes } from "./home/computeTopUp";
import { YutoBalanceTopUpModal } from "../components/wallet/YutoBalanceTopUpModal";
import { DmSharedProfileCard } from "../components/dm/DmSharedProfileCard";
import { DmSharedHighlightCard } from "../components/dm/DmSharedHighlightCard";
import { FunctionTicketModal } from "../components/home/FunctionTicketModal";
import { useThreadScrollToBottom } from "../hooks/useThreadScrollToBottom";
import { GroupChargeModal } from "../components/wallet/GroupChargeModal";

function parseShare(m: GroupChatMessage): DmSharePayload | null {
  if ((m.message_type ?? "text") !== "share") return null;
  const p = m.payload as Record<string, unknown> | null;
  if (!p || typeof p !== "object") return null;
  if (p.kind === "plan" && typeof p.plan_id === "string") return { kind: "plan", plan_id: p.plan_id };
  if (p.kind === "function" && typeof p.function_id === "string")
    return { kind: "function", function_id: p.function_id };
  if (
    p.kind === "listing" &&
    typeof p.function_id === "string" &&
    (p.listing_kind === "sell" || p.listing_kind === "service")
  ) {
    return { kind: "listing", function_id: p.function_id, listing_kind: p.listing_kind };
  }
  if (p.kind === "group" && typeof (p as any).group_id === "string") {
    return {
      kind: "group",
      group_id: String((p as any).group_id),
      amount_kes: typeof (p as any).amount_kes === "number" ? (p as any).amount_kes : undefined,
      memo: typeof (p as any).memo === "string" ? (p as any).memo : undefined,
    } as any;
  }
  if (p.kind === "profile" && typeof p.user_id === "string") return { kind: "profile", user_id: p.user_id };
  if (p.kind === "highlight" && typeof p.highlight_id === "string" && typeof p.user_id === "string") {
    return { kind: "highlight", highlight_id: p.highlight_id, user_id: p.user_id };
  }
  return null;
}

type ProfileRow = { id: string; username: string; display_name: string; avatar_url: string | null };

export default function GroupChatScreen() {
  const { groupId } = useParams<{ groupId: string }>();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [meta, setMeta] = useState<GroupChatRow | null>(null);
  const [messages, setMessages] = useState<GroupChatMessage[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const { scrollViewportRef, bottomRef, contentRef, onScrollViewport } = useThreadScrollToBottom(groupId, loading, messages.length);
  const [showSharePicker, setShowSharePicker] = useState(false);
  const [previewShare, setPreviewShare] = useState<{ title: string; subtitle: string; kindLabel: string } | null>(
    null,
  );
  const [shareCache, setShareCache] = useState<Record<string, Plan | FunctionListing>>({});
  const [highlightShareCache, setHighlightShareCache] = useState<Record<string, { highlight: Highlight; owner: ProfileRow }>>({});
  const [shareBusyId, setShareBusyId] = useState<string | null>(null);
  const [ticketFunction, setTicketFunction] = useState<FunctionListing | null>(null);
  const [showFunctionTopUp, setShowFunctionTopUp] = useState(false);
  const [functionTopUpAmount, setFunctionTopUpAmount] = useState(MIN_MPESA_TOPUP_KES);
  const [pendingJoinFunction, setPendingJoinFunction] = useState<FunctionListing | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameDraft, setRenameDraft] = useState("");
  const [renameSaving, setRenameSaving] = useState(false);
  const [groupPay, setGroupPay] = useState<{ groupId: string; amount: number } | null>(null);
  const [groupShareCache, setGroupShareCache] = useState<Record<string, { id: string; name: string; per_person: number; status: string }>>({});
  const [groupPaidById, setGroupPaidById] = useState<Record<string, boolean>>({});
  const [quickSplitTopUp, setQuickSplitTopUp] = useState<{ groupId: string; amount: number; perPerson: number } | null>(null);

  useEffect(() => {
    if (!groupId || !user) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const [{ data: g }, rows] = await Promise.all([
          supabase.from("group_chats").select("id, created_by, title, created_at").eq("id", groupId).single(),
          getGroupChatMessages(groupId),
        ]);
        if (cancelled) return;
        setMeta(g as GroupChatRow);
        setMessages(rows);
        try {
          await markGroupChatRead(groupId, user.id);
        } catch {
          // `group_chat_reads` missing until migration is applied
        }
      } catch (e) {
        console.error(e);
        setMeta(null);
      } finally {
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [groupId, user]);

  useEffect(() => {
    if (!groupId) return;
    const channel = supabase
      .channel(`group:${groupId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "group_chat_messages", filter: `group_id=eq.${groupId}` },
        async (payload) => {
          const row = payload.new as GroupChatMessage;
          const uid = user?.id;
          if (uid) void markGroupChatRead(groupId!, uid).catch(() => {});
          const { data: sender } = await supabase
            .from("profiles")
            .select("id, username, display_name, avatar_url")
            .eq("id", row.sender_id)
            .single();
          setMessages((prev) => {
            if (prev.some((m) => m.id === row.id)) return prev;
            return [...prev, { ...row, sender: sender as GroupChatMessage["sender"] }];
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "group_chats", filter: `id=eq.${groupId}` },
        (payload) => {
          const row = payload.new as { title?: string | null };
          setMeta((prev) =>
            prev && prev.id === groupId ? { ...prev, title: row.title != null ? String(row.title) : prev.title } : prev,
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId, user]);

  useEffect(() => {
    if (!groupId) return;
    const shares = messages
      .map((m) => ({ id: m.id, payload: parseShare(m) }))
      .filter((x): x is { id: string; payload: DmSharePayload } => !!x.payload && x.payload.kind !== "profile");

    const missing = shares.filter((s) => {
      if (s.payload.kind === "highlight") return false;
      if (s.payload.kind === "group") return !groupShareCache[(s.payload as any).group_id];
      if (s.payload.kind === "plan") return !shareCache[`plan:${s.payload.plan_id}`];
      if (s.payload.kind === "function" || s.payload.kind === "listing") return !shareCache[`fn:${(s.payload as { function_id: string }).function_id}`];
      return false;
    });
    if (missing.length === 0) return;

    let cancelled = false;
    (async () => {
      try {
        const groupIds = missing
          .filter((m) => m.payload.kind === "group")
          .map((m) => ((m.payload as any).group_id as string))
          .filter(Boolean);
        const planIds = missing.filter((m) => m.payload.kind === "plan").map((m) => (m.payload as { plan_id: string }).plan_id);
        const fnIds = missing
          .filter((m) => m.payload.kind === "function" || m.payload.kind === "listing")
          .map((m) => (m.payload as { function_id: string }).function_id);

        const planPromise =
          planIds.length === 0
            ? Promise.resolve({ data: [] as Record<string, unknown>[], error: null })
            : supabase
                .from("plans")
                .select(
                  "*, creator:profiles!plans_creator_id_fkey(id, username, display_name, avatar_url), plan_members(id, user_id, profiles(id, username, display_name, avatar_url))",
                )
                .in("id", planIds);

        const fnPromise =
          fnIds.length === 0
            ? Promise.resolve({ data: [] as Record<string, unknown>[], error: null })
            : supabase
                .from("functions")
                .select(
                  "*, host:profiles!functions_host_id_fkey(id, username, display_name, avatar_url), function_members(id, user_id, has_paid, joined_at, paid_at, buyer_confirmed_at, profiles(id, username, display_name, avatar_url))",
                )
                .in("id", fnIds);

        const groupPromise =
          groupIds.length === 0
            ? Promise.resolve({ data: [] as Record<string, unknown>[], error: null })
            : supabase.from("groups").select("id, name, per_person, status").in("id", groupIds);

        const [
          { data: planRows, error: planErr },
          { data: fnRows, error: fnErr },
          { data: groupRows, error: groupErr },
        ] = await Promise.all([planPromise, fnPromise, groupPromise]);

        if (planErr) throw planErr;
        if (fnErr) throw fnErr;
        if (groupErr) throw groupErr;

        if (cancelled) return;
        setShareCache((prev) => {
          const next = { ...prev };
          (planRows || []).forEach((p) => (next[`plan:${(p as { id: string }).id}`] = p as Plan));
          (fnRows || []).forEach((f) => (next[`fn:${(f as { id: string }).id}`] = f as FunctionListing));
          return next;
        });
        setGroupShareCache((prev) => {
          const next = { ...prev };
          (groupRows || []).forEach((g: any) => {
            next[String(g.id)] = { id: String(g.id), name: String(g.name || "Split"), per_person: Number(g.per_person || 0), status: String(g.status || "active") };
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
  }, [messages, shareCache, groupShareCache, groupId]);

  useEffect(() => {
    if (!groupId) return;
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
  }, [messages, highlightShareCache, groupId]);

  // Live paid-state for quick split cards (flip Pay -> Paid) for the current user.
  useEffect(() => {
    if (!user) return;
    const groupIds = Array.from(
      new Set(
        messages
          .map((m) => parseShare(m))
          .filter((p): p is any => p?.kind === "group")
          .map((p: any) => String(p.group_id || "")),
      ),
    ).filter(Boolean);
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
      .channel(`groupchat-quick-split-paid-${user.id}`)
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

  const title = useMemo(() => meta?.title?.trim() || "Group chat", [meta]);

  const sendShare = async (payload: DmSharePayload, preview: { title: string; subtitle: string; kindLabel: string }) => {
    if (!user || !groupId) return;
    try {
      await sendGroupChatShareMessage(groupId, user.id, payload);
      setPreviewShare(preview);
      setTimeout(() => setPreviewShare(null), 1400);
    } catch (e) {
      console.error(e);
      alert("Couldn't send. Try again.");
    }
  };

  const requestSplitInGroupChat = async (args: { amountKes: number; memo: string }) => {
    if (!user || !groupId) return;
    const memberIds = (await getGroupMemberIds(groupId)).filter(Boolean);
    const unique = Array.from(new Set(memberIds));
    if (unique.length < 2) throw new Error("Need at least 2 members.");
    const perPerson = Math.ceil(args.amountKes / unique.length);
    const { createGroup } = await import("../lib/supabase");
    const group = await createGroup(
      args.memo?.trim() ? args.memo.trim() : "Group split",
      args.amountKes,
      perPerson,
      user.id,
      unique,
      "single",
    );
    // requester already paid the full amount; others owe shares
    await supabase
      .from("group_members")
      .update({ has_paid: true, paid_at: new Date().toISOString(), has_joined: true, joined_at: new Date().toISOString() })
      .eq("group_id", group.id)
      .eq("user_id", user.id);
    setGroupShareCache((prev) => ({ ...prev, [group.id]: { id: group.id, name: group.name, per_person: group.per_person, status: group.status } }));
    await sendGroupChatShareMessage(groupId, user.id, { kind: "group", group_id: group.id, amount_kes: perPerson, memo: args.memo } as any);
    await sendGroupChatMessage(groupId, user.id, `Split created: KSH ${perPerson.toLocaleString("en-KE")} each${args.memo ? ` for ${args.memo}` : ""}.`);
  };

  const handleJoinFunction = async (eventFunction: FunctionListing) => {
    if (!user) return;
    const members = eventFunction.function_members ?? [];
    const isMember = members.some((m) => m.user_id === user.id);
    const cap = eventFunction.max_capacity;
    const isFull = cap != null ? members.length >= cap && !isMember : false;
    if (isFull) {
      alert("This function is currently full!");
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

      const { data } = await supabase
        .from("functions")
        .select(
          "*, host:profiles!functions_host_id_fkey(id, username, display_name, avatar_url), function_members(id, user_id, has_paid, joined_at, paid_at, buyer_confirmed_at, profiles(id, username, display_name, avatar_url))",
        )
        .eq("id", eventFunction.id)
        .single();
      setShareCache((prev) => ({ ...prev, [`fn:${eventFunction.id}`]: data as FunctionListing }));

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
          // Stay in current group chat; provider DM is created silently for fulfillment.
        } catch (e) {
          console.error(e);
        }
      }

      setTicketFunction(data as FunctionListing);
    } catch (err) {
      console.error("Error joining function", err);
      alert("Couldn't complete that action. Try again.");
    }
  };

  const onSend = async () => {
    if (!user || !groupId) return;
    const content = text.trim();
    if (!content) return;
    setText("");
    try {
      await sendGroupChatMessage(groupId, user.id, content);
    } catch (e) {
      console.error(e);
      alert("Couldn't send. Try again.");
      setText(content);
    }
  };

  const renderListedShareBlock = (
    share: Exclude<DmSharePayload, { kind: "profile" } | { kind: "highlight" }>,
    shareKey: string,
    mine: boolean,
  ) => {
    if (share.kind === "group") {
      const g = groupShareCache[share.group_id];
      const amt = g?.per_person || (share as any).amount_kes || 0;
      const title = g?.name || (share as any).memo || "Split request";
      const paid = !!groupPaidById[share.group_id];
      return (
        <div className="w-full max-w-[min(100vw-4rem,28rem)]">
          <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Split request</p>
            <p className="mt-1 font-extrabold text-black text-lg truncate">{title}</p>
            <p className="text-sm text-gray-500 mt-1">
              Amount: <span className="font-bold text-black">KSH {Number(amt).toLocaleString("en-KE")}</span>
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => navigate(`/yuto/${share.group_id}`)}
                className="flex-1 h-11 rounded-2xl bg-gray-100 hover:bg-gray-200 text-black font-bold transition-colors"
              >
                View split
              </button>
              {paid ? (
                <button
                  type="button"
                  disabled
                  className="flex-1 h-11 rounded-2xl bg-green-500 text-white font-extrabold opacity-90 cursor-not-allowed"
                >
                  Paid
                </button>
              ) : (
                <button
                  type="button"
                  onClick={async () => {
                    if (!user) return;
                    const perPerson = Number(amt) || 0;
                    try {
                      const { error } = await supabase.rpc("pay_for_plan", { p_group_id: share.group_id, p_amount: perPerson });
                      if (error) {
                        const msg = error.message || "";
                        if (/insufficient|not enough balance|balance too low/i.test(msg)) {
                          setQuickSplitTopUp({ groupId: share.group_id, amount: perPerson, perPerson });
                          return;
                        }
                        alert(msg || "Payment failed.");
                        return;
                      }
                    } catch (e) {
                      console.error(e);
                      // fallback to STK push
                      setGroupPay({ groupId: share.group_id, amount: perPerson });
                    }
                  }}
                  className="flex-1 h-11 rounded-2xl bg-black hover:bg-gray-800 text-white font-extrabold transition-colors"
                >
                  Pay your share
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }
    const sharedItem = shareCache[shareKey];
    const focusKind = share.kind === "plan" ? "plan" : "function";
    const focusId = share.kind === "plan" ? share.plan_id : share.function_id;
    const flexBtn = mine ? "justify-end" : "justify-start";

    return (
      <div className="w-full max-w-[min(100vw-4rem,28rem)]">
        {sharedItem ? (
          share.kind === "plan" ? (
            <PlanCard
              plan={sharedItem as Plan}
              currentUserId={user?.id}
              joiningPlanId={null}
              onJoinOrLeavePlan={async (p) => {
                if (!user) return;
                const pm = p.plan_members ?? [];
                const isMember = pm.some((mm) => mm.user_id === user.id);
                if (shareBusyId) return;
                setShareBusyId(shareKey);
                try {
                  if (isMember) await leavePlan(p.id, user.id);
                  else
                    await joinPlan(
                      p.id,
                      user.id,
                      (profile?.display_name || profile?.username || "Someone") as string,
                      p.creator_id,
                    );
                  const { data } = await supabase
                    .from("plans")
                    .select(
                      "*, creator:profiles!plans_creator_id_fkey(id, username, display_name, avatar_url), plan_members(id, user_id, profiles(id, username, display_name, avatar_url))",
                    )
                    .eq("id", p.id)
                    .single();
                  setShareCache((prev) => ({ ...prev, [`plan:${p.id}`]: data as Plan }));
                } finally {
                  setShareBusyId(null);
                }
              }}
              onNavigateToCreator={(creatorId) => navigate(`/user/${creatorId}`)}
              onNavigateToYutoGroup={(gid) => navigate(`/yuto/${gid}`)}
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
                  alert("Couldn't open the event chat yet.");
                }
              }}
              onOpenPeople={() =>
                navigate("/home", { state: { focus: { kind: "function", id: (sharedItem as FunctionListing).id } } })
              }
            />
          )
        ) : (
          <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm text-gray-400 font-semibold">Loading…</div>
        )}
        <div className={`mt-2 flex ${flexBtn}`}>
          <button
            type="button"
            onClick={() => navigate("/home", { state: { focus: { kind: focusKind, id: focusId } } })}
            className="text-xs font-bold text-gray-500 hover:text-black"
          >
            View on Home
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="h-[100dvh] flex flex-col bg-white">
      <div className="px-5 pt-6 pb-4 border-b border-gray-100 flex items-start gap-3 shrink-0">
        <button type="button" onClick={() => navigate(-1)} className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center shrink-0 mt-0.5">
          <ArrowLeft size={18} />
        </button>
        <div className="min-w-0 flex-1 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => groupId && navigate(`/messages/group/${groupId}/members`)}
              className="bg-transparent border-none p-0 text-left font-extrabold text-black truncate hover:opacity-80 transition-opacity"
              aria-label="View members"
              title="View members"
            >
              {title}
            </button>
            <p className="text-xs text-gray-400">Group</p>
          </div>
          {meta && (
            <button
              type="button"
              onClick={() => {
                setRenameDraft((meta.title || "").trim() || "Group chat");
                setRenameOpen(true);
              }}
              className="w-10 h-10 rounded-xl bg-gray-100 text-black flex items-center justify-center hover:bg-gray-200 transition-colors shrink-0"
              aria-label="Rename group"
              title="Rename group"
            >
              <Pencil size={18} />
            </button>
          )}
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
          <div ref={contentRef} className="w-full">
            {!meta ? (
              <div className="py-16 text-center text-gray-400 font-semibold">Group not found</div>
            ) : (
          <div className="flex flex-col gap-3">
            {messages.map((m) => {
              const mine = m.sender_id === user?.id;
              const label = mine ? "You" : m.sender?.display_name?.trim() || "Member";
              const avatarName = mine
                ? profile?.display_name?.trim() || "You"
                : m.sender?.display_name?.trim() || "Member";
              const avatarUrl = mine ? profile?.avatar_url ?? null : m.sender?.avatar_url ?? null;
              const shareFull = parseShare(m);
              const profileShare = shareFull?.kind === "profile" ? shareFull : null;
              const hlShare = shareFull?.kind === "highlight" ? shareFull : null;
              const listedShare =
                shareFull && shareFull.kind !== "profile" && shareFull.kind !== "highlight"
                  ? (shareFull as Exclude<DmSharePayload, { kind: "profile" } | { kind: "highlight" }>)
                  : null;
              const shareKey =
                listedShare?.kind === "plan" ? `plan:${listedShare.plan_id}` : listedShare ? `fn:${listedShare.function_id}` : null;
              const hlKey = hlShare ? `hl:${hlShare.highlight_id}` : null;
              const hlPack = hlKey ? highlightShareCache[hlKey] : null;
              const isShareRow = !!(profileShare || hlShare || (listedShare && shareKey));

              return (
                <div
                  key={m.id}
                  className={`flex gap-2.5 items-start ${isShareRow ? "max-w-full" : "max-w-[85%]"} ${mine ? "ml-auto flex-row-reverse" : "mr-auto"}`}
                >
                  <UserAvatar name={avatarName} avatarUrl={avatarUrl} size="sm" className="ring-2 ring-white shrink-0" />
                  <div className={`min-w-0 flex flex-col gap-1 flex-1 ${mine ? "items-end" : "items-start"}`}>
                    <span className="text-[11px] font-semibold text-gray-500 leading-none px-0.5">{label}</span>
                    {profileShare ? (
                      user?.id ? <DmSharedProfileCard viewerUserId={user.id} sharedUserId={profileShare.user_id} /> : null
                    ) : hlShare && user ? (
                      hlPack ? (
                        <DmSharedHighlightCard
                          highlight={hlPack.highlight}
                          ownerName={hlPack.owner.display_name}
                          ownerAvatarUrl={hlPack.owner.avatar_url}
                          onOpen={() => {
                            if (hlPack.owner.id === user.id) {
                              navigate("/profile", { state: { openHighlightId: hlPack.highlight.id } });
                            } else {
                              navigate(`/user/${hlPack.owner.id}`, { state: { openHighlightId: hlPack.highlight.id } });
                            }
                          }}
                        />
                      ) : (
                        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm text-gray-400 font-semibold">Loading…</div>
                      )
                    ) : listedShare && shareKey ? (
                      renderListedShareBlock(listedShare, shareKey, mine)
                    ) : (
                      <div
                        className={`px-4 py-3 rounded-2xl text-sm font-semibold whitespace-pre-wrap break-words ${
                          mine ? "bg-black text-white rounded-br-md" : "bg-gray-100 text-black rounded-bl-md"
                        }`}
                      >
                        {m.content}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
            )}
          </div>
        )}
      </div>

      <div className="px-5 pb-[calc(18px+env(safe-area-inset-bottom))] pt-3 border-t border-gray-100 shrink-0">
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
            placeholder="Message the group…"
            className="flex-1 bg-gray-100 rounded-2xl px-4 py-3 outline-none font-semibold min-w-0"
            onKeyDown={(e) => {
              if (e.key === "Enter") void onSend();
            }}
          />
          <button type="button" onClick={() => void onSend()} className="w-12 h-12 rounded-2xl bg-black text-white flex items-center justify-center" aria-label="Send">
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
        onRequestSplit={(args) => requestSplitInGroupChat(args)}
      />

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
            if (error) alert(error.message || "Couldn't pay share yet.");
          }}
        />
      )}

      {previewShare && (
        <div className="fixed inset-x-0 bottom-[calc(100px+env(safe-area-inset-bottom))] z-50 flex justify-center px-5 pointer-events-none">
          <div className="pointer-events-auto bg-black text-white rounded-2xl px-4 py-3 shadow-lg max-w-md w-full">
            <p className="font-extrabold">{previewShare.title}</p>
            <p className="text-sm text-white/70">{previewShare.subtitle}</p>
            <button type="button" className="mt-2 w-full py-2 rounded-xl bg-white text-black font-bold" onClick={() => navigate("/home")}>
              View on Home
            </button>
          </div>
        </div>
      )}

      {renameOpen && groupId && (
        <div
          className="fixed inset-0 bg-black/60 z-[55] flex items-end md:items-center justify-center"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !renameSaving) setRenameOpen(false);
          }}
          role="presentation"
        >
          <div className="bg-white rounded-t-3xl md:rounded-3xl w-full max-w-md p-6 modal-slide-up">
            <h3 className="font-bold text-lg text-black mb-2">Rename group</h3>
            <p className="text-sm text-gray-500 mb-4">Shown in your messages list. Clear name to reset to “Group chat”.</p>
            <input
              className="w-full bg-gray-100 rounded-2xl px-4 py-3 font-semibold outline-none mb-4 min-w-0"
              value={renameDraft}
              maxLength={80}
              placeholder="Group chat"
              autoFocus
              onChange={(e) => setRenameDraft(e.target.value)}
            />
            <div className="flex gap-2">
              <button
                type="button"
                className="flex-1 py-3 rounded-2xl font-bold bg-gray-100 text-black"
                disabled={renameSaving}
                onClick={() => setRenameOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="flex-1 py-3 rounded-2xl font-bold bg-black text-white disabled:opacity-50"
                disabled={renameSaving}
                onClick={() => {
                  void (async () => {
                    setRenameSaving(true);
                    try {
                      await setGroupChatTitle(groupId, renameDraft);
                      const t = renameDraft.trim();
                      const nextTitle = !t || t.toLowerCase() === "group chat" ? "Group chat" : t.slice(0, 80);
                      setMeta((prev) => (prev && prev.id === groupId ? { ...prev, title: nextTitle } : prev));
                      setRenameOpen(false);
                    } catch (e) {
                      console.error(e);
                      alert("Couldn't rename the group yet. Run the latest migrations or try again.");
                    }
                    setRenameSaving(false);
                  })();
                }}
              >
                {renameSaving ? "Saving…" : "Save"}
              </button>
            </div>
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
    </div>
  );
}
