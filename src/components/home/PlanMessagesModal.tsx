import { useState, useEffect, useRef, useMemo } from "react";
import {
  supabase,
  getPlanMessages,
  sendPlanMessage,
  getOrCreateDmConversation,
  markPlanRead,
} from "../../lib/supabase";
import UserAvatar from "../UserAvatar";
import { MessageCircle, Send, MessageSquare } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { Plan, PlanMessage } from "../../pages/home/types";
import { RosterStrip, type RosterMember } from "../chat/RosterStrip";

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

  // Roster reflects two phases:
  //  - pre lock-in: RSVP roster from plan_members.
  //  - post lock-in (yuto_group_id set): paid/unpaid roster from group_members,
  //    so the chat itself names and shames whoever's holding up the split.
  const [splitRoster, setSplitRoster] = useState<RosterMember[] | null>(null);
  const [splitPerPerson, setSplitPerPerson] = useState<number | null>(null);

  const planMembers = plan.plan_members ?? [];
  const rsvpRoster: RosterMember[] = useMemo(
    () =>
      planMembers.map((pm: any) => ({
        user_id: pm.user_id,
        name: pm.profiles?.display_name || pm.profiles?.username || "Member",
        avatar_url: pm.profiles?.avatar_url ?? null,
        paid: false,
      })),
    [planMembers],
  );

  const isLockedIn = !!plan.yuto_group_id;

  const loadMessages = async () => {
    setLoadingMessages(true);
    try {
      const data = await getPlanMessages(plan.id);
      const arr = (data as PlanMessage[]) || [];
      setMessages(arr);
      // Server-side read receipt — every device clears the unread dot.
      void markPlanRead(plan.id, currentUserId).catch(() => { });
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

  // Once the plan is locked in, hydrate the post-split roster from the linked
  // wallet group and keep it live so the chat header reflects the latest pays.
  useEffect(() => {
    if (!isLockedIn || !plan.yuto_group_id) {
      setSplitRoster(null);
      setSplitPerPerson(null);
      return;
    }
    const groupId = plan.yuto_group_id;
    let cancelled = false;

    const hydrate = async () => {
      const { data, error } = await supabase
        .from("groups")
        .select("per_person, group_members(user_id, has_paid, profiles(id, username, display_name, avatar_url))")
        .eq("id", groupId)
        .maybeSingle();
      if (error || !data || cancelled) return;
      setSplitPerPerson(Number((data as any).per_person) || null);
      setSplitRoster(
        ((data as any).group_members ?? []).map((gm: any) => ({
          user_id: gm.user_id,
          name: gm.profiles?.display_name || gm.profiles?.username || "Member",
          avatar_url: gm.profiles?.avatar_url ?? null,
          paid: !!gm.has_paid,
        })),
      );
    };
    void hydrate();

    const ch = supabase
      .channel(`plan-roster-${groupId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "group_members", filter: `group_id=eq.${groupId}` },
        () => void hydrate(),
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [isLockedIn, plan.yuto_group_id]);

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
  const navigate = useNavigate();
  const isHost = plan.creator_id === currentUserId;
  const hostProfile = (plan as any).creator || null;
  const hostName: string | null =
    hostProfile?.display_name || hostProfile?.username || null;

  // Cross-context jumper: take the side conversation off the public plan chat
  // and into a DM with the host. Single tap, no extra screens.
  const openHostDm = async () => {
    if (isHost) return;
    try {
      const c = await getOrCreateDmConversation(currentUserId, plan.creator_id);
      onClose();
      navigate(`/messages/${c.id}`, { state: { otherUserId: plan.creator_id } });
    } catch (err) {
      console.error("open host dm error:", err);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end justify-center z-50">
      <div className="bg-white dark:bg-zinc-900 rounded-t-3xl w-full max-w-md flex flex-col transition-colors" style={{ height: "75vh" }}>
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100 dark:border-zinc-800 gap-3">
          <div className="min-w-0">
            <h2 className="font-bold text-lg text-black dark:text-white truncate">{plan.title}</h2>
            <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{memberCount} people in this plan</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!isHost && (
              <button
                type="button"
                onClick={() => void openHostDm()}
                className="flex items-center gap-1 h-8 px-3 rounded-full bg-gray-100 dark:bg-zinc-800 text-black dark:text-white text-xs font-bold hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors"
                title={hostName ? `DM ${hostName}` : "DM host"}
              >
                <MessageSquare size={13} />
                DM {hostName ? hostName.split(" ")[0] : "host"}
              </button>
            )}
            <button type="button" onClick={onClose} className="text-gray-400 hover:text-black dark:hover:text-white text-2xl bg-transparent border-none cursor-pointer">
              ✕
            </button>
          </div>
        </div>

        <RosterStrip
          mode={isLockedIn && splitRoster ? "split" : "rsvp"}
          members={isLockedIn && splitRoster ? splitRoster : rsvpRoster}
          perPersonKes={isLockedIn ? splitPerPerson : null}
          slots={plan.slots ?? null}
          currentUserId={currentUserId}
          hostUserId={plan.creator_id}
        />

        <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
          {loadingMessages ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-gray-200 dark:border-zinc-700 border-t-black dark:border-t-white rounded-full animate-spin" />
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
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          navigate(`/user/${message.user_id}`);
                        }}
                        className="text-[11px] text-gray-400 ml-1 bg-transparent border-none p-0 cursor-pointer hover:text-black dark:hover:text-white"
                      >
                        {message.profiles.display_name}
                        {isCreator && " · Creator"}
                      </button>
                    )}
                    <div
                      className={`px-3 py-2 rounded-2xl text-sm ${isMe ? "bg-black text-white rounded-br-sm" : "bg-gray-100 dark:bg-zinc-800 text-black dark:text-white rounded-bl-sm"}`}
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
        <div className="px-4 pb-6 pt-2 border-t border-gray-100 dark:border-zinc-800 flex gap-2 items-center">
          <input
            type="text"
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !sendingMessage && handleSend()}
            placeholder="Say something..."
            className="flex-1 bg-gray-100 dark:bg-zinc-800 text-black dark:text-white placeholder-gray-500 dark:placeholder-gray-400 rounded-full px-4 py-2.5 text-sm outline-none focus:bg-gray-200 dark:focus:bg-zinc-700 transition-colors"
            maxLength={500}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!messageInput.trim() || sendingMessage}
            className="w-10 h-10 bg-black dark:bg-white text-white dark:text-black rounded-full flex items-center justify-center disabled:opacity-30 shrink-0"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
