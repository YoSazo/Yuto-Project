import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, ArrowDownLeft, ArrowUpRight, CreditCard, Sparkles } from "lucide-react";
import UserAvatar from "../UserAvatar";
import {
  acceptWalletOffer,
  fetchYutoBalance,
  getMoneyInbox,
  supabase,
  type MoneyInbox,
} from "../../lib/supabase";
import { toast } from "sonner";
import { haptics } from "../../lib/haptics";

const fmtKes = (v: number) =>
  `KES ${Math.round(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

export function MoneyInboxTab({ userId }: { userId: string }) {
  const navigate = useNavigate();
  const [data, setData] = useState<MoneyInbox | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const [inbox, bal] = await Promise.all([
        getMoneyInbox(userId),
        fetchYutoBalance(userId).catch(() => null),
      ]);
      setData(inbox);
      setBalance(bal);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    void refresh();

    // Realtime: refresh when any of the surfaces change. Cheap to recompute,
    // and means accept/pay actions reflect everywhere on this screen.
    const ch = supabase
      .channel(`money-inbox-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "wallet_offers" }, () => void refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "group_members" }, () => void refresh())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "transactions", filter: `user_id=eq.${userId}` }, () => void refresh())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-2 border-black dark:border-white border-t-transparent dark:border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) return null;

  const nothing =
    data.pendingOffersForMe.length === 0 &&
    data.splitsIOwe.length === 0 &&
    data.splitsOwedToMe.length === 0 &&
    data.recentTransfers.length === 0;

  if (nothing) {
    return (
      <div className="py-20 text-center">
        <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-zinc-800 mx-auto flex items-center justify-center mb-3">
          <Sparkles size={22} className="text-gray-400 dark:text-gray-500" />
        </div>
        <p className="font-bold text-black dark:text-white text-lg">Nothing pending</p>
        <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">When someone sends, requests, or splits with you, it'll show up here.</p>
      </div>
    );
  }

  const handleAccept = async (offerId: string) => {
    setAcceptingId(offerId);
    try {
      await acceptWalletOffer(offerId);
      haptics.success();
      toast.success("Money in your balance");
      await refresh();
    } catch (e: any) {
      const msg = e?.message || "";
      // If already accepted or insufficient balance on sender side, just refresh
      // to clear the stale offer from the list
      if (msg.includes("already") || msg.includes("Insufficient") || msg.includes("not found") || msg.includes("pending")) {
        toast("Already claimed or expired — refreshing");
        await refresh();
      } else {
        console.error(e);
        haptics.error();
        toast.error(msg || "Couldn't accept. Try again.");
      }
    } finally {
      setAcceptingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Balance hero — same visual language as Profile so users recognize it. */}
      <div className="bg-black rounded-3xl p-6 text-white relative overflow-hidden shadow-lg">
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10">
          <p className="text-xs text-white/55 mb-1 font-semibold">Yuto Balance</p>
          <div className="flex items-end gap-2">
            <span className="text-gray-400 text-lg font-medium">KES</span>
            <span className="text-5xl font-bold tracking-tight">
              {balance != null ? Math.round(balance).toLocaleString(undefined, { maximumFractionDigits: 0 }) : "…"}
            </span>
          </div>
        </div>
      </div>

      {/* Pending offers I can accept */}
      {data.pendingOffersForMe.length > 0 && (
        <Section title="Money waiting for you">
          {data.pendingOffersForMe.map((o) => (
            <div key={o.id} className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-4 shadow-sm flex items-center gap-3">
              <UserAvatar name={o.sender?.display_name || "Someone"} avatarUrl={o.sender?.avatar_url ?? null} size="md" />
              <div className="min-w-0 flex-1">
                <p className="font-bold text-black dark:text-white truncate">
                  {o.sender?.display_name || o.sender?.username || "Someone"} sent {fmtKes(o.amount_kes)}
                </p>
                <p className="text-xs text-gray-400 truncate">
                  {o.note ? o.note : o.group_chat_id ? "First to accept gets it" : "Direct send"} · {timeAgo(o.created_at)}
                </p>
              </div>
              <button
                type="button"
                disabled={acceptingId === o.id}
                onClick={() => void handleAccept(o.id)}
                className="px-4 py-2 rounded-full bg-black text-white text-sm font-bold disabled:opacity-50"
              >
                {acceptingId === o.id ? "…" : "Accept"}
              </button>
            </div>
          ))}
        </Section>
      )}

      {/* Splits I owe */}
      {data.splitsIOwe.length > 0 && (
        <Section title="You owe">
          {data.splitsIOwe.map((s) => (
            <button
              key={s.group_id}
              type="button"
              onClick={() => navigate(`/yuto/${s.group_id}`)}
              className="w-full bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-4 shadow-sm flex items-center gap-3 text-left hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
            >
              <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center shrink-0">
                <ArrowUpRight size={22} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-black dark:text-white truncate">
                  {s.function_title || s.group_name || "Split"}
                </p>
                <p className="text-xs text-gray-400 truncate">
                  {fmtKes(s.per_person_kes)} to {s.host?.display_name || s.host?.username || "host"}
                </p>
              </div>
              <ArrowRight size={18} className="text-gray-400 shrink-0" />
            </button>
          ))}
        </Section>
      )}

      {/* Splits owed to me */}
      {data.splitsOwedToMe.length > 0 && (
        <Section title="Owed to you">
          {data.splitsOwedToMe.map((s) => (
            <button
              key={s.group_id}
              type="button"
              onClick={() => navigate(`/yuto/${s.group_id}`)}
              className="w-full bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-4 shadow-sm flex items-center gap-3 text-left hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
            >
              <div className="w-12 h-12 rounded-2xl bg-green-50 text-green-600 flex items-center justify-center shrink-0">
                <ArrowDownLeft size={22} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-black dark:text-white truncate">
                  {s.function_title || s.group_name || "Split"}
                </p>
                <p className="text-xs text-gray-400 truncate">
                  {s.unpaid_count} {s.unpaid_count === 1 ? "person" : "people"} · {fmtKes(s.per_person_kes)} each
                </p>
              </div>
              <ArrowRight size={18} className="text-gray-400 shrink-0" />
            </button>
          ))}
        </Section>
      )}

      {/* Recent Activity (Transfers & Split Receipts) */}
      {data.recentTransfers.length > 0 && (
        <Section title="Activity">
          {data.recentTransfers.map((t) => {
            const positive = t.amount > 0;
            return (
              <div
                key={t.id}
                className="w-full bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-4 shadow-sm flex items-center gap-3"
              >
                {t.counterparty ? (
                  <UserAvatar
                    name={t.counterparty.display_name || "User"}
                    avatarUrl={t.counterparty.avatar_url ?? null}
                    size="md"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-2xl bg-gray-100 text-gray-500 flex items-center justify-center shrink-0">
                    <CreditCard size={20} />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-black dark:text-white truncate">{labelForTx(t)}</p>
                  <p className="text-xs text-gray-400 truncate">{subtitleForTx(t)}</p>
                </div>
                <span className={`text-sm font-extrabold shrink-0 ${positive ? "text-green-600" : "text-black"}`}>
                  {positive ? "+" : "−"}
                  {fmtKes(Math.abs(t.amount))}
                </span>
              </div>
            );
          })}
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 px-1">{title}</p>
      {children}
    </div>
  );
}

function labelForTx(t: { kind: string | null; counterparty: { display_name: string; username: string } | null; amount: number; note: string | null }) {
  const name = t.counterparty?.display_name || t.counterparty?.username || null;
  switch (t.kind) {
    case "topup":
      return "Top-up via M-PESA";
    case "transfer_sent":
      return name ? `Sent to ${name}` : "Sent";
    case "transfer_received":
      return name ? `Received from ${name}` : "Received";
    case "wallet_offer_accepted":
      return name ? `Accepted from ${name}` : "Accepted offer";
    case "wallet_offer_sent":
      return name ? `Offer to ${name}` : "Offer sent";
    case "split_pay":
    case "split_payment_sent":
      return "Paid split";
    case "split_received":
    case "split_payment_received":
      return name ? `Payment from ${name}` : "Split payment";
    case "referral_bonus":
      return "Referral bonus";
    default:
      return t.note?.slice(0, 60) || (t.amount >= 0 ? "Money received" : "Money sent");
  }
}

function subtitleForTx(t: { note: string | null; created_at: string }) {
  return [t.note?.trim(), timeAgo(t.created_at)].filter(Boolean).join(" · ");
}
