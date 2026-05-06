import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Send } from "lucide-react";
import UserAvatar from "../components/UserAvatar";
import { useAuth } from "../contexts/AuthContext";
import {
  getGroupChatMessages,
  markGroupChatRead,
  sendGroupChatMessage,
  supabase,
  type GroupChatMessage,
  type GroupChatRow,
} from "../lib/supabase";

export default function GroupChatScreen() {
  const { groupId } = useParams<{ groupId: string }>();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [meta, setMeta] = useState<GroupChatRow | null>(null);
  const [messages, setMessages] = useState<GroupChatMessage[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement | null>(null);

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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId, user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const title = useMemo(() => meta?.title?.trim() || "Group chat", [meta]);

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

  return (
    <div className="h-[100dvh] flex flex-col bg-white">
      <div className="px-5 pt-6 pb-4 border-b border-gray-100 flex items-center gap-3 shrink-0">
        <button type="button" onClick={() => navigate(-1)} className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
          <ArrowLeft size={18} />
        </button>
        <div className="min-w-0">
          <p className="font-extrabold text-black truncate">{title}</p>
          <p className="text-xs text-gray-400">Group</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !meta ? (
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

              return (
                <div
                  key={m.id}
                  className={`flex gap-2.5 items-start max-w-[85%] ${mine ? "ml-auto flex-row-reverse" : "mr-auto"}`}
                >
                  <UserAvatar name={avatarName} avatarUrl={avatarUrl} size="sm" className="ring-2 ring-white shrink-0" />
                  <div className={`min-w-0 flex flex-col gap-1 ${mine ? "items-end" : "items-start"}`}>
                    <span className="text-[11px] font-semibold text-gray-500 leading-none px-0.5">{label}</span>
                    <div
                      className={`px-4 py-3 rounded-2xl text-sm font-semibold whitespace-pre-wrap break-words ${
                        mine ? "bg-black text-white rounded-br-md" : "bg-gray-100 text-black rounded-bl-md"
                      }`}
                    >
                      {m.content}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <div className="px-5 pb-[calc(18px+env(safe-area-inset-bottom))] pt-3 border-t border-gray-100 shrink-0">
        <div className="flex items-center gap-2">
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
    </div>
  );
}
