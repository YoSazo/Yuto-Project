import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Plus, Send } from "lucide-react";
import UserAvatar from "../components/UserAvatar";
import { useAuth } from "../contexts/AuthContext";
import { getDmMessages, markDmRead, sendDmMessage, sendDmShareMessage, supabase, type DmMessage, type DmSharePayload } from "../lib/supabase";
import { DmSharePickerModal } from "../components/dm/DmSharePickerModal";
import type { Plan, FunctionListing } from "./home/types";

type ProfileRow = { id: string; username: string; display_name: string; avatar_url: string | null };

export default function DirectMessageScreen() {
  const { user } = useAuth();
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

  const parseShare = (m: DmMessage): DmSharePayload | null => {
    if (m.message_type !== "share") return null;
    const p = m.payload as any;
    if (!p || typeof p !== "object") return null;
    if (p.kind === "plan" && typeof p.plan_id === "string") return { kind: "plan", plan_id: p.plan_id };
    if (p.kind === "function" && typeof p.function_id === "string") return { kind: "function", function_id: p.function_id };
    if (p.kind === "listing" && typeof p.function_id === "string" && (p.listing_kind === "sell" || p.listing_kind === "service")) {
      return { kind: "listing", function_id: p.function_id, listing_kind: p.listing_kind };
    }
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
  }, [conversationId]);

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
              return (
                <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  {share ? (
                    <button
                      type="button"
                      onClick={() => {
                        const kindLabel = share.kind === "plan" ? "Plan" : share.kind === "function" ? "Function" : share.listing_kind === "sell" ? "Sell" : "Service";
                        setPreviewShare({
                          title: "Shared item",
                          subtitle: `Tap to view on Home (${kindLabel})`,
                          kindLabel,
                        });
                      }}
                      className={[
                        "max-w-[82%] w-[82%] md:w-[360px] px-4 py-4 rounded-2xl border text-left",
                        mine ? "bg-black text-white border-white/10" : "bg-white text-black border-gray-200",
                      ].join(" ")}
                    >
                      <p className={["text-[11px] font-extrabold uppercase tracking-wider", mine ? "text-white/70" : "text-gray-400"].join(" ")}>
                        {share.kind === "plan" ? "Plan" : share.kind === "function" ? "Function" : share.listing_kind === "sell" ? "Sell" : "Service"} shared
                      </p>
                      <p className={["mt-1 font-extrabold text-base", mine ? "text-white" : "text-black"].join(" ")}>
                        {share.kind === "plan" ? `Plan #${share.plan_id.slice(0, 6)}` : `Item #${share.function_id.slice(0, 6)}`}
                      </p>
                      <p className={["mt-1 text-sm font-semibold", mine ? "text-white/75" : "text-gray-500"].join(" ")}>
                        Tap to view on Home
                      </p>
                      <div className="mt-3">
                        <span className={["inline-flex items-center justify-center px-3 py-2 rounded-xl font-bold text-sm", mine ? "bg-white text-black" : "bg-black text-white"].join(" ")}>
                          View
                        </span>
                      </div>
                    </button>
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
            className="flex-1 bg-gray-100 rounded-2xl px-4 py-3 outline-none font-semibold"
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
    </div>
  );
}

