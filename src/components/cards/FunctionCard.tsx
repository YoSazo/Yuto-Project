import UserAvatar from "../UserAvatar";
import {
  BadgeDollarSign,
  Briefcase,
  CalendarDays,
  MapPin,
  MessageCircle,
  Plane,
  Share2,
  Sparkles,
  Store,
  Ticket,
  Users,
} from "lucide-react";
import { formatEventDate, type FunctionListing } from "../../pages/home/types";
import type { DmSharePayload } from "../../lib/supabase";

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

export function FunctionCard({
  eventFunction,
  currentUserId,
  unreadCount,
  onNavigateToHost,
  onOpenFunctionThread,
  onJoinFunction,
  onOpenTicket,
  onOpenPeople,
  onShareInMessages,
}: {
  eventFunction: FunctionListing;
  currentUserId?: string;
  unreadCount?: number;
  onNavigateToHost: (hostUserId: string) => void;
  onOpenFunctionThread?: (f: FunctionListing) => void;
  onJoinFunction?: (f: FunctionListing) => void;
  onOpenTicket?: (f: FunctionListing) => void;
  onOpenPeople?: (functionId: string, title: string) => void;
  onShareInMessages?: (payload: DmSharePayload) => void;
}) {
  const fm = eventFunction.function_members ?? [];
  const isHost = eventFunction.host_id === currentUserId;
  const isMember = fm.some((m) => m.user_id === currentUserId);
  const me = fm.find((m) => m.user_id === currentUserId);
  const paidCount = fm.filter((m) => m.has_paid).length;
  const joinedCount = fm.length;
  const isFull = eventFunction.max_capacity ? joinedCount >= eventFunction.max_capacity && !isMember : false;
  const canJoin = !isHost && !isMember && !isFull;
  const canPay = isMember && !me?.has_paid;
  const uc = unreadCount || 0;
  const isSell = eventFunction.location === "__SELL__";
  const isService = eventFunction.location === "__SERVICE__";
  const isListing = isSell || isService;
  const isFunction = !isListing;
  const remainingStock =
    isListing && eventFunction.max_capacity != null ? Math.max(0, eventFunction.max_capacity - paidCount) : null;
  const fulfillment = isListing ? extractFulfillmentLine(eventFunction.description) : null;
  const cleanedDescription = isListing ? stripFulfillmentFromDescription(eventFunction.description) : eventFunction.description;

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
      // fall back
    }
    try {
      await navigator.clipboard.writeText(url);
      alert("Link copied!");
    } catch {
      alert(url);
    }
  };

  return (
    <div
      id={`function-${eventFunction.id}`}
      className={[
        "rounded-3xl p-4 relative overflow-hidden",
        isFunction
          ? "bg-black border border-black text-white"
          : "bg-white border border-gray-200/80 text-black premium-function-card function-card-highlight",
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
          <p className={["font-semibold text-sm", isFunction ? "text-white" : "text-black"].join(" ")}>
            {isSell
              ? `${eventFunction.host.display_name} has something for you`
              : isService
                ? `${eventFunction.host.display_name} is offering a service`
                : `${eventFunction.host.display_name} is hosting a function`}
          </p>
          {!isListing && (
            <p className={["text-xs", isFunction ? "text-white/70" : "text-gray-400"].join(" ")}>
              {formatEventDate(eventFunction.date)}
            </p>
          )}
        </div>
        <span
          className={[
            "text-[11px] font-semibold px-2.5 py-1 rounded-full uppercase tracking-wide inline-flex items-center gap-1.5",
            isSell
              ? "bg-emerald-50 text-emerald-700"
              : isService
                ? "bg-blue-50 text-blue-700"
                : isFunction
                  ? "bg-white/12 text-white"
                  : "bg-black text-white",
          ].join(" ")}
        >
          {isSell ? <Store size={12} aria-hidden /> : isService ? <Briefcase size={12} aria-hidden /> : null}
          {isSell ? "Sell" : isService ? "Services" : "Function"}
        </span>
      </div>

      <p className={["font-bold text-lg mb-1", isFunction ? "text-white" : "text-black"].join(" ")}>{eventFunction.title}</p>
      {eventFunction.image_url && (
        <div className="mb-3 rounded-xl overflow-hidden bg-gray-100">
          <img src={eventFunction.image_url} alt="Function cover" className="block w-full h-auto" />
        </div>
      )}
      {cleanedDescription && (
        <p className={["text-sm mb-3", isFunction ? "text-white/80" : "text-gray-600"].join(" ")}>{cleanedDescription}</p>
      )}

      {isListing && fulfillment && (
        <div className="mb-3">
          <span className="w-full bg-green-50 text-green-800 font-bold text-sm px-3 py-2 rounded-full inline-flex items-center justify-center border border-green-200">
            {fulfillment}
          </span>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-4">
        <span
          className={[
            "font-bold text-sm px-3 py-1.5 rounded-full flex items-center gap-1.5 border",
            isFunction ? "bg-white text-black border-white/20" : "bg-orange-50 text-orange-700 border-transparent",
          ].join(" ")}
        >
          <BadgeDollarSign size={14} /> KSH {eventFunction.amount_per_person.toLocaleString()}
        </span>
        {isListing ? (
          <>
            {remainingStock != null && (
              <span className="bg-gray-100 text-gray-600 font-bold text-sm px-3 py-1.5 rounded-full flex items-center gap-1.5">
                <Sparkles size={14} /> {remainingStock} {isService ? "spots left" : "left"}
              </span>
            )}
            {paidCount > 0 && (
              <span className="bg-gray-100 text-gray-600 font-bold text-sm px-3 py-1.5 rounded-full flex items-center gap-1.5">
                <Users size={14} /> {paidCount} {isSell ? "bought" : "booked"}
              </span>
            )}
          </>
        ) : (
          <button
            type="button"
            onClick={() => onOpenPeople?.(eventFunction.id, `${joinedCount} going`)}
            className={[
              "font-bold text-sm px-3 py-1.5 rounded-full inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5 border",
              isFunction ? "bg-white/12 text-white/90 border-white/15" : "bg-gray-100 text-gray-600 border-transparent",
            ].join(" ")}
          >
            <span className="inline-flex items-center gap-1.5">
              <Users size={14} /> {joinedCount} joining
            </span>
            <span className={["font-semibold px-0.5", isFunction ? "text-white/40" : "text-gray-400"].join(" ")} aria-hidden>
              ·
            </span>
            <span>{paidCount} paid</span>
          </button>
        )}
        {eventFunction.location && !isSell && !isService && (
          <span
            className={[
              "font-bold text-sm px-3 py-1.5 rounded-full flex items-center gap-1.5 border",
              isFunction ? "bg-white/12 text-white/90 border-white/15" : "bg-gray-100 text-gray-600 border-transparent",
            ].join(" ")}
          >
            <MapPin size={14} /> {eventFunction.location}
          </span>
        )}
        {eventFunction.max_capacity && !isSell && (
          <span
            className={[
              "font-bold text-sm px-3 py-1.5 rounded-full flex items-center gap-1.5 border",
              isFunction ? "bg-white/12 text-white/90 border-white/15" : "bg-gray-100 text-gray-600 border-transparent",
            ].join(" ")}
          >
            <Sparkles size={14} /> {eventFunction.max_capacity} max
          </span>
        )}
      </div>

      <div className={["pt-1 border-t", isFunction ? "border-white/10" : "border-gray-100"].join(" ")}>
        <div className="flex items-center justify-between gap-2 mt-3">
          <div className={["text-xs flex items-center gap-1.5", isFunction ? "text-white/65" : "text-gray-400"].join(" ")}>
            <CalendarDays size={13} /> {isListing ? "Available now" : formatEventDate(eventFunction.date)}
          </div>

          <div className="flex items-center gap-2">
            {onShareInMessages && (
              <button
                type="button"
                onClick={() =>
                  onShareInMessages(
                    isSell
                      ? { kind: "listing", function_id: eventFunction.id, listing_kind: "sell" }
                      : isService
                        ? { kind: "listing", function_id: eventFunction.id, listing_kind: "service" }
                        : { kind: "function", function_id: eventFunction.id },
                  )
                }
                className={[
                  "w-11 h-11 rounded-xl border flex items-center justify-center transition-colors",
                  isFunction ? "border-white/15 bg-white/12 text-white hover:bg-white/18" : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50",
                ].join(" ")}
                aria-label={`Send ${eventFunction.title} in messages`}
                title="Share in messages"
              >
                <Plane size={16} />
              </button>
            )}
            <button
              type="button"
              onClick={() => void shareFunction(eventFunction)}
              className={[
                "w-11 h-11 rounded-xl border flex items-center justify-center transition-colors",
                isFunction ? "border-white/15 bg-white/12 text-white hover:bg-white/18" : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50",
              ].join(" ")}
              aria-label={`Copy or share ${eventFunction.title} link`}
              title="Share link"
            >
              <Share2 size={16} />
            </button>

            {onOpenFunctionThread && (
              <button
                type="button"
                onClick={() => onOpenFunctionThread(eventFunction)}
                className={[
                  "relative w-11 h-11 rounded-xl border flex items-center justify-center transition-colors",
                  isFunction ? "border-white/15 bg-white/12 text-white hover:bg-white/18" : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50",
                ].join(" ")}
                aria-label={`Ask questions about ${eventFunction.title}`}
                title="Ask questions"
              >
                <MessageCircle size={16} />
                {uc > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center shadow-sm">
                    {uc}
                  </span>
                )}
              </button>
            )}

            {isHost ? (
              <span className={["text-sm font-semibold", isFunction ? "text-white/65" : "text-gray-500"].join(" ")}>Hosting</span>
            ) : isMember && me?.has_paid ? (
              <span className={["text-sm font-semibold", isFunction ? "text-emerald-300" : "text-green-600"].join(" ")}>You&apos;re in</span>
            ) : canPay ? (
              <button
                type="button"
                onClick={() => onJoinFunction?.(eventFunction)}
                className={[
                  "px-4 py-2 rounded-xl font-bold text-sm transition-colors",
                  isFunction ? "bg-white text-black hover:bg-white/90" : "bg-black text-white hover:bg-gray-800",
                ].join(" ")}
              >
                {isSell ? "Pay & buy" : isService ? "Pay & book" : "Pay & join"}
              </button>
            ) : canJoin ? (
              <button
                type="button"
                onClick={() => onJoinFunction?.(eventFunction)}
                className={[
                  "px-4 py-2 rounded-xl font-bold text-sm transition-colors",
                  isFunction ? "bg-white text-black hover:bg-white/90" : "bg-black text-white hover:bg-gray-800",
                ].join(" ")}
              >
                {isSell ? "Purchase" : isService ? "Book" : "Join Function"}
              </button>
            ) : (
              <span className={["text-sm font-semibold", isFunction ? "text-white/65" : "text-gray-500"].join(" ")}>
                {isFull ? "Full" : "Joined"}
              </span>
            )}
          </div>
        </div>

        {isMember && me?.has_paid && !isHost && onOpenTicket && (
          <button
            type="button"
            onClick={() => onOpenTicket(eventFunction)}
            className={[
              "mt-3 w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl font-bold text-sm transition-colors tap-scale border",
              isFunction ? "border-white/15 bg-white/12 text-white hover:bg-white/18" : "border-green-200 bg-green-50 text-green-800 hover:bg-green-100",
            ].join(" ")}
          >
            <Ticket size={16} aria-hidden />
            {isSell ? "Show proof" : isService ? "Show proof" : "Show ticket"}
          </button>
        )}
      </div>
    </div>
  );
}

