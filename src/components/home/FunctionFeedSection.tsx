import UserAvatar from "../UserAvatar";
import { MessageCircle, Users, MapPin, BadgeDollarSign, Sparkles, CalendarDays, Ticket, Share2 } from "lucide-react";
import { formatEventDate, type FunctionListing } from "../../pages/home/types";

export function FunctionFeedSection({
  functionsFeed,
  currentUserId,
  functionUnreadCounts,
  onNavigateToHost,
  onOpenFunctionThread,
  onJoinFunction,
  onOpenTicket,
}: {
  functionsFeed: FunctionListing[];
  currentUserId?: string;
  functionUnreadCounts: Record<string, number>;
  onNavigateToHost: (hostUserId: string) => void;
  onOpenFunctionThread: (f: FunctionListing) => void;
  onJoinFunction: (f: FunctionListing) => void;
  onOpenTicket: (f: FunctionListing) => void;
}) {
  if (functionsFeed.length === 0) return null;

  const shareFunction = async (f: FunctionListing) => {
    const shareOrigin =
      window.location.hostname === "localhost" || window.location.hostname.startsWith("127.")
        ? window.location.origin
        : "https://yuto.social";
    const url = `${shareOrigin}/function/${f.id}`;
    const title = `🎉 ${f.host.display_name} is hosting a ${f.title}`;
    const text = `${formatEventDate(f.date)} · KSH ${f.amount_per_person.toLocaleString("en-KE")}`;
    try {
      if (navigator.share) {
        await navigator.share({ title, text, url });
        return;
      }
    } catch {
      // fall back to copy
    }
    try {
      await navigator.clipboard.writeText(url);
      alert("Link copied!");
    } catch {
      alert(url);
    }
  };

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Functions</p>
        <span className="text-xs text-gray-400">Hosted now</span>
      </div>
      <div className="flex flex-col gap-4 mb-6">
        {functionsFeed.map((eventFunction) => {
          const fm = eventFunction.function_members ?? [];
          const isHost = eventFunction.host_id === currentUserId;
          const isMember = fm.some((m) => m.user_id === currentUserId);
          const me = fm.find((m) => m.user_id === currentUserId);
          const paidCount = fm.filter((m) => m.has_paid).length;
          const joinedCount = fm.length;
          const isFull = eventFunction.max_capacity ? joinedCount >= eventFunction.max_capacity && !isMember : false;
          const canJoin = !isHost && !isMember && !isFull;
          const canPay = isMember && !me?.has_paid;
          const unreadCount = functionUnreadCounts[eventFunction.id] || 0;
          const isSell = eventFunction.location === "__SELL__";
          const remainingStock =
            isSell && eventFunction.max_capacity != null ? Math.max(0, eventFunction.max_capacity - paidCount) : null;

          return (
            <div
              key={eventFunction.id}
              className="bg-white border border-gray-200/80 rounded-3xl p-4 relative overflow-hidden premium-function-card function-card-highlight"
            >
              <div
                className="flex items-start gap-2 mb-3 cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => onNavigateToHost(eventFunction.host.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onNavigateToHost(eventFunction.host.id);
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <UserAvatar name={eventFunction.host.display_name} avatarUrl={eventFunction.host.avatar_url} size="sm" />
                <div className="flex-1">
                  <p className="font-semibold text-sm text-black">
                    {isSell
                      ? `${eventFunction.host.display_name} has something for you`
                      : `${eventFunction.host.display_name} is hosting a function`}
                  </p>
                  {!isSell && <p className="text-xs text-gray-400">{formatEventDate(eventFunction.date)}</p>}
                </div>
                <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-black text-white uppercase tracking-wide">
                  {isSell ? "Sell" : "Function"}
                </span>
              </div>

              <p className="font-bold text-black text-lg mb-1">{eventFunction.title}</p>
              {eventFunction.image_url && (
                <div className="mb-3 rounded-xl overflow-hidden bg-gray-100">
                  <img src={eventFunction.image_url} alt="Function cover" className="block w-full h-auto" />
                </div>
              )}
              {eventFunction.description && <p className="text-sm text-gray-600 mb-3">{eventFunction.description}</p>}

              <div className="flex flex-wrap gap-2 mb-4">
                <span className="bg-orange-50 text-orange-700 font-bold text-sm px-3 py-1.5 rounded-full flex items-center gap-1.5">
                  <BadgeDollarSign size={14} /> KSH {eventFunction.amount_per_person.toLocaleString()}
                </span>
                {isSell ? (
                  <>
                    {remainingStock != null && (
                      <span className="bg-gray-100 text-gray-600 font-bold text-sm px-3 py-1.5 rounded-full flex items-center gap-1.5">
                        <Sparkles size={14} /> {remainingStock} left
                      </span>
                    )}
                    {paidCount > 0 && (
                      <span className="bg-gray-100 text-gray-600 font-bold text-sm px-3 py-1.5 rounded-full flex items-center gap-1.5">
                        <Users size={14} /> {paidCount} bought
                      </span>
                    )}
                  </>
                ) : (
                  <span className="bg-gray-100 text-gray-600 font-bold text-sm px-3 py-1.5 rounded-full inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                    <span className="inline-flex items-center gap-1.5">
                      <Users size={14} /> {joinedCount} joining
                    </span>
                    <span className="text-gray-400 font-semibold px-0.5" aria-hidden>
                      ·
                    </span>
                    <span>{paidCount} paid</span>
                  </span>
                )}
                {eventFunction.location && !isSell && (
                  <span className="bg-gray-100 text-gray-600 font-bold text-sm px-3 py-1.5 rounded-full flex items-center gap-1.5">
                    <MapPin size={14} /> {eventFunction.location}
                  </span>
                )}
                {eventFunction.max_capacity && !isSell && (
                  <span className="bg-gray-100 text-gray-600 font-bold text-sm px-3 py-1.5 rounded-full flex items-center gap-1.5">
                    <Sparkles size={14} /> {eventFunction.max_capacity} max
                  </span>
                )}
              </div>

              <div className="pt-1 border-t border-gray-100">
                <div className="flex items-center justify-between gap-2 mt-3">
                  <div className="text-xs text-gray-400 flex items-center gap-1.5">
                    <CalendarDays size={13} /> {isSell ? "Available now" : formatEventDate(eventFunction.date)}
                  </div>

                  <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void shareFunction(eventFunction)}
                    className="w-11 h-11 rounded-xl border border-gray-200 bg-white text-gray-700 flex items-center justify-center hover:bg-gray-50 transition-colors"
                    aria-label={`Share ${eventFunction.title}`}
                    title="Share"
                  >
                    <Share2 size={16} />
                  </button>
                    <button
                      type="button"
                      onClick={() => onOpenFunctionThread(eventFunction)}
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
                        type="button"
                        onClick={() => onJoinFunction(eventFunction)}
                        className="px-4 py-2 bg-black text-white rounded-xl font-bold text-sm hover:bg-gray-800 transition-colors"
                      >
                        {isSell ? "Pay & buy" : "Pay & join"}
                      </button>
                    ) : canJoin ? (
                      <button
                        type="button"
                        onClick={() => onJoinFunction(eventFunction)}
                        className="px-4 py-2 bg-black text-white rounded-xl font-bold text-sm hover:bg-gray-800 transition-colors"
                      >
                        {isSell ? "Purchase" : "Join Function"}
                      </button>
                    ) : (
                      <span className="text-sm font-semibold text-gray-500">{isFull ? "Full" : "Joined"}</span>
                    )}
                  </div>
                </div>

                {isMember && me?.has_paid && !isHost && (
                  <button
                    type="button"
                    onClick={() => onOpenTicket(eventFunction)}
                    className="mt-3 w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl border border-green-200 bg-green-50 text-green-800 font-bold text-sm hover:bg-green-100 transition-colors tap-scale"
                  >
                    <Ticket size={16} aria-hidden />
                    {isSell ? "Show proof" : "Show ticket"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
