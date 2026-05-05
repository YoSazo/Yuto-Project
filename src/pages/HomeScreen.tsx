import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import imgYutoMascot from "figma:asset/28c11cb437762e8469db46974f467144b8299a8c.png";
import { useAuth } from "../contexts/AuthContext";
import { supabase, getPlansPublic, getPlansFriends, createPlan, joinPlan, leavePlan, yutoItPlan, deletePlan, addPlanUpdate, getPlanUpdates, uploadPlanImage, getFunctionsPublic, createFunction, joinFunction, leaveFunction, getFunctionMessages, sendFunctionMessage, getSavedPhoneNumber, saveProfilePhoneNumber, getPlanMessages, sendPlanMessage } from "../lib/supabase";
import UserAvatar from "../components/UserAvatar";
import { Trash2, ClipboardList, Rocket, UserCheck, Send, Users, Globe, ImagePlus, X, CalendarDays, MapPin, BadgeDollarSign, Sparkles, PartyPopper, MessageCircle } from "lucide-react";

interface PlanMember {
  id: string;
  user_id: string;
  profiles: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
  };
}

interface PlanMessage {
  id: string;
  plan_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
  };
}

interface PlanUpdate {
  id: string;
  content: string;
  created_at: string;
  creator_id: string;
  profiles: {
    display_name: string;
    avatar_url: string | null;
  };
}

interface Plan {
  id: string;
  creator_id: string;
  title: string;
  amount: number | null;
  slots: number | null;
  image_url: string | null;
  yuto_group_id: string | null;
  created_at: string;
  status: string;
  creator: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
  };
  plan_members: PlanMember[];
}

interface FunctionMember {
  id: string;
  user_id: string;
  has_paid: boolean;
  joined_at: string;
  profiles: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
  };
}

interface FunctionMessage {
  id: string;
  function_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
  };
}

interface FunctionListing {
  id: string;
  host_id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  date: string | null;
  location: string | null;
  amount_per_person: number;
  max_capacity: number | null;
  mode: "pay" | "pledge";
  goal_count: number | null;
  deadline: string | null;
  status: "open" | "funded" | "cancelled";
  is_public: boolean;
  created_at: string;
  host: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
  };
  function_members: FunctionMember[];
}

function formatEventDate(dateValue: string | null) {
  if (!dateValue) return "Anytime";
  return new Date(dateValue).toLocaleDateString("en-KE", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

const FUNCTION_THREAD_SEEN_PREFIX = "yuto_function_thread_seen:";

function getFunctionThreadSeenAt(userId: string, functionId: string) {
  if (typeof window === "undefined") return 0;
  const value = window.localStorage.getItem(`${FUNCTION_THREAD_SEEN_PREFIX}${userId}:${functionId}`);
  return value ? Number(value) || 0 : 0;
}

function setFunctionThreadSeenAt(userId: string, functionId: string, timestamp: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(`${FUNCTION_THREAD_SEEN_PREFIX}${userId}:${functionId}`, String(new Date(timestamp).getTime()));
}

function getUnreadFunctionMessageCount(
  userId: string,
  functionId: string,
  messages: Array<{ user_id: string; created_at: string }>,
) {
  const seenAt = getFunctionThreadSeenAt(userId, functionId);
  return messages.reduce((count, message) => {
    if (message.user_id === userId) return count;
    const messageAt = new Date(message.created_at).getTime();
    return messageAt > seenAt ? count + 1 : count;
  }, 0);
}

function FunctionPayModal({
  amount,
  functionId,
  userId,
  defaultPhoneNumber,
  onClose,
  onRefreshStatus,
}: {
  amount: number;
  functionId: string;
  userId: string;
  defaultPhoneNumber?: string | null;
  onClose: () => void;
  onRefreshStatus?: () => void;
}) {
  const [phone, setPhone] = useState(defaultPhoneNumber || "254");
  const [step, setStep] = useState<"input" | "sending" | "waiting" | "error">("input");
  const [error, setError] = useState("");

  useEffect(() => {
    if (defaultPhoneNumber) {
      setPhone(defaultPhoneNumber);
    }
  }, [defaultPhoneNumber]);

  const handlePay = async () => {
    if (phone.length < 12) {
      setError("Enter a valid phone number (e.g. 254712345678)");
      return;
    }
    setStep("sending");
    setError("");
    try {
      const res = await fetch("/api/charge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone_number: phone,
          amount,
          function_id: functionId,
          user_id: userId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        void saveProfilePhoneNumber(userId, phone).catch(() => {});
        setStep("waiting");
      } else {
        setError(data.message || "Failed to initiate payment");
        setStep("error");
      }
    } catch {
      setError("Network error. Please try again.");
      setStep("error");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end md:items-center justify-center z-50 fade-in">
      <div className="bg-white rounded-t-3xl md:rounded-3xl w-full max-w-md p-6 modal-slide-up">
        {step === "input" || step === "error" ? (
          <>
            <div className="flex justify-between items-center mb-5">
              <h2 className="font-bold text-xl text-black">Pay to join</h2>
              <button
                onClick={onClose}
                className="text-2xl text-gray-400 hover:text-black bg-transparent border-none cursor-pointer"
              >
                ✕
              </button>
            </div>
            <p className="text-center text-sm text-gray-500 mb-5">
              Amount: <span className="font-bold text-black">KSH {amount.toLocaleString()}</span>
            </p>
            <div className="mb-5">
              <label className="text-xs text-gray-500 mb-1.5 block">M-PESA Phone Number</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                placeholder="254712345678"
                maxLength={12}
                className="w-full h-12 border border-gray-300 rounded-full px-5 text-base outline-none focus:border-black transition-colors"
              />
              <p className="text-xs text-gray-400 mt-1.5 ml-2">Format: 254 followed by your number</p>
            </div>
            {error && <p className="text-red-500 text-sm text-center mb-4">{error}</p>}
            <button
              onClick={handlePay}
              disabled={phone.length < 12}
              className={`w-full h-12 rounded-full font-bold text-base transition-colors ${
                phone.length >= 12
                  ? "bg-black text-white hover:bg-gray-800"
                  : "bg-gray-200 text-gray-400 cursor-not-allowed"
              }`}
            >
              Pay KSH {amount.toLocaleString()}
            </button>
            {step === "error" && onRefreshStatus && (
              <button
                type="button"
                onClick={onRefreshStatus}
                className="mt-3 w-full text-sm text-gray-500 underline hover:text-black text-center"
              >
                Already paid? Check status
              </button>
            )}
          </>
        ) : step === "sending" ? (
          <div className="py-12 text-center">
            <div className="w-12 h-12 border-4 border-gray-200 border-t-black rounded-full mx-auto mb-4 animate-spin" />
            <p className="font-bold text-lg text-black">Sending to your phone...</p>
          </div>
        ) : (
          <div className="py-12 text-center">
            <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                <line x1="12" y1="18" x2="12.01" y2="18" />
              </svg>
            </div>
            <p className="font-bold text-lg text-black mb-2">Check your phone</p>
            <p className="text-sm text-gray-500">Enter your M-PESA PIN to complete payment</p>
            <p className="text-xs text-gray-400 mt-6">This will close automatically once confirmed</p>
            {onRefreshStatus && (
              <button
                type="button"
                onClick={onRefreshStatus}
                className="mt-4 text-sm text-gray-500 underline hover:text-black"
              >
                I already paid — refresh
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function FunctionMessagesModal({
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
                <div
                  key={message.id}
                  className={`flex items-start gap-2 ${isMe ? "justify-end" : "justify-start"}`}
                >
                  {!isMe && (
                    <UserAvatar
                      name={message.profiles.display_name}
                      avatarUrl={message.profiles.avatar_url}
                      size="sm"
                      className="w-7 h-7 shrink-0"
                    />
                  )}
                  <div className={`max-w-[82%] rounded-2xl px-3 py-2 ${isMe ? "bg-black text-white rounded-tr-sm" : "bg-gray-50 text-black rounded-tl-sm"}`}>
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


function PlanMessagesModal({
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
      .on("postgres_changes",
        { event: "*", schema: "public", table: "plan_messages", filter: `plan_id=eq.${plan.id}` },
        () => loadMessages()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
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

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end justify-center z-50">
      <div className="bg-white rounded-t-3xl w-full max-w-md flex flex-col" style={{ height: "75vh" }}>
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
          <div>
            <h2 className="font-bold text-lg text-black">{plan.title}</h2>
            <p className="text-xs text-gray-400">{plan.plan_members.length} people in this plan</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-black text-2xl bg-transparent border-none cursor-pointer">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
          {loadingMessages ? (
            <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-gray-200 border-t-black rounded-full animate-spin" /></div>
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
                  {!isMe && <UserAvatar name={message.profiles.display_name} avatarUrl={message.profiles.avatar_url} size="sm" className="shrink-0 mb-1" />}
                  <div className={`max-w-[75%] ${isMe ? "items-end" : "items-start"} flex flex-col gap-0.5`}>
                    {!isMe && (
                      <span className="text-[11px] text-gray-400 ml-1">
                        {message.profiles.display_name}{isCreator && " · Creator"}
                      </span>
                    )}
                    <div className={`px-3 py-2 rounded-2xl text-sm ${isMe ? "bg-black text-white rounded-br-sm" : "bg-gray-100 text-black rounded-bl-sm"}`}>
                      {message.content}
                    </div>
                    <span className="text-[10px] text-gray-400 mx-1">
                      {new Date(message.created_at).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  {isMe && <UserAvatar name={message.profiles.display_name} avatarUrl={message.profiles.avatar_url} size="sm" className="shrink-0 mb-1" />}
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

export default function HomeScreen() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"public" | "friends">("public");
  const [plans, setPlans] = useState<Plan[]>([]);
  const [functionsFeed, setFunctionsFeed] = useState<FunctionListing[]>([]);
  const [functionUnreadCounts, setFunctionUnreadCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [activePlanChat, setActivePlanChat] = useState<Plan | null>(null);
  // Compose state
  const [showCompose, setShowCompose] = useState(false);
  const [composeMode, setComposeMode] = useState<"plan" | "function">("plan");
  const [planTitle, setPlanTitle] = useState("");
  const [planAmount, setPlanAmount] = useState("");
  const [planSlots, setPlanSlots] = useState("");
  const [planImageFile, setPlanImageFile] = useState<File | null>(null);
  const [planImagePreview, setPlanImagePreview] = useState<string | null>(null);
  const [functionImageFile, setFunctionImageFile] = useState<File | null>(null);
  const [functionImagePreview, setFunctionImagePreview] = useState<string | null>(null);
  const [functionTitle, setFunctionTitle] = useState("");
  const [functionDescription, setFunctionDescription] = useState("");
  const [functionDate, setFunctionDate] = useState("");
  const [functionLocation, setFunctionLocation] = useState("");
  const [functionAmount, setFunctionAmount] = useState("");
  const [functionCapacity, setFunctionCapacity] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const planImageInputRef = useRef<HTMLInputElement>(null);
  const functionImageInputRef = useRef<HTMLInputElement>(null);
  const activeTabRef = useRef(activeTab);

  // Function payment state
  const [functionPayTarget, setFunctionPayTarget] = useState<FunctionListing | null>(null);
  const [activeFunctionThread, setActiveFunctionThread] = useState<FunctionListing | null>(null);

  // Plan updates state
  const [planUpdates, setPlanUpdates] = useState<Record<string, PlanUpdate[]>>({});
  const [updateInputs, setUpdateInputs] = useState<Record<string, string>>({});
  const [postingUpdate, setPostingUpdate] = useState<Record<string, boolean>>({});

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    if (!user) return;
    loadFeed();

    const channel = supabase
      .channel("feed-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "plans" }, () => loadFeed())
      .on("postgres_changes", { event: "*", schema: "public", table: "plan_members" }, () => loadFeed())
      .on("postgres_changes", { event: "*", schema: "public", table: "functions" }, () => loadFeed())
      .on("postgres_changes", { event: "*", schema: "public", table: "function_members" }, () => loadFeed())
      .on("postgres_changes", { event: "*", schema: "public", table: "function_messages" }, () => loadFeed())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, activeTab]);

  useEffect(() => {
    if (!user || !functionPayTarget) return;
    const refreshed = functionsFeed.find((f) => f.id === functionPayTarget.id);
    const hasPaid = refreshed?.function_members.some((m) => m.user_id === user.id && m.has_paid);
    if (hasPaid) {
      setFunctionPayTarget(null);
    }
  }, [functionsFeed, functionPayTarget, user]);

  const loadFeed = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const tab = activeTabRef.current;
      const [planData, functionData] = await Promise.all([
        tab === "public" ? getPlansPublic() : getPlansFriends(user.id),
        tab === "public" ? getFunctionsPublic() : Promise.resolve([]),
      ]);
      const planList = (planData as Plan[]) || [];
      const functionList = (functionData as FunctionListing[]) || [];
      setPlans(planList);
      setFunctionsFeed(functionList);
      const updatesMap: Record<string, PlanUpdate[]> = {};
      if (tab === "public" && functionList.length > 0) {
        const { data: messageRows, error: messageError } = await supabase
          .from("function_messages")
          .select("function_id, user_id, created_at")
          .in("function_id", functionList.map((item) => item.id));
        if (messageError) {
          console.error("loadFeed function unread error:", messageError);
          setFunctionUnreadCounts({});
        } else {
          const counts: Record<string, number> = {};
          const groupedMessages = (messageRows || []) as Array<{ function_id: string; user_id: string; created_at: string }>;
          for (const functionItem of functionList) {
            counts[functionItem.id] = getUnreadFunctionMessageCount(user.id, functionItem.id, groupedMessages.filter((message) => message.function_id === functionItem.id));
          }
          setFunctionUnreadCounts(counts);
        }
      } else {
        setFunctionUnreadCounts({});
      }
      await Promise.all(planList.map(async (plan) => {
        try {
          const updates = await getPlanUpdates(plan.id);
          updatesMap[plan.id] = (updates as PlanUpdate[]) || [];
        } catch (err) {
          console.error("loadFeed plan updates error:", err);
        }
      }));
      setPlanUpdates(updatesMap);
    } catch (err) {
      console.error("loadFeed error:", err);
    }
    setLoading(false);
  };

  const loadPlans = loadFeed;

  const handlePostUpdate = async (planId: string) => {
    const content = updateInputs[planId]?.trim();
    if (!content || !user) return;
    setPostingUpdate((prev) => ({ ...prev, [planId]: true }));
    try {
      await addPlanUpdate(planId, user.id, content);
      setUpdateInputs((prev) => ({ ...prev, [planId]: "" }));
      // Notify plan members
      const plan = plans.find((p) => p.id === planId);
      if (plan) {
        const memberIds = plan.plan_members.map((m) => m.user_id);
        await Promise.all(memberIds.map((memberId) =>
          fetch("/api/notify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: memberId,
              title: "Yuto 📋",
              body: `${profile?.display_name} posted an update: ${content.slice(0, 60)}`,
            }),
          }).catch(() => {})
        ));
      }
      await loadPlans();
    } catch (err) { console.error(err); }
    setPostingUpdate((prev) => ({ ...prev, [planId]: false }));
  };

  const handlePlanImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    setPlanImageFile(file);
    const url = URL.createObjectURL(file);
    setPlanImagePreview(url);
  };

  const handleFunctionImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    setFunctionImageFile(file);
    const url = URL.createObjectURL(file);
    setFunctionImagePreview(url);
  };

  const clearPlanImage = () => {
    setPlanImageFile(null);
    if (planImagePreview) URL.revokeObjectURL(planImagePreview);
    setPlanImagePreview(null);
    planImageInputRef.current?.focus();
  };

  const clearFunctionImage = () => {
    setFunctionImageFile(null);
    if (functionImagePreview) URL.revokeObjectURL(functionImagePreview);
    setFunctionImagePreview(null);
  };

  const resetCompose = () => {
    setShowCompose(false);
    setPostError(null);
    setComposeMode("plan");
    setPlanTitle("");
    setPlanAmount("");
    setPlanSlots("");
    clearPlanImage();
    clearFunctionImage();
    setFunctionTitle("");
    setFunctionDescription("");
    setFunctionDate("");
    setFunctionLocation("");
    setFunctionAmount("");
    setFunctionCapacity("");
  };

  const handlePost = async () => {
    if (!user) return;
    if (composeMode === "plan" && !planTitle.trim()) return;
    if (composeMode === "function" && (!functionTitle.trim() || !functionAmount.trim())) return;
    setIsPosting(true);
    setPostError(null);
    try {
      if (composeMode === "plan") {
        let imageUrl: string | null = null;
        if (planImageFile) {
          try {
            imageUrl = await uploadPlanImage(user.id, planImageFile);
          } catch (uploadErr) {
            console.error("Image upload failed:", uploadErr);
            setPostError("Couldn't upload image — posting without it.");
            imageUrl = null;
          }
        }
        await createPlan(
          user.id,
          planTitle.trim(),
          planAmount ? parseInt(planAmount) : null,
          planSlots ? parseInt(planSlots) : null,
          imageUrl
        );
      } else {
        let imageUrl: string | null = null;
        if (functionImageFile) {
          try {
            imageUrl = await uploadPlanImage(user.id, functionImageFile);
          } catch (uploadErr) {
            console.error("Function image upload failed:", uploadErr);
            setPostError("Couldn't upload function photo — posting without it.");
            imageUrl = null;
          }
        }
        await createFunction(
          user.id,
          functionTitle.trim(),
          functionDescription.trim() || null,
          functionDate ? new Date(functionDate).toISOString() : null,
          functionLocation.trim() || null,
          parseInt(functionAmount),
          functionCapacity ? parseInt(functionCapacity) : null,
          imageUrl,
        );
      }
      resetCompose();
      await loadFeed();
    } catch (err) {
      console.error(err);
      let msg: string =
        (err as { message?: string })?.message ||
        (err as { error?: { message?: string } })?.error?.message ||
        (err instanceof Error ? err.message : null) ||
        (typeof err === "string" ? err : null) ||
        "";
      if (!msg || msg === "[object Object]") msg = "Failed to post plan. Try again.";
      setPostError(msg);
    }
    setIsPosting(false);
  };

  const handleJoinFunction = async (eventFunction: FunctionListing) => {
    if (!user) return;
    const isMember = eventFunction.function_members.some((m) => m.user_id === user.id);
    const isFull = eventFunction.max_capacity ? eventFunction.function_members.length >= eventFunction.max_capacity && !isMember : false;
    if (isFull) return;

    try {
      if (!isMember) {
        await joinFunction(eventFunction.id, user.id);
      }
      setFunctionPayTarget(eventFunction);
      await loadFeed();
    } catch (err) {
      console.error(err);
    }
  };

  const refreshFunctionPaymentStatus = async () => {
    await loadFeed();
  };

  const handleJoin = async (plan: Plan) => {
    if (!user) return;
    const isMember = plan.plan_members.some((m) => m.user_id === user.id);
    try {
      if (isMember) {
        await leavePlan(plan.id, user.id);
      } else {
        await joinPlan(plan.id, user.id, profile?.display_name || "Someone", plan.creator_id);
      }
      await loadPlans();
    } catch (err) { console.error(err); }
  };

  const handleYutoIt = async (plan: Plan) => {
    if (!user) return;
    if (!plan.amount) return;
    const memberIds = [plan.creator_id, ...plan.plan_members.map((m) => m.user_id).filter((id) => id !== plan.creator_id)];
    try {
      const group = await yutoItPlan(plan.id, user.id, plan.title, plan.amount, memberIds);
      navigate(`/yuto/${group.id}`);
    } catch (err) { console.error(err); }
  };

  const handleDelete = async (planId: string) => {
    try {
      await deletePlan(planId);
      await loadPlans();
    } catch (err) { console.error(err); }
  };

  return (
    <div className="flex flex-col min-h-full overflow-y-auto pb-36 px-5 pt-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <img src={imgYutoMascot} alt="Yuto" className="w-10 h-10 object-contain" />
        <span className="text-2xl font-bold text-black">Home</span>
      </div>

      {/* Tab switcher */}
      <div className="relative flex bg-gray-100 rounded-2xl p-1 mb-6">
        <div
          className="absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white rounded-xl shadow-sm transition-transform duration-300 ease-in-out"
          style={{ transform: activeTab === "public" ? "translateX(0px)" : "translateX(calc(100% + 8px))" }}
        />
        <button
          onClick={() => setActiveTab("public")}
          className={`relative flex-1 py-2 rounded-xl text-sm font-semibold transition-colors duration-200 ${activeTab === "public" ? "text-black" : "text-gray-400"}`}
        >
          <span className="flex items-center justify-center gap-1.5">
            <Globe size={14} /> Public
          </span>
        </button>
        <button
          onClick={() => setActiveTab("friends")}
          className={`relative flex-1 py-2 rounded-xl text-sm font-semibold transition-colors duration-200 ${activeTab === "friends" ? "text-black" : "text-gray-400"}`}
        >
          <span className="flex items-center justify-center gap-1.5">
            <Users size={14} /> Friends
          </span>
        </button>
      </div>

      {/* Functions board */}
      {activeTab === "public" && functionsFeed.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Functions</p>
            <span className="text-xs text-gray-400">Hosted now</span>
          </div>
          <div className="flex flex-col gap-4 mb-6">
            {functionsFeed.map((eventFunction) => {
              const isHost = eventFunction.host_id === user?.id;
              const isMember = eventFunction.function_members.some((m) => m.user_id === user?.id);
              const me = eventFunction.function_members.find((m) => m.user_id === user?.id);
              const paidCount = eventFunction.function_members.filter((m) => m.has_paid).length;
              const joinedCount = eventFunction.function_members.length;
              const isFull = eventFunction.max_capacity ? joinedCount >= eventFunction.max_capacity && !isMember : false;
              const canJoin = !isHost && !isMember && !isFull;
              const canPay = isMember && !me?.has_paid;
              const unreadCount = functionUnreadCounts[eventFunction.id] || 0;

              return (
                <div key={eventFunction.id} className={`bg-white border border-gray-100 rounded-2xl p-4 shadow-sm ${activeTab === "public" ? "function-card-highlight" : ""}`}>
                  <div className="flex items-start gap-2 mb-3">
                    <UserAvatar name={eventFunction.host.display_name} avatarUrl={eventFunction.host.avatar_url} size="sm" />
                    <div className="flex-1">
                      <p className="font-semibold text-sm text-black">{eventFunction.host.display_name} is hosting a function</p>
                      <p className="text-xs text-gray-400">{formatEventDate(eventFunction.date)}</p>
                    </div>
                    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-black text-white uppercase tracking-wide">Function</span>
                  </div>

                  <p className="font-bold text-black text-lg mb-1">{eventFunction.title}</p>
                  {eventFunction.image_url && (
                    <div className="mb-3 rounded-xl overflow-hidden bg-gray-100">
                      <img src={eventFunction.image_url} alt="Function cover" className="block w-full h-auto" />
                    </div>
                  )}
                  {eventFunction.description && (
                    <p className="text-sm text-gray-600 mb-3">{eventFunction.description}</p>
                  )}

                  <div className="flex flex-wrap gap-2 mb-3">
                    <span className="bg-orange-50 text-orange-700 font-bold text-sm px-3 py-1 rounded-full flex items-center gap-1.5">
                      <BadgeDollarSign size={14} /> KSH {eventFunction.amount_per_person.toLocaleString()}
                    </span>
                    <span className="bg-gray-100 text-gray-600 font-bold text-sm px-3 py-1 rounded-full flex items-center gap-1.5">
                      <Users size={14} /> {joinedCount} joining
                    </span>
                    {eventFunction.location && (
                      <span className="bg-gray-100 text-gray-600 font-bold text-sm px-3 py-1 rounded-full flex items-center gap-1.5">
                        <MapPin size={14} /> {eventFunction.location}
                      </span>
                    )}
                    {eventFunction.max_capacity && (
                      <span className="bg-gray-100 text-gray-600 font-bold text-sm px-3 py-1 rounded-full flex items-center gap-1.5">
                        <Sparkles size={14} /> {eventFunction.max_capacity} max
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs text-gray-400 flex items-center gap-1.5">
                      <CalendarDays size={13} /> {formatEventDate(eventFunction.date)}
                      <span>•</span>
                      <span>{paidCount} paid</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                          onClick={() => setActiveFunctionThread(eventFunction)}
                          className="relative w-11 h-11 rounded-xl border border-gray-200 bg-white text-gray-700 flex items-center justify-center hover:bg-gray-50 transition-colors"
                          aria-label={`Ask questions about ${eventFunction.title}`}
                          title="Ask questions"
                        >
                          <MessageCircle size={16} />
                          {unreadCount > 0 && (
                            <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center shadow-sm">
                              {unreadCount}
                            </span>
                          )}
                        </button>
                      {isHost ? (
                        <span className="text-sm font-semibold text-gray-500">Hosting</span>
                      ) : isMember && me?.has_paid ? (
                        <span className="text-sm font-semibold text-green-600">You&apos;re in</span>
                      ) : canPay ? (
                        <button
                          onClick={() => handleJoinFunction(eventFunction)}
                          className="px-4 py-2 bg-black text-white rounded-xl font-bold text-sm hover:bg-gray-800 transition-colors"
                        >
                          Pay &amp; join
                        </button>
                      ) : canJoin ? (
                        <button
                          onClick={() => handleJoinFunction(eventFunction)}
                          className="px-4 py-2 bg-black text-white rounded-xl font-bold text-sm hover:bg-gray-800 transition-colors"
                        >
                          Join Function
                        </button>
                      ) : (
                        <span className="text-sm font-semibold text-gray-500">{isFull ? "Full" : "Joined"}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Plans board — same for both tabs */}
        <>
          {/* Plans board */}
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin" />
            </div>
          ) : plans.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <ClipboardList size={48} className="text-gray-300 mb-3" />
              <p className="font-bold text-black text-lg">
                {activeTab === "public" ? "No plans yet" : "No plans from friends yet"}
              </p>
              <p className="text-gray-400 text-sm mt-1">
                {activeTab === "public" ? "Be the first to post one!" : "Add friends to see their plans here"}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {plans.map((plan) => {
                const isMine = plan.creator_id === user?.id;
                const isMember = plan.plan_members.some((m) => m.user_id === user?.id);
                const joinedCount = plan.plan_members.length;
                const slotsLeft = plan.slots ? plan.slots - joinedCount : null;
                const allIn = plan.slots ? joinedCount >= plan.slots : false;
                const canYutoIt = isMine && plan.amount && plan.plan_members.length > 0;

                return (
                  <div key={plan.id}>
                  <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                    {/* Creator */}
                    <div className="flex items-center gap-2 mb-3">
                      <UserAvatar name={plan.creator.display_name} avatarUrl={plan.creator.avatar_url} size="sm" />
                      <div className="flex-1">
                        <p className="font-semibold text-sm text-black">{plan.creator.display_name}</p>
                        <p className="text-xs text-gray-400">{new Date(plan.created_at).toLocaleDateString("en-KE", { weekday: "short", month: "short", day: "numeric" })}</p>
                      </div>
                      {isMine && (
                        <button onClick={() => handleDelete(plan.id)} className="text-gray-300 hover:text-red-400 transition-colors"><Trash2 size={16} /></button>
                      )}
                    </div>

                    {/* Image */}
                    {plan.image_url && (
                      <div className="mb-3 rounded-xl overflow-hidden bg-gray-100 w-full">
                        <img
                          src={plan.image_url}
                          alt=""
                          className="block w-full h-auto"
                        />
                      </div>
                    )}

                    {/* Title */}
                    <p className="font-bold text-black text-lg mb-2">{plan.title}</p>

                    {/* Amount + slots */}
                    <div className="flex items-center gap-3 mb-3 flex-wrap">
                      {plan.amount && (
                        <span className="bg-green-50 text-green-700 font-bold text-sm px-3 py-1 rounded-full">
                          KSH {plan.amount.toLocaleString()}
                        </span>
                      )}
                      {plan.slots && (
                        <span className={`font-bold text-sm px-3 py-1 rounded-full ${allIn ? "bg-red-50 text-red-500" : "bg-gray-100 text-gray-600"}`}>
                          {allIn ? "Full 🔒" : `${slotsLeft} spot${slotsLeft === 1 ? "" : "s"} left`}
                        </span>
                      )}
                    </div>

                    {/* Members */}
                    {plan.plan_members.length > 0 && (
                      <div className="flex items-center gap-1 mb-3">
                        {plan.plan_members.slice(0, 5).map((m) => (
                          <UserAvatar key={m.id} name={m.profiles.display_name} avatarUrl={m.profiles.avatar_url} size="sm" className="-ml-1 first:ml-0 border-2 border-white" />
                        ))}
                        {plan.plan_members.length > 5 && (
                          <span className="text-xs text-gray-400 ml-1">+{plan.plan_members.length - 5} more</span>
                        )}
                        <span className="text-xs text-gray-400 ml-1">{joinedCount} {joinedCount === 1 ? "person" : "people"} in</span>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2">
                      {!isMine && !allIn && (
                        <button
                          onClick={() => handleJoin(plan)}
                          className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all ${isMember ? "bg-gray-100 text-gray-600" : "bg-black text-white"}`}
                        >
                          {isMember ? "Leave" : <span className="flex items-center justify-center gap-1.5"><UserCheck size={15} /> I&apos;m in</span>}
                        </button>
                      )}
                      {allIn && plan.yuto_group_id && isMember && (
                        <button
                          onClick={() => navigate(`/yuto/${plan.yuto_group_id}`)}
                          className="flex-1 py-2.5 bg-black text-white rounded-xl font-bold text-sm hover:bg-gray-800 transition-colors"
                        >
                          <span className="flex items-center justify-center gap-1.5"><Rocket size={15} /> Join Yuto</span>
                        </button>
                      )}
                      {canYutoIt && (
                        <button
                          onClick={() => handleYutoIt(plan)}
                          className="flex-1 py-2.5 bg-green-500 text-white rounded-xl font-bold text-sm hover:bg-green-600 transition-colors"
                        >
                          <span className="flex items-center justify-center gap-1.5"><Rocket size={15} /> Yuto it!</span>
                        </button>

                        
                      )}
                    </div>
                  </div>
                  {/* Thread updates */}
                  {((planUpdates[plan.id] || []).length > 0 || isMine) && (
                    <div className="ml-4 mt-1">
                      {(planUpdates[plan.id] || []).map((update) => (
                        <div key={update.id} className="flex items-start gap-2 mt-2 pl-2">
                          <div className="flex items-start gap-2 flex-1 pb-2">
                            <UserAvatar name={update.profiles.display_name} avatarUrl={update.profiles.avatar_url} size="sm" className="w-7! h-7! shrink-0 mt-0.5" />
                            <div className="flex-1 bg-gray-50 rounded-2xl rounded-tl-sm px-3 py-2">
                              <p className="text-sm text-black">{update.content}</p>
                              <p className="text-[10px] text-gray-400 mt-0.5">{new Date(update.created_at).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" })}</p>
                            </div>
                          </div>
                        </div>
                      ))}



{/* Update input — creator only */}
{isMine && (
  <div className="flex gap-2 mt-2">
    <div className="flex flex-col items-center w-5 shrink-0">
      <div className="w-px bg-gray-200 h-3" />
    </div>
    <div className="flex-1 flex gap-2 items-center pb-2">
      <UserAvatar name={profile?.display_name || ""} avatarUrl={profile?.avatar_url} size="sm" className="w-7! h-7! shrink-0" />
      <input
        type="text"
        value={updateInputs[plan.id] || ""}
        onChange={(e) => setUpdateInputs((prev) => ({ ...prev, [plan.id]: e.target.value }))}
        onKeyDown={(e) => e.key === "Enter" && handlePostUpdate(plan.id)}
        placeholder="Add an update..."
        className="flex-1 bg-gray-50 border border-gray-200 rounded-full px-3 py-1.5 text-sm focus:outline-none focus:border-black transition-colors"
        maxLength={200}
      />
      {updateInputs[plan.id]?.trim() ? (
        <button
          onClick={() => handlePostUpdate(plan.id)}
          disabled={postingUpdate[plan.id]}
          className="w-8 h-8 bg-black text-white rounded-full flex items-center justify-center text-sm shrink-0"
        >
          ↑
        </button>
      ) : (
        <button
          onClick={() => setActivePlanChat(plan)}
          className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors shrink-0"
        >
          <MessageCircle size={18} />
        </button>
      )}
    </div>
  </div>
)}
                    </div>
                  )}
                  </div>
              );
            })}
          </div>
        )}
        </>

      {/* Compose sheet */}
      {showCompose && (
        <div className="fixed inset-0 z-50 flex items-end">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm compose-backdrop-in"
            onClick={() => {
              resetCompose();
            }}
          />
          <div className="relative w-full bg-white rounded-t-3xl px-5 pt-5 pb-10 z-10 max-h-[90vh] overflow-y-auto compose-sheet-up">
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
            <div className="flex items-center justify-between gap-3 mb-4">
              <p className="font-bold text-xl text-black">Post something</p>
              <div className="flex bg-gray-100 rounded-full p-1">
                <button
                  type="button"
                  onClick={() => setComposeMode("plan")}
                  className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-colors ${composeMode === "plan" ? "bg-white text-black shadow-sm" : "text-gray-400"}`}
                >
                  <span className="flex items-center gap-1.5"><ClipboardList size={14} /> Plan</span>
                </button>
                <button
                  type="button"
                  onClick={() => setComposeMode("function")}
                  className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-colors ${composeMode === "function" ? "bg-white text-black shadow-sm" : "text-gray-400"}`}
                >
                  <span className="flex items-center gap-1.5"><PartyPopper size={14} /> Function</span>
                </button>
              </div>
            </div>

            {composeMode === "plan" ? (
              <textarea
                value={planTitle}
                onChange={(e) => setPlanTitle(e.target.value)}
                placeholder="Bowling Saturday? Who's in 🎳"
                className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-base resize-none h-24 focus:outline-none focus:border-black transition-colors mb-3"
                maxLength={200}
              />
            ) : (
              <div className="flex flex-col gap-3 mb-3">
                <input
                  type="text"
                  value={functionTitle}
                  onChange={(e) => setFunctionTitle(e.target.value)}
                  placeholder="Friday Night Westlands"
                  className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-base focus:outline-none focus:border-black transition-colors"
                  maxLength={120}
                />
                <textarea
                  value={functionDescription}
                  onChange={(e) => setFunctionDescription(e.target.value)}
                  placeholder="Add a short description..."
                  className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-base resize-none h-24 focus:outline-none focus:border-black transition-colors"
                  maxLength={240}
                />
              </div>
            )}

            {composeMode === "plan" ? (
              <>
                <div className="mb-4">
                  {planImagePreview ? (
                    <div className="relative rounded-2xl overflow-hidden bg-gray-100 flex items-center justify-center">
                      <img src={planImagePreview} alt="Preview" className="max-w-full max-h-64 w-auto h-auto object-contain" />
                      <button
                        type="button"
                        onClick={clearPlanImage}
                        className="absolute top-2 right-2 w-8 h-8 bg-black/60 rounded-full flex items-center justify-center text-white"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => planImageInputRef.current?.click()}
                      className="w-full py-4 border-2 border-dashed border-gray-200 rounded-2xl flex items-center justify-center gap-2 text-gray-400 hover:border-gray-300 hover:text-gray-500 transition-colors"
                    >
                      <ImagePlus size={20} />
                      <span className="text-sm font-medium">Add photo</span>
                    </button>
                  )}
                  <input
                    ref={planImageInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePlanImageChange}
                  />
                </div>

                <div className="flex gap-3 mb-4">
                  <div className="flex-1">
                    <p className="text-xs text-gray-400 mb-1 font-semibold">Amount (KSH)</p>
                    <input
                      type="number"
                      value={planAmount}
                      onChange={(e) => setPlanAmount(e.target.value)}
                      placeholder="e.g. 500"
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-black transition-colors"
                    />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-gray-400 mb-1 font-semibold">Slots</p>
                    <input
                      type="number"
                      value={planSlots}
                      onChange={(e) => setPlanSlots(e.target.value)}
                      placeholder="e.g. 5"
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-black transition-colors"
                    />
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col gap-3 mb-3">
                <div className="mb-1">
                  {functionImagePreview ? (
                    <div className="relative rounded-2xl overflow-hidden bg-gray-100 flex items-center justify-center">
                      <img src={functionImagePreview} alt="Function preview" className="max-w-full max-h-64 w-auto h-auto object-contain" />
                      <button
                        type="button"
                        onClick={clearFunctionImage}
                        className="absolute top-2 right-2 w-8 h-8 bg-black/60 rounded-full flex items-center justify-center text-white"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => functionImageInputRef.current?.click()}
                      className="w-full py-4 border-2 border-dashed border-gray-200 rounded-2xl flex items-center justify-center gap-2 text-gray-400 hover:border-gray-300 hover:text-gray-500 transition-colors"
                    >
                      <ImagePlus size={20} />
                      <span className="text-sm font-medium">Add function photo</span>
                    </button>
                  )}
                  <input
                    ref={functionImageInputRef}
                    id="function-image-input"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFunctionImageChange}
                  />
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <p className="text-xs text-gray-400 mb-1 font-semibold">Amount per person (KSH)</p>
                    <input
                      type="number"
                      value={functionAmount}
                      onChange={(e) => setFunctionAmount(e.target.value)}
                      placeholder="e.g. 500"
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-black transition-colors"
                    />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-gray-400 mb-1 font-semibold">Capacity</p>
                    <input
                      type="number"
                      value={functionCapacity}
                      onChange={(e) => setFunctionCapacity(e.target.value)}
                      placeholder="e.g. 25"
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-black transition-colors"
                    />
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <p className="text-xs text-gray-400 mb-1 font-semibold">Date &amp; time</p>
                    <input
                      type="datetime-local"
                      value={functionDate}
                      onChange={(e) => setFunctionDate(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-black transition-colors"
                    />
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1 font-semibold">Location</p>
                  <input
                    type="text"
                    value={functionLocation}
                    onChange={(e) => setFunctionLocation(e.target.value)}
                    placeholder="Westlands, Nairobi"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-black transition-colors"
                  />
                </div>
              </div>
            )}

            {postError && (
              <p className="mb-3 text-sm text-red-600">{postError}</p>
            )}
            <button
              onClick={handlePost}
              disabled={isPosting || (composeMode === "plan" ? !planTitle.trim() : !functionTitle.trim() || !functionAmount.trim())}
              className="w-full py-4 bg-black text-white rounded-2xl font-bold text-base disabled:opacity-40 transition-opacity"
            >
              {isPosting ? (
                "Posting..."
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Send size={16} /> {composeMode === "plan" ? "Post Plan" : "Post Function"}
                </span>
              )}
            </button>
          </div>
        </div>
      )}
{/* Function Payment Modal */}
      {functionPayTarget && user && (
        <FunctionPayModal
          amount={functionPayTarget.amount_per_person}
          functionId={functionPayTarget.id}
          userId={user.id}
          defaultPhoneNumber={profile?.phone_number || getSavedPhoneNumber(user.id) || undefined}
          onClose={() => setFunctionPayTarget(null)}
          onRefreshStatus={refreshFunctionPaymentStatus}
        />
      )}

      {/* Function Chat Modal */}
      {activeFunctionThread && user && (
        <FunctionMessagesModal
          functionItem={activeFunctionThread}
          currentUserId={user.id}
          onMessagesRead={(functionId) => setFunctionUnreadCounts((prev) => ({ ...prev, [functionId]: 0 }))}
          onClose={() => setActiveFunctionThread(null)}
        />
      )}

      {/* Plan Chat Modal */}
      {activePlanChat && user && (
        <PlanMessagesModal
          plan={activePlanChat}
          currentUserId={user.id}
          onClose={() => setActivePlanChat(null)}
        />
      )}

      {/* Floating compose button */}
      <button
        onClick={() => setShowCompose(true)}
        className="fixed bottom-24 left-1/2 -translate-x-1/2 px-8 py-3.5 bg-black text-white rounded-full shadow-lg flex items-center gap-2 font-bold text-sm z-40 hover:bg-gray-800 transition-colors"
      >
        <Send size={16} /> Post a Plan
      </button>
    </div>
  );
}