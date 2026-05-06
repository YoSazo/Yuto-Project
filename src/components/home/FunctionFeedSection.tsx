import UserAvatar from "../UserAvatar";
import { MessageCircle, Users, MapPin, BadgeDollarSign, Sparkles, CalendarDays, Ticket, Share2, Store, Briefcase } from "lucide-react";
import { formatEventDate, type FunctionListing } from "../../pages/home/types";

function extractFulfillmentLine(description: string | null): string | null {
  if (!description) return null;
  const m = description.match(/(?:^|\n)\s*Fulfillment:\s*(.+)\s*$/i);
  return m?.[1]?.trim() ? m[1].trim() : null;
}

function stripFulfillmentFromDescription(description: string | null): string | null {
  if (!description) return null;
  const stripped = description.replace(/(?:^|\n)\s*Fulfillment:\s*.+\s*$/i, "").trim();
  return stripped ? stripped : null;
}

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
          const isService = eventFunction.location === "__SERVICE__";
          const isListing = isSell || isService;
          const remainingStock =
            isListing && eventFunction.max_capacity != null ? Math.max(0, eventFunction.max_capacity - paidCount) : null;
          const fulfillment = isListing ? extractFulfillmentLine(eventFunction.description) : null;
          const cleanedDescription = isListing
            ? stripFulfillmentFromDescription(eventFunction.description)
            : eventFunction.description;

          return (
            <div
              key={eventFunction.id}
              className={[
                "rounded-3xl p-4 relative overflow-hidden",
                isSell
                  ? "bg-emerald-500 border border-emerald-400/40 text-white"
                  : isService
                    ? "bg-[#1D4ED8] border border-blue-400/40 text-white"
                    : "bg-black border border-black text-white",
              ].join(" ")}
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
                  <p className="font-semibold text-sm text-white">
                    {isSell
                      ? `${eventFunction.host.display_name} has something for you`
                      : isService
                        ? `${eventFunction.host.display_name} is offering a service`
                        : `${eventFunction.host.display_name} is hosting a function`}
                  </p>
                  {!isListing && <p className="text-xs text-white/70">{formatEventDate(eventFunction.date)}</p>}
                </div>
                <span
                  className={[
                    "text-[11px] font-semibold px-2.5 py-1 rounded-full uppercase tracking-wide inline-flex items-center gap-1.5",
                    isSell ? "bg-white/15 text-white" : "bg-white/12 text-white",
                  ].join(" ")}
                >
                  {isSell ? <Store size={12} aria-hidden /> : isService ? <Briefcase size={12} aria-hidden /> : null}
                  {isSell ? "Sell" : isService ? "Services" : "Function"}
                </span>
              </div>

              <p className="font-bold text-white text-lg mb-1">{eventFunction.title}</p>
              {eventFunction.image_url && (
                <div className="mb-3 rounded-xl overflow-hidden bg-gray-100">
                  <img src={eventFunction.image_url} alt="Function cover" className="block w-full h-auto" />
                </div>
              )}
              {cleanedDescription && <p className="text-sm text-white/80 mb-3">{cleanedDescription}</p>}

              {isListing && fulfillment && (
                <div className="mb-3">
                  <span className="w-full bg-white/15 text-white font-bold text-sm px-3 py-2 rounded-full inline-flex items-center justify-center border border-white/25">
                    {fulfillment}
                  </span>
                </div>
              )}

              <div className="flex flex-wrap gap-2 mb-4">
                <span
                  className={[
                    "font-bold text-sm px-3 py-1.5 rounded-full flex items-center gap-1.5 border",
                    isSell
                      ? "bg-white text-emerald-700 border-white/30"
                      : isService
                        ? "bg-white text-blue-700 border-white/30"
                        : "bg-white text-black border-white/20",
                  ].join(" ")}
                >
                  <BadgeDollarSign size={14} /> KSH {eventFunction.amount_per_person.toLocaleString()}
                </span>
                {isListing ? (
                  <>
                    {remainingStock != null && (
                      <span className="bg-white/15 text-white font-bold text-sm px-3 py-1.5 rounded-full flex items-center gap-1.5 border border-white/25">
                        <Sparkles size={14} /> {remainingStock} left
                      </span>
                    )}
                    {paidCount > 0 && (
                      <span className="bg-white/15 text-white font-bold text-sm px-3 py-1.5 rounded-full flex items-center gap-1.5 border border-white/25">
                        <Users size={14} /> {paidCount} {isSell ? "bought" : "booked"}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="bg-white/12 text-white/90 font-bold text-sm px-3 py-1.5 rounded-full inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5 border border-white/15">
                    <span className="inline-flex items-center gap-1.5">
                      <Users size={14} /> {joinedCount} joining
                    </span>
                    <span className="text-white/40 font-semibold px-0.5" aria-hidden>
                      ·
                    </span>
                    <span>{paidCount} paid</span>
                  </span>
                )}
                {eventFunction.location && !isSell && (
                  <span className="bg-white/12 text-white/90 font-bold text-sm px-3 py-1.5 rounded-full flex items-center gap-1.5 border border-white/15">
                    <MapPin size={14} /> {eventFunction.location}
                  </span>
                )}
                {eventFunction.max_capacity && !isSell && (
                  <span className="bg-white/12 text-white/90 font-bold text-sm px-3 py-1.5 rounded-full flex items-center gap-1.5 border border-white/15">
                    <Sparkles size={14} /> {eventFunction.max_capacity} max
                  </span>
                )}
              </div>

              <div className={["pt-1 border-t", isListing ? "border-white/20" : "border-white/10"].join(" ")}>
                <div className="flex items-center justify-between gap-2 mt-3">
                  <div className="text-xs text-white/65 flex items-center gap-1.5">
                    <CalendarDays size={13} /> {isListing ? "Available now" : formatEventDate(eventFunction.date)}
                  </div>

                  <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void shareFunction(eventFunction)}
                    className={[
                      "w-11 h-11 rounded-xl border flex items-center justify-center transition-colors",
                      isListing
                        ? "border-white/25 bg-white/15 text-white hover:bg-white/20"
                        : "border-white/15 bg-white/12 text-white hover:bg-white/18",
                    ].join(" ")}
                    aria-label={`Share ${eventFunction.title}`}
                    title="Share"
                  >
                    <Share2 size={16} />
                  </button>
                    <button
                      type="button"
                      onClick={() => onOpenFunctionThread(eventFunction)}
                      className={[
                        "relative w-11 h-11 rounded-xl border flex items-center justify-center transition-colors",
                        isListing
                          ? "border-white/25 bg-white/15 text-white hover:bg-white/20"
                          : "border-white/15 bg-white/12 text-white hover:bg-white/18",
                      ].join(" ")}
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
                      <span className="text-sm font-semibold text-white/65">Hosting</span>
                    ) : isMember && me?.has_paid ? (
                      <span className="text-sm font-semibold text-emerald-300">You&apos;re in</span>
                    ) : canPay ? (
                      <button
                        type="button"
                        onClick={() => onJoinFunction(eventFunction)}
                        className={[
                          "px-4 py-2 rounded-xl font-bold text-sm transition-colors",
                          isSell
                            ? "bg-white text-emerald-700 hover:bg-white/90"
                            : isService
                              ? "bg-white text-blue-700 hover:bg-white/90"
                              : "bg-white text-black hover:bg-white/90",
                        ].join(" ")}
                      >
                        {isSell ? "Pay & buy" : isService ? "Pay & book" : "Pay & join"}
                      </button>
                    ) : canJoin ? (
                      <button
                        type="button"
                        onClick={() => onJoinFunction(eventFunction)}
                        className={[
                          "px-4 py-2 rounded-xl font-bold text-sm transition-colors",
                          isSell
                            ? "bg-white text-emerald-700 hover:bg-white/90"
                            : isService
                              ? "bg-white text-blue-700 hover:bg-white/90"
                              : "bg-white text-black hover:bg-white/90",
                        ].join(" ")}
                      >
                        {isSell ? "Purchase" : isService ? "Book" : "Join Function"}
                      </button>
                    ) : (
                      <span className="text-sm font-semibold text-white/65">{isFull ? "Full" : "Joined"}</span>
                    )}
                  </div>
                </div>

                {isMember && me?.has_paid && !isHost && (
                  <button
                    type="button"
                    onClick={() => onOpenTicket(eventFunction)}
                    className={[
                      "mt-3 w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl font-bold text-sm transition-colors tap-scale border",
                      isListing
                        ? "border-white/25 bg-white/15 text-white hover:bg-white/20"
                        : "border-white/15 bg-white/12 text-white hover:bg-white/18",
                    ].join(" ")}
                  >
                    <Ticket size={16} aria-hidden />
                    {isSell ? "Show proof" : isService ? "Show proof" : "Show ticket"}
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
