import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MessageCircle, Send, Share2, Users, ShoppingBag, ExternalLink } from "lucide-react";
import UserAvatar from "../UserAvatar";
import { supabase, getOrCreateDmConversation, type StorefrontListingItem } from "../../lib/supabase";
import { toast } from "sonner";

type Buyer = {
  user_id: string;
  has_paid: boolean;
  paid_at: string | null;
  display_name: string;
  username: string;
  avatar_url: string | null;
  buyer_confirmed_at: string | null;
};

type BizDmContext = {
  conversation_id: string;
  buyer_id: string;
  listing_title: string;
  created_at: string;
  buyer?: { display_name: string; username: string; avatar_url: string | null };
};

/**
 * Full-screen dashboard for a single listing (sell or service).
 * Shows buyers/bookings, business DMs, revenue, quick actions.
 */
export function HostListingDashboard({
  listing,
  userId,
  onClose,
}: {
  listing: StorefrontListingItem;
  userId: string;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [bizDms, setBizDms] = useState<BizDmContext[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"buyers" | "inquiries">("buyers");

  useEffect(() => {
    loadData();

    const channel = supabase
      .channel(`listing-dashboard-${listing.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "function_members", filter: `function_id=eq.${listing.id}` }, () => loadData())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "dm_conversation_context", filter: `function_id=eq.${listing.id}` }, () => loadData())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [listing.id]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load buyers (people who paid)
      const { data: members } = await supabase
        .from("function_members")
        .select("user_id, has_paid, paid_at, buyer_confirmed_at, profiles(display_name, username, avatar_url)")
        .eq("function_id", listing.id);

      setBuyers(
        ((members || []) as any[]).map((m) => ({
          user_id: m.user_id,
          has_paid: m.has_paid,
          paid_at: m.paid_at,
          buyer_confirmed_at: m.buyer_confirmed_at,
          display_name: m.profiles?.display_name || "User",
          username: m.profiles?.username || "",
          avatar_url: m.profiles?.avatar_url || null,
        }))
      );

      // Load business DM contexts for this listing
      const { data: contexts } = await supabase
        .from("dm_conversation_context")
        .select("conversation_id, buyer_id, listing_title, created_at")
        .eq("function_id", listing.id)
        .order("created_at", { ascending: false });

      // Hydrate buyer profiles
      const buyerIds = (contexts || []).map((c: any) => c.buyer_id).filter(Boolean);
      let profileMap: Record<string, any> = {};
      if (buyerIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, display_name, username, avatar_url")
          .in("id", buyerIds);
        (profiles || []).forEach((p: any) => { profileMap[p.id] = p; });
      }

      setBizDms(
        ((contexts || []) as any[]).map((c) => ({
          ...c,
          buyer: profileMap[c.buyer_id] || null,
        }))
      );
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const paidBuyers = buyers.filter((b) => b.has_paid);
  const revenue = paidBuyers.length * listing.amount_per_person;
  const isSell = listing.kind === "sell";

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
    return `${origin}/f/${listing.id}`;
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
          {listing.image_url && (
            <img src={listing.image_url} alt="" className="w-14 h-14 rounded-2xl object-cover shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <p className="font-bold text-lg text-black dark:text-white truncate">{listing.title}</p>
            <p className="text-sm text-gray-400 dark:text-gray-500">
              {isSell ? "Marketplace listing" : "Service"} · KSH {listing.amount_per_person.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Stats row */}
        <div className="flex gap-3 mt-4">
          <div className="flex-1 bg-gray-50 dark:bg-zinc-900 rounded-2xl p-3 text-center">
            <p className="text-2xl font-black text-black dark:text-white">{paidBuyers.length}</p>
            <p className="text-[10px] text-gray-400 font-semibold uppercase">{isSell ? "Sold" : "Booked"}</p>
          </div>
          <div className="flex-1 bg-gray-50 dark:bg-zinc-900 rounded-2xl p-3 text-center">
            <p className="text-2xl font-black text-black dark:text-white">{bizDms.length}</p>
            <p className="text-[10px] text-gray-400 font-semibold uppercase">Inquiries</p>
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
            onClick={() => setActiveTab("buyers")}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors border-none ${activeTab === "buyers" ? "bg-black dark:bg-white text-white dark:text-black" : "bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-gray-400"}`}
          >
            <ShoppingBag size={14} className="inline mr-1.5" />{isSell ? "Buyers" : "Bookings"} ({paidBuyers.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("inquiries")}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors border-none ${activeTab === "inquiries" ? "bg-black dark:bg-white text-white dark:text-black" : "bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-gray-400"}`}
          >
            <MessageCircle size={14} className="inline mr-1.5" />Inquiries ({bizDms.length})
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-black dark:border-white border-t-transparent dark:border-t-transparent rounded-full animate-spin" />
          </div>
        ) : activeTab === "buyers" ? (
          <div className="space-y-2">
            {paidBuyers.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-400 dark:text-gray-500 text-sm">No {isSell ? "buyers" : "bookings"} yet. Share the link!</p>
              </div>
            ) : (
              paidBuyers.map((b) => (
                <div key={b.user_id} className="flex items-center gap-3 p-3 rounded-2xl bg-gray-50 dark:bg-zinc-900">
                  <UserAvatar name={b.display_name} avatarUrl={b.avatar_url} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-black dark:text-white truncate">{b.display_name}</p>
                    <p className="text-xs text-gray-400">
                      {b.paid_at ? new Date(b.paid_at).toLocaleDateString("en-KE", { month: "short", day: "numeric" }) : ""}
                      {b.buyer_confirmed_at ? " · Confirmed ✓" : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDm(b.user_id)}
                    className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-zinc-800 text-black dark:text-white flex items-center justify-center border-none hover:bg-gray-200 dark:hover:bg-zinc-700"
                    title="DM"
                  >
                    <Send size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate(`/user/${b.user_id}`)}
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
          <div className="space-y-2">
            {bizDms.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-400 dark:text-gray-500 text-sm">No inquiries yet. When someone messages about this listing, they'll appear here.</p>
              </div>
            ) : (
              bizDms.map((dm) => (
                <button
                  key={dm.conversation_id}
                  type="button"
                  onClick={() => navigate(`/messages/${dm.conversation_id}`, { state: { otherUserId: dm.buyer_id } })}
                  className="w-full flex items-center gap-3 p-3 rounded-2xl bg-gray-50 dark:bg-zinc-900 text-left border-none hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  <UserAvatar name={dm.buyer?.display_name || "User"} avatarUrl={dm.buyer?.avatar_url || null} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-black dark:text-white truncate">{dm.buyer?.display_name || "User"}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(dm.created_at).toLocaleDateString("en-KE", { month: "short", day: "numeric" })}
                    </p>
                  </div>
                  <ExternalLink size={14} className="text-gray-400 shrink-0" />
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
