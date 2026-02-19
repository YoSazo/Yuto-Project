import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";

interface Message {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles: {
    display_name: string;
  };
}

export default function YutoChatScreen() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const groupName = (location.state as { groupName?: string })?.groupName || "Fare Share";

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load messages
  useEffect(() => {
    if (!groupId) return;

    const load = async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("id, user_id, content, created_at, profiles(display_name)")
        .eq("group_id", groupId)
        .order("created_at", { ascending: true });

      if (!error && data) setMessages(data as Message[]);
      setLoading(false);
    };

    load();

    // Realtime subscription
    const channel = supabase
      .channel(`chat-${groupId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `group_id=eq.${groupId}`,
        },
        async (payload) => {
          // Fetch full message with profile
          const { data } = await supabase
            .from("messages")
            .select("id, user_id, content, created_at, profiles(display_name)")
            .eq("id", payload.new.id)
            .single();
          if (data) setMessages((prev) => [...prev, data as Message]);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [groupId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!inputText.trim() || !groupId || !user || sending) return;
    const text = inputText.trim();
    setInputText("");
    setSending(true);

    const { error } = await supabase.from("messages").insert({
      group_id: groupId,
      user_id: user.id,
      content: text,
    });

    if (error) {
      console.error("Failed to send message:", error);
      setInputText(text); // restore if failed
    }
    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-12 pb-3 border-b border-gray-100">
        <button
          onClick={() => navigate(-1)}
          className="bg-transparent border-none cursor-pointer text-gray-400 hover:text-black"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <p className="font-bold text-lg text-black">{groupName}</p>
        <div className="w-9 h-9 bg-black rounded-full flex items-center justify-center">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-400 text-sm">Loading messages...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <p className="text-gray-400 text-sm">No messages yet</p>
            <p className="text-gray-300 text-xs">Say hi to the group! 👋</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {messages.map((msg) => {
              const isMe = msg.user_id === user?.id;
              return (
                <div
                  key={msg.id}
                  className={`flex items-end gap-2.5 ${isMe ? "flex-row-reverse" : "flex-row"}`}
                >
                  {!isMe && (
                    <div className="w-8 h-8 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-xs font-bold text-gray-600 flex-shrink-0">
                      {msg.profiles?.display_name?.charAt(0) || "?"}
                    </div>
                  )}
                  <div className="flex flex-col gap-1">
                    {!isMe && (
                      <p className="text-xs text-gray-400 ml-1">{msg.profiles?.display_name}</p>
                    )}
                    <div
                      className={`max-w-[240px] px-4 py-2.5 rounded-2xl ${
                        isMe ? "bg-black text-white" : "bg-gray-100 text-black"
                      }`}
                    >
                      <p className="text-sm leading-relaxed">{msg.content}</p>
                    </div>
                    <p className={`text-[10px] text-gray-300 ${isMe ? "text-right" : "text-left"} mx-1`}>
                      {formatTime(msg.created_at)}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-gray-100 pb-[max(12px,env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="flex-1 h-11 bg-gray-100 border-none rounded-full px-4 text-sm text-black outline-none placeholder-gray-400"
          />
          <button
            onClick={handleSend}
            disabled={!inputText.trim() || sending}
            className={`w-11 h-11 rounded-full flex items-center justify-center border-none cursor-pointer transition-colors flex-shrink-0 ${
              inputText.trim() ? "bg-black hover:bg-gray-800" : "bg-gray-200 cursor-not-allowed"
            }`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
              <path d="M22 2L11 13" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
