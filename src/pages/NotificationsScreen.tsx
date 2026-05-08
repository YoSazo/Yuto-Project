import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Bell, Wallet, Ticket, Users } from "lucide-react";
import UserAvatar from "../components/UserAvatar";
import { useAuth } from "../contexts/AuthContext";
import { getMyNotifications, getMyNotificationUnreadCount, markAllNotificationsRead, markNotificationRead, type AppNotification } from "../lib/supabase";
import { toast } from "sonner";

function iconForType(type: string) {
  if (/pay|paid|payout|topup|wallet/i.test(type)) return <Wallet size={18} />;
  if (/ticket|function|listing|buy|book/i.test(type)) return <Ticket size={18} />;
  if (/friend|social|join/i.test(type)) return <Users size={18} />;
  return <Bell size={18} />;
}

function timeAgo(ts: string) {
  const d = new Date(ts).getTime();
  const diff = Math.max(0, Date.now() - d);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

export default function NotificationsScreen() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [n, c] = await Promise.all([getMyNotifications(user.id, 60), getMyNotificationUnreadCount(user.id)]);
      setRows(n);
      setUnread(c);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void (async () => {
      await load();
      if (user) {
        await markAllNotificationsRead(user.id).catch(() => {});
        await load();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const hasUnread = unread > 0;
  const grouped = useMemo(() => rows, [rows]);

  return (
    <div className="flex flex-col overflow-y-auto pb-28 px-5 pt-6">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="w-11 h-11 rounded-2xl bg-gray-100 text-black flex items-center justify-center hover:bg-gray-200 transition-colors shrink-0"
            aria-label="Back"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0">
            <p className="text-2xl font-bold text-black truncate">Notifications</p>
            <p className="text-xs text-gray-400 font-semibold">
              {hasUnread ? `${unread} unread` : "All caught up"}
            </p>
          </div>
        </div>

        <div className="w-11 h-11" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin" />
        </div>
      ) : grouped.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-gray-400 font-semibold">No alerts yet.</p>
          <p className="text-sm text-gray-500 mt-2 font-semibold">
            Invite a friend and your feed will light up fast.
          </p>
          <button
            type="button"
            onClick={async () => {
              const uname = profile?.username?.trim();
              const shareOrigin =
                window.location.hostname === "localhost" || window.location.hostname.startsWith("127.")
                  ? window.location.origin
                  : "https://yuto.social";
              const url = uname ? `${shareOrigin}/invite/${encodeURIComponent(uname)}` : `${shareOrigin}/home`;
              const title = "Join me on Yuto";
              const text = "Add me on Yuto — we can split and buy things together.";
              try {
                if (navigator.share) {
                  await navigator.share({ title, text, url });
                  return;
                }
              } catch {
                // fall back
              }
              try {
                await navigator.clipboard.writeText(url);
                toast.success("Invite link copied!");
              } catch {
                navigate("/friends");
              }
            }}
            className="mt-5 h-12 px-6 rounded-2xl bg-black hover:bg-gray-800 text-white font-extrabold transition-colors tap-scale"
          >
            Invite a friend
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {grouped.map((n) => {
            const actor = n.actor || null;
            return (
              <button
                key={n.id}
                type="button"
                onClick={async () => {
                  if (user && !n.is_read) await markNotificationRead(n.id, user.id).catch(() => {});

                  // Routing intentionally maps each notification class to the
                  // surface a user is most likely to act on:
                  //  - Plan/function MESSAGES → open the chat directly
                  //    (openChat: true), not just scroll to the card.
                  //  - Plan/function activity (joins, ticket, host posts)
                  //    → focus the card on Home so they can see context.
                  //  - Wallet activity (offers, transfers, top-ups) → Money
                  //    Inbox, where the action lives. /profile was a dead end.
                  const isMsg = /message|chat|reply|comment|update/i.test(n.type);
                  const isWallet = /wallet|offer|transfer|topup|payout|withdraw/i.test(n.type);

                  if (n.reference_kind === "group" && n.reference_id) {
                    const autoPay = /split_invited|split_invite|split_payment_required|split_request/i.test(n.type);
                    navigate(`/yuto/${n.reference_id}`, { state: autoPay ? { autoPay: true } : undefined });
                  } else if (n.reference_kind === "function" && n.reference_id) {
                    navigate("/home", {
                      state: { focus: { kind: "function", id: n.reference_id, openChat: isMsg } },
                    });
                  } else if (n.reference_kind === "plan" && n.reference_id) {
                    navigate("/home", {
                      state: { focus: { kind: "plan", id: n.reference_id, openChat: isMsg } },
                    });
                  } else if (n.reference_kind === "user" && n.reference_id) {
                    navigate(`/user/${n.reference_id}`);
                  } else if (n.reference_kind === "wallet_transfer" || n.reference_kind === "wallet_offer" || isWallet) {
                    navigate("/messages?tab=money");
                  } else if (n.reference_kind === "dm_conversation" && n.reference_id) {
                    const otherUserId = n.actor_id || undefined;
                    navigate(`/messages/${n.reference_id}`, { state: otherUserId ? { otherUserId } : undefined });
                  } else if (n.reference_kind === "group_chat" && n.reference_id) {
                    navigate(`/messages/group/${n.reference_id}`);
                  } else if (n.reference_kind === "highlight" && n.reference_id) {
                    const profileUserId = n.actor_id || n.reference_id;
                    navigate(`/user/${profileUserId}`, { state: { openHighlightId: n.reference_id } });
                  } else if (n.reference_kind === "listing" && n.reference_id) {
                    navigate("/messages?tab=business");
                  } else {
                    await load();
                  }
                }}
                className={[
                  "w-full rounded-3xl border px-4 py-4 text-left shadow-sm transition-colors",
                  n.is_read ? "bg-white border-gray-100 hover:bg-gray-50" : "bg-gray-50 border-gray-200 hover:bg-gray-100",
                ].join(" ")}
              >
                <div className="flex items-start gap-3">
                  {actor ? (
                    <UserAvatar name={actor.display_name || actor.username} avatarUrl={actor.avatar_url} size="sm" />
                  ) : (
                    <div className="w-10 h-10 rounded-2xl bg-black text-white flex items-center justify-center shrink-0">
                      {iconForType(n.type)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-extrabold text-black truncate">{n.title}</p>
                      <span className="text-xs text-gray-400 font-semibold">· {timeAgo(n.created_at)}</span>
                      {!n.is_read && <span className="ml-auto w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />}
                    </div>
                    {n.body ? <p className="mt-1 text-sm text-gray-600 whitespace-pre-wrap break-words">{n.body}</p> : null}

                    {typeof n.amount_kes === "number" ? (
                      <div className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-gray-200 text-xs font-extrabold text-black">
                        <Wallet size={14} />
                        KSH {Number(n.amount_kes).toLocaleString("en-KE")}
                      </div>
                    ) : null}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

