import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MessageCircle, Send, Share2, Users, ExternalLink } from "lucide-react";
import UserAvatar from "../UserAvatar";
import { supabase, getOrCreateDmConversation, ensureFunctionAttendeeChat, type HostedFunctionItem } from "../../lib/supabase";
import { toast } from "sonner";

type Attendee = {
  user_id: string;
  has_paid: boolean;
  joined_at: string | null;
  display_name: string;
  username: string;
  avatar_url: string | null;
};

/**
 * Expanded host dashboard for a single function.
 * Shows attendees, revenue, Q&A messages, quick actions.
 */
export function HostFunctionDashboard({
  fn,
  userId,
  onClose,
}: {
  fn: HostedFunctionItem;
  userId: string;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"attendees" | "messages">("attendees");
  const [messages, setMessages] = useState<any[]>([]);

  useEffect(() => {
    loadData();

    // Realtime: refresh when members or messages change
    const channel = supabase
      .channel(`host-dashboard-${fn.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "function_members", filter: `function_id=eq.${fn.id}` }, () => loadData())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "function_messages", filter: `function_id=eq.${fn.id}` }, () => loadData())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fn.id]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load attendees
      const { data: members } = await supabase
        .from("function_members")
        .select("user_id, has_paid, joined_at, profiles(display_name, username, avatar_url)")
        .eq("function_id", fn.id);

      setAttendees(
        ((members || []) as any[]).map((m) => ({
          user_id: m.user_id,
          has_paid: m.has_paid,
          joined_at: m.joined_at,
          display_name: m.profiles?.display_name || "User",
          username: m.profiles?.username || "",
          avatar_url: m.profiles?.avatar_url || null,
        }))
      );

      // Load Q&A messages
      const { data: msgs } = await supabase
        .from("function_messages")
        .select("id, user_id, content, created_at, profiles(display_name, username, avatar_url)")
        .eq("function_id", fn.id)
        .order("created_at", { ascending: false })
        .limit(20);
      setMessages(msgs || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const paidCount = attendees.filter((a) => a.has_paid).length;
  const revenue = paidCount * fn.amount_per_person;

  const handleDm = async (targetUserId: string) => {
    try {
      const convo = await getOrCreateDmConversation(userId, targetUserId);
      navigate(`/messages/${convo.id}`, { state: { otherUserId: targetUserId } });
    } catch {
      toast.error("Couldn't open DM");
    }
  };

  const shareLink = (() => {
    const origin = window.location.hostname === "localhost" || window.location.hostname.startsWith("127.") ? window.location.origin : "https://yuto.social";
    return `${origin}/f/${fn.id}`;
  })();

  return (
    <div className="fixed inset-0 z-50 bg-white dark:bg-black flex flex-col transition-colors overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-5 pt-6 pb-4 border-b border-gray-100 dark:border-zinc-800">
        <div className="flex items-center justify-between mb-3">
          <button type="button" onClick={onClose} className="text-sm font-bold text-gray-500 dark:text-gray-400 bg-transparent border-none">← Back</button>
          <button
            type="button"
            onClick={() => { navigator.clipboard.writeText(shareLink); toast.success("Link copied!"); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-100 dark:bg-zinc-800 text-black dark:text-white text-xs font-bold"
          >
            <Share2 size={14} /> Share
          </button>
        </div>
        <div className="flex items-center gap-3">
          {fn.image_url && (
            <img src={fn.image_url} alt="" className="w-14 h-14 rounded-2xl object-cover shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <p className="font-bold text-lg text-black dark:text-white truncate">{fn.title}</p>
            <p className="text-sm text-gray-400 dark:text-gray-500">
              {fn.date ? new Date(fn.date).toLocaleDateString("en-KE", { weekday: "short", month: "short", day: "numeric" }) : "Anytime"}
              {fn.location ? ` · ${fn.location}` : ""}
            </p>
          </div>
        </div>

        {/* Stats row */}
        <div className="flex gap-3 mt-4">
          <div className="flex-1 bg-gray-50 dark:bg-zinc-900 rounded-2xl p-3 text-center">
            <p className="text-2xl font-black text-black dark:text-white">{paidCount}</p>
            <p className="text-[10px] text-gray-400 font-semibold uppercase">Paid</p>
          </div>
          <div className="flex-1 bg-gray-50 dark:bg-zinc-900 rounded-2xl p-3 text-center">
            <p className="text-2xl font-black text-black dark:text-white">{attendees.length}</p>
            <p className="text-[10px] text-gray-400 font-semibold uppercase">Joined</p>
          </div>
          <div className="flex-1 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl p-3 text-center">
            <p className="text-2xl font-black text-emerald-700 dark:text-emerald-400">KSH {revenue.toLocaleString()}</p>
            <p className="text-[10px] text-emerald-600 dark:text-emerald-500 font-semibold uppercase">Earned</p>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-2 mt-4">
          <button
            type="button"
            onClick={() => setActiveTab("attendees")}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors border-none ${activeTab === "attendees" ? "bg-black dark:bg-white text-white dark:text-black" : "bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-gray-400"}`}
          >
            <Users size={14} className="inline mr-1.5" />Attendees ({attendees.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("messages")}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors border-none ${activeTab === "messages" ? "bg-black dark:bg-white text-white dark:text-black" : "bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-gray-400"}`}
          >
            <MessageCircle size={14} className="inline mr-1.5" />Q&A ({messages.length})
          </button>
        </div>

        {/* Quick action: open attendee group chat */}
        {paidCount > 0 && (
          <button
            type="button"
            onClick={async () => {
              try {
                const gid = await ensureFunctionAttendeeChat(fn.id);
                navigate(`/messages/group/${gid}`);
              } catch {
                toast.error("Couldn't open attendee chat");
              }
            }}
            className="w-full mt-3 py-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 font-bold text-sm flex items-center justify-center gap-2 border border-emerald-200 dark:border-emerald-800"
          >
            <ExternalLink size={14} /> Open Attendee Group Chat
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-black dark:border-white border-t-transparent dark:border-t-transparent rounded-full animate-spin" />
          </div>
        ) : activeTab === "attendees" ? (
          <div className="space-y-2">
            {attendees.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-400 dark:text-gray-500 text-sm">No attendees yet. Share the link to get people in!</p>
              </div>
            ) : (
              attendees.map((a) => (
                <div key={a.user_id} className="flex items-center gap-3 p-3 rounded-2xl bg-gray-50 dark:bg-zinc-900">
                  <UserAvatar name={a.display_name} avatarUrl={a.avatar_url} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-black dark:text-white truncate">{a.display_name}</p>
                    <p className="text-xs text-gray-400">@{a.username}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${a.has_paid ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" : "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"}`}>
                    {a.has_paid ? "Paid" : "Unpaid"}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDm(a.user_id)}
                    className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-zinc-800 text-black dark:text-white flex items-center justify-center border-none hover:bg-gray-200 dark:hover:bg-zinc-700"
                    title="DM"
                  >
                    <Send size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate(`/user/${a.user_id}`)}
                    className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-zinc-800 text-black dark:text-white flex items-center justify-center border-none hover:bg-gray-200 dark:hover:bg-zinc-700"
                    title="View profile"
                  >
                    <Users size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {messages.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-400 dark:text-gray-500 text-sm">No questions yet. People can ask via the chat icon on your function card.</p>
              </div>
            ) : (
              messages.map((m: any) => (
                <div key={m.id} className="flex items-start gap-2 p-3 rounded-2xl bg-gray-50 dark:bg-zinc-900">
                  <UserAvatar name={m.profiles?.display_name || "User"} avatarUrl={m.profiles?.avatar_url} size="sm" className="w-8 h-8 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-xs text-black dark:text-white">{m.profiles?.display_name || "User"}</p>
                      <p className="text-[10px] text-gray-400">{new Date(m.created_at).toLocaleString("en-KE", { dateStyle: "short", timeStyle: "short" })}</p>
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300 mt-0.5">{m.content}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDm(m.user_id)}
                    className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-zinc-800 text-black dark:text-white flex items-center justify-center border-none shrink-0"
                    title="Reply in DM"
                  >
                    <Send size={12} />
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
