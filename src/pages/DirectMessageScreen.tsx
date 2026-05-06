import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Send } from "lucide-react";
import UserAvatar from "../components/UserAvatar";
import { useAuth } from "../contexts/AuthContext";
import { getDmMessages, sendDmMessage, supabase, type DmMessage } from "../lib/supabase";

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
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!user || !conversationId) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const rows = await getDmMessages(conversationId);
        if (cancelled) return;
        setMessages(rows);

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
              return (
                <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={[
                      "max-w-[78%] px-4 py-3 rounded-2xl text-sm font-semibold whitespace-pre-wrap break-words",
                      mine ? "bg-black text-white rounded-br-md" : "bg-gray-100 text-black rounded-bl-md",
                    ].join(" ")}
                  >
                    {m.content}
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <div className="px-5 pb-[calc(18px+env(safe-area-inset-bottom))] pt-3 border-t border-gray-100">
        <div className="flex items-center gap-2">
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
    </div>
  );
}

