import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Plus, Send } from "lucide-react";
import UserAvatar from "../components/UserAvatar";
import { useAuth } from "../contexts/AuthContext";
import {
  getSavedPhoneNumber,
  getDmMessages,
  joinFunction,
  joinPlan,
  leavePlan,
  markDmRead,
  sendDmMessage,
  sendDmShareMessage,
  supabase,
  type DmMessage,
  type DmSharePayload,
} from "../lib/supabase";
import { DmSharePickerModal } from "../components/dm/DmSharePickerModal";
import { DmSharedProfileCard } from "../components/dm/DmSharedProfileCard";
import type { Plan, FunctionListing } from "./home/types";
import { PlanCard } from "../components/cards/PlanCard";
import { FunctionCard } from "../components/cards/FunctionCard";
import { MIN_MPESA_TOPUP_KES, computeFunctionTopUpGapKes } from "./home/computeTopUp";
import { YutoBalanceTopUpModal } from "../components/wallet/YutoBalanceTopUpModal";

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
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [shareCache, setShareCache] = useState<Record<string, Plan | FunctionListing>>({});
  const [shareBusyId, setShareBusyId] = useState<string | null>(null);
  const [showFunctionTopUp, setShowFunctionTopUp] = useState(false);
  const [functionTopUpAmount, setFunctionTopUpAmount] = useState(MIN_MPESA_TOPUP_KES);
  const [pendingJoinFunction, setPendingJoinFunction] = useState<FunctionListing | null>(null);

  const parseShare = (m: DmMessage): DmSharePayload | null => {
    if (m.message_type !== "share") return null;
    const p = m.payload as any;
    if (!p || typeof p !== "object") return null;
    if (p.kind === "plan" && typeof p.plan_id === "string") return { kind: "plan", plan_id: p.plan_id };
    if (p.kind === "function" && typeof p.function_id === "string") return { kind: "function", function_id: p.function_id };
    if (p.kind === "listing" && typeof p.function_id === "string" && (p.listing_kind === "sell" || p.listing_kind === "service")) {
      return { kind: "listing", function_id: p.function_id, listing_kind: p.listing_kind };
    }
    if (p.kind === "profile" && typeof p.user_id === "string") return { kind: "profile", user_id: p.user_id };
    return null;
  };

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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const title = useMemo(() => other?.display_name || "Message", [other]);

  const onSend = async () => {
    if (!user || !conversationId) return;
    const content = text.trim();
    if (!content) return;
    setText("");
    try {
      await sendDmMessage(conversationId, user.id, content);
    } catch (e) {
      console.error(e);
      alert("Couldn't send. Try again.");
      setText(content);
    }
  };

  const sendShare = async (payload: DmSharePayload, preview: { title: string; subtitle: string; kindLabel: string }) => {
    if (!user || !conversationId) return;
    try {
      await sendDmShareMessage(conversationId, user.id, payload);
      setPreviewShare(preview);
      setTimeout(() => setPreviewShare(null), 1400);
    } catch (e) {
      console.error(e);
      alert("Couldn't send. Try again.");
    }
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
          "*, host:profiles!functions_host_id_fkey(id, username, display_name, avatar_url), function_members(id, user_id, has_paid, joined_at, profiles(id, username, display_name, avatar_url))",
        )
        .eq("id", eventFunction.id)
        .single();
      setShareCache((prev) => ({ ...prev, [`fn:${eventFunction.id}`]: data as any }));
    } catch (err) {
      console.error("Error joining function", err);
      alert("Couldn't complete that action. Try again.");
    }
  };

  useEffect(() => {
    if (!conversationId) return;
    const shares = messages
      .map((m) => ({ id: m.id, payload: parseShare(m) }))
      .filter((x): x is { id: string; payload: DmSharePayload } => !!x.payload && x.payload.kind !== "profile");

    const missing = shares.filter((s) => {
      const key = s.payload.kind === "plan" ? `plan:${s.payload.plan_id}` : `fn:${s.payload.function_id}`;
      return !shareCache[key];
    });
    if (missing.length === 0) return;

    let cancelled = false;
    (async () => {
      try {
        const { data: planRows, error: planErr } = await supabase
          .from("plans")
          .select("*, creator:profiles!plans_creator_id_fkey(id, username, display_name, avatar_url), plan_members(id, user_id, profiles(id, username, display_name, avatar_url))")
          .in(
            "id",
            missing.filter((m) => m.payload.kind === "plan").map((m) => (m.payload as any).plan_id),
          );
        if (planErr) throw planErr;

        const { data: fnRows, error: fnErr } = await supabase
          .from("functions")
          .select("*, host:profiles!functions_host_id_fkey(id, username, display_name, avatar_url), function_members(id, user_id, has_paid, joined_at, profiles(id, username, display_name, avatar_url))")
          .in(
            "id",
            missing
              .filter((m) => m.payload.kind !== "plan")
              .map((m) => (m.payload as any).function_id),
          );
        if (fnErr) throw fnErr;

        if (cancelled) return;
        setShareCache((prev) => {
          const next = { ...prev };
          (planRows || []).forEach((p) => (next[`plan:${(p as any).id}`] = p as any));
          (fnRows || []).forEach((f) => (next[`fn:${(f as any).id}`] = f as any));
          return next;
        });
      } catch (e) {
        console.error(e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [messages, shareCache, conversationId]);

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

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {messages.map((m) => {
              const mine = m.sender_id === user?.id;
              const share = parseShare(m);
              const profileShare = share?.kind === "profile" ? share : null;
              const listedShare =
                share && share.kind !== "profile" ? (share as Exclude<DmSharePayload, { kind: "profile" }>) : null;
              const shareKey =
                listedShare?.kind === "plan"
                  ? `plan:${listedShare.plan_id}`
                  : listedShare
                    ? `fn:${listedShare.function_id}`
                    : null;
              const sharedItem = shareKey ? shareCache[shareKey] : null;
              return (
                <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  {profileShare ? (
                    <div className="max-w-[95%] w-[95%] md:w-[340px]">
                      {user?.id ? (
                        <DmSharedProfileCard viewerUserId={user.id} sharedUserId={profileShare.user_id} />
                      ) : null}
                    </div>
                  ) : listedShare ? (
                    <div className="max-w-[95%] w-[95%] md:w-[420px]">
                      {sharedItem ? (
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
                            // Ticket/threads are Home-only for now.
                            onOpenPeople={() => navigate("/home", { state: { focus: { kind: "function", id: (sharedItem as FunctionListing).id } } })}
                          />
                        )
                      ) : (
                        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm text-gray-400 font-semibold">
                          Loading…
                        </div>
                      )}
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

      <div className="px-5 pb-[calc(18px+env(safe-area-inset-bottom))] pt-3 border-t border-gray-100">
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

      <DmSharePickerModal
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

