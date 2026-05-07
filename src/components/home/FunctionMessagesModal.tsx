import { useState, useEffect } from "react";
import {
  supabase,
  ensureFunctionAttendeeChat,
  getFunctionMessages,
  sendFunctionMessage,
  sendGroupChatMessage,
} from "../../lib/supabase";
import UserAvatar from "../UserAvatar";
import type { FunctionListing, FunctionMessage } from "../../pages/home/types";
import { setFunctionThreadSeenAt } from "../../pages/home/threadStorage";

export function FunctionMessagesModal({
  functionItem,
  currentUserId,
  onMessagesRead,
  onClose,
}: {
  functionItem: FunctionListing;
  currentUserId: string;
  onMessagesRead?: (functionId: string) => void;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<FunctionMessage[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [error, setError] = useState("");

  const loadMessages = async () => {
    setLoadingMessages(true);
    try {
      const data = await getFunctionMessages(functionItem.id);
      setMessages((data as FunctionMessage[]) || []);
      const latest = (data as FunctionMessage[]).reduce((max, message) => {
        const current = new Date(message.created_at).getTime();
        return current > max ? current : max;
      }, 0);
      if (latest > 0) {
        setFunctionThreadSeenAt(currentUserId, functionItem.id, new Date(latest).toISOString());
      }
      onMessagesRead?.(functionItem.id);
    } catch (err) {
      console.error("load function messages error:", err);
    } finally {
      setLoadingMessages(false);
    }
  };

  useEffect(() => {
    loadMessages();

    const channel = supabase
      .channel(`function-messages-${functionItem.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "function_messages", filter: `function_id=eq.${functionItem.id}` },
        () => loadMessages(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [functionItem.id]);

  const handleSend = async () => {
    const content = messageInput.trim();
    if (!content) return;
    setSendingMessage(true);
    setError("");
    try {
      await sendFunctionMessage(functionItem.id, currentUserId, content);

      // Keep paid attendees in the loop: broadcast host answers into the attendee chat.
      if (currentUserId === functionItem.host_id) {
        try {
          const gid = await ensureFunctionAttendeeChat(functionItem.id);
          await sendGroupChatMessage(gid, currentUserId, `Host Q&A: ${content}`);
        } catch (e) {
          console.error("broadcast host Q&A to attendee chat failed:", e);
        }
      }

      setMessageInput("");
      await loadMessages();
    } catch (err) {
      console.error("send function message error:", err);
      setError(err instanceof Error ? err.message : "Couldn't send message. Try again.");
    }
    setSendingMessage(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end md:items-center justify-center z-50 fade-in">
      <div className="bg-white rounded-t-3xl md:rounded-3xl w-full max-w-md p-6 modal-slide-up max-h-[92vh] flex flex-col">
        <div className="flex justify-between items-start gap-3 mb-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold">Questions</p>
            <h2 className="font-bold text-xl text-black">Ask about {functionItem.title}</h2>
            <p className="text-sm text-gray-500 mt-1">The host can reply here.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-2xl text-gray-400 hover:text-black bg-transparent border-none cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-3 mb-4">
          {loadingMessages ? (
            <div className="py-10 text-center text-gray-400 text-sm">Loading questions...</div>
          ) : messages.length === 0 ? (
            <div className="py-10 text-center text-gray-400 text-sm">
              No questions yet. Be the first to ask something.
            </div>
          ) : (
            messages.map((message) => {
              const isMe = message.user_id === currentUserId;
              const isHost = message.user_id === functionItem.host_id;
              return (
                <div key={message.id} className={`flex items-start gap-2 ${isMe ? "justify-end" : "justify-start"}`}>
                  {!isMe && (
                    <UserAvatar
                      name={message.profiles.display_name}
                      avatarUrl={message.profiles.avatar_url}
                      size="sm"
                      className="w-7 h-7 shrink-0"
                    />
                  )}
                  <div
                    className={`max-w-[82%] rounded-2xl px-3 py-2 ${isMe ? "bg-black text-white rounded-tr-sm" : "bg-gray-50 text-black rounded-tl-sm"}`}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <p className={`text-xs font-semibold ${isMe ? "text-white/75" : "text-gray-500"}`}>
                        {isMe ? "You" : message.profiles.display_name}
                      </p>
                      {isHost && !isMe && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-black text-white">Host</span>
                      )}
                    </div>
                    <p className="text-sm leading-5">{message.content}</p>
                    <p className={`text-[10px] mt-1 ${isMe ? "text-white/60" : "text-gray-400"}`}>
                      {new Date(message.created_at).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  {isMe && (
                    <UserAvatar
                      name={message.profiles.display_name}
                      avatarUrl={message.profiles.avatar_url}
                      size="sm"
                      className="w-7 h-7 shrink-0"
                    />
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="border-t border-gray-100 pt-4">
          <div className="flex gap-2 items-end">
            <textarea
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              placeholder="Ask a question about the function..."
              className="flex-1 h-20 resize-none rounded-2xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:border-black transition-colors"
              maxLength={320}
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={sendingMessage || !messageInput.trim()}
              className="h-12 px-4 rounded-2xl bg-black text-white font-bold text-sm disabled:opacity-40 transition-opacity"
            >
              {sendingMessage ? "Sending" : "Send"}
            </button>
          </div>
          {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
        </div>
      </div>
    </div>
  );
}
