import { useState, useEffect, useRef } from "react";
import { supabase, getPlanMessages, sendPlanMessage } from "../../lib/supabase";
import UserAvatar from "../UserAvatar";
import { MessageCircle, Send } from "lucide-react";
import type { Plan, PlanMessage } from "../../pages/home/types";

export function PlanMessagesModal({
  plan,
  currentUserId,
  onClose,
}: {
  plan: Plan;
  currentUserId: string;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<PlanMessage[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadMessages = async () => {
    setLoadingMessages(true);
    try {
      const data = await getPlanMessages(plan.id);
      setMessages((data as PlanMessage[]) || []);
    } catch (err) {
      console.error("load plan messages error:", err);
    }
    setLoadingMessages(false);
  };

  useEffect(() => {
    loadMessages();
    const channel = supabase
      .channel(`plan-messages-${plan.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "plan_messages", filter: `plan_id=eq.${plan.id}` },
        () => loadMessages(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [plan.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const content = messageInput.trim();
    if (!content) return;
    setSendingMessage(true);
    setError("");
    try {
      await sendPlanMessage(plan.id, currentUserId, content);
      setMessageInput("");
      await loadMessages();
    } catch (err) {
      console.error("send plan message error:", err);
      setError(err instanceof Error ? err.message : "Couldn't send message. Try again.");
    }
    setSendingMessage(false);
  };

  const memberCount = (plan.plan_members ?? []).length;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end justify-center z-50">
      <div className="bg-white rounded-t-3xl w-full max-w-md flex flex-col" style={{ height: "75vh" }}>
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
          <div>
            <h2 className="font-bold text-lg text-black">{plan.title}</h2>
            <p className="text-xs text-gray-400">{memberCount} people in this plan</p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-black text-2xl bg-transparent border-none cursor-pointer">
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
          {loadingMessages ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-gray-200 border-t-black rounded-full animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 text-center py-10">
              <MessageCircle size={32} className="text-gray-200 mb-2" />
              <p className="text-sm text-gray-400">No messages yet. Start the chat!</p>
            </div>
          ) : (
            messages.map((message) => {
              const isMe = message.user_id === currentUserId;
              const isCreator = message.user_id === plan.creator_id;
              return (
                <div key={message.id} className={`flex items-end gap-2 ${isMe ? "flex-row-reverse" : "flex-row"}`}>
                  {!isMe && (
                    <UserAvatar name={message.profiles.display_name} avatarUrl={message.profiles.avatar_url} size="sm" className="shrink-0 mb-1" />
                  )}
                  <div className={`max-w-[75%] ${isMe ? "items-end" : "items-start"} flex flex-col gap-0.5`}>
                    {!isMe && (
                      <span className="text-[11px] text-gray-400 ml-1">
                        {message.profiles.display_name}
                        {isCreator && " · Creator"}
                      </span>
                    )}
                    <div
                      className={`px-3 py-2 rounded-2xl text-sm ${isMe ? "bg-black text-white rounded-br-sm" : "bg-gray-100 text-black rounded-bl-sm"}`}
                    >
                      {message.content}
                    </div>
                    <span className="text-[10px] text-gray-400 mx-1">
                      {new Date(message.created_at).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  {isMe && (
                    <UserAvatar name={message.profiles.display_name} avatarUrl={message.profiles.avatar_url} size="sm" className="shrink-0 mb-1" />
                  )}
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>
        {error && <p className="text-xs text-red-500 text-center px-4 pb-1">{error}</p>}
        <div className="px-4 pb-6 pt-2 border-t border-gray-100 flex gap-2 items-center">
          <input
            type="text"
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !sendingMessage && handleSend()}
            placeholder="Say something..."
            className="flex-1 bg-gray-100 rounded-full px-4 py-2.5 text-sm outline-none focus:bg-gray-200 transition-colors"
            maxLength={500}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!messageInput.trim() || sendingMessage}
            className="w-10 h-10 bg-black text-white rounded-full flex items-center justify-center disabled:opacity-30 shrink-0"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
