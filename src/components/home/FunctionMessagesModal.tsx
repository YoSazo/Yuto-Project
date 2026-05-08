import { useState, useEffect, useMemo } from "react";
import {
  supabase,
  ensureFunctionAttendeeChat,
  getFunctionMessages,
  getOrCreateDmConversation,
  markFunctionRead,
  sendFunctionMessage,
  sendGroupChatMessage,
} from "../../lib/supabase";
import UserAvatar from "../UserAvatar";
import { MessageSquare } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { FunctionListing, FunctionMessage } from "../../pages/home/types";
import { RosterStrip, type RosterMember } from "../chat/RosterStrip";

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
  // Live mirror of function_members so the roster strip reflects payments
  // in real time, not just on next reload.
  const [liveMembers, setLiveMembers] = useState<FunctionListing["function_members"]>(
    functionItem.function_members ?? [],
  );

  useEffect(() => {
    setLiveMembers(functionItem.function_members ?? []);
  }, [functionItem.id, functionItem.function_members]);

  const rosterMembers: RosterMember[] = useMemo(() => {
    return (liveMembers ?? []).map((m: any) => ({
      user_id: m.user_id,
      name: m.profiles?.display_name || m.profiles?.username || "Member",
      avatar_url: m.profiles?.avatar_url ?? null,
      paid: !!m.has_paid,
    }));
  }, [liveMembers]);

  const loadMessages = async () => {
    setLoadingMessages(true);
    try {
      const data = await getFunctionMessages(functionItem.id);
      setMessages((data as FunctionMessage[]) || []);
      // Server-side read receipt — clears the unread dot on every device.
      void markFunctionRead(functionItem.id, currentUserId).catch(() => {});
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
      // Roster strip lives at the top of this chat — mirror payment state live.
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "function_members", filter: `function_id=eq.${functionItem.id}` },
        async () => {
          const { data } = await supabase
            .from("function_members")
            .select("id, user_id, has_paid, joined_at, paid_at, buyer_confirmed_at, profiles(id, username, display_name, avatar_url)")
            .eq("function_id", functionItem.id);
          setLiveMembers((data as any) ?? []);
        },
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

  const navigate = useNavigate();
  const iAmHost = functionItem.host_id === currentUserId;
  const hostProfile = (functionItem as any).host || null;
  const hostName: string | null = hostProfile?.display_name || hostProfile?.username || null;

  // Cross-context jumper: lift the conversation off the public Q&A and into a
  // 1:1 DM with the host. Keeps the public thread tidy while still funneling
  // the question into a chat surface (vs WhatsApp or DMs off-platform).
  const openHostDm = async () => {
    if (iAmHost) return;
    try {
      const c = await getOrCreateDmConversation(currentUserId, functionItem.host_id);
      onClose();
      navigate(`/messages/${c.id}`, { state: { otherUserId: functionItem.host_id } });
    } catch (err) {
      console.error("open host dm error:", err);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end md:items-center justify-center z-50 fade-in">
      <div className="bg-white rounded-t-3xl md:rounded-3xl w-full max-w-md p-6 modal-slide-up max-h-[92vh] flex flex-col">
        <div className="flex justify-between items-start gap-3 mb-4">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold">Questions</p>
            <h2 className="font-bold text-xl text-black truncate">Ask about {functionItem.title}</h2>
            <p className="text-sm text-gray-500 mt-1">The host can reply here.</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!iAmHost && (
              <button
                type="button"
                onClick={() => void openHostDm()}
                className="flex items-center gap-1 h-8 px-3 rounded-full bg-gray-100 text-black text-xs font-bold hover:bg-gray-200 transition-colors"
                title={hostName ? `DM ${hostName}` : "DM host"}
              >
                <MessageSquare size={13} />
                DM {hostName ? hostName.split(" ")[0] : "host"}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="text-2xl text-gray-400 hover:text-black bg-transparent border-none cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>

        <RosterStrip
          mode="split"
          members={rosterMembers}
          perPersonKes={functionItem.amount_per_person ?? null}
          currentUserId={currentUserId}
          hostUserId={functionItem.host_id}
        />

        <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-3 mb-4 mt-3">
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
