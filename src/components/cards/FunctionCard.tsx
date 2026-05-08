import UserAvatar from "../UserAvatar";
import {
  BadgeDollarSign,
  Briefcase,
  CalendarDays,
  Copy,
  MapPin,
  MessageCircle,
  Send,
  Share2,
  Sparkles,
  Store,
  Ticket,
  Users,
} from "lucide-react";
import { formatEventDate, type FunctionListing } from "../../pages/home/types";
import type { DmSharePayload } from "../../lib/supabase";
import { FixedMediaCarousel } from "../media/FixedMediaCarousel";
import { toast } from "sonner";

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
  onOpenFunctionAttendeeChat,
  onJoinFunction,
  onOpenTicket,
  onOpenPeople,
  onShareInMessages,
  onDuplicate,
  suppressListingPay,
  onMessageListing,
}: {
  eventFunction: FunctionListing;
  currentUserId?: string;
  unreadCount?: number;
  onNavigateToHost: (hostUserId: string) => void;
  onOpenFunctionThread?: (f: FunctionListing) => void;
  onOpenFunctionAttendeeChat?: (f: FunctionListing) => void;
  onJoinFunction?: (f: FunctionListing) => void;
  onOpenTicket?: (f: FunctionListing) => void;
  onOpenPeople?: (functionId: string, title: string) => void;
  onShareInMessages?: (payload: DmSharePayload) => void;
  /** Host-only: re-run this function next week with a fresh roster. */
  onDuplicate?: (f: FunctionListing) => void;
  /** When true, listing cards hide Buy/Pay (e.g. embedded inside an existing DM). */
  suppressListingPay?: boolean;
  /** Listing (sell/service) primary CTA: open DM — used on home / profile instead of instant pay. */
  onMessageListing?: (f: FunctionListing) => void;
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
      toast.success("Link copied!");
    } catch {
      toast.error("Couldn't copy link.");
    }
  };

  return (
    <div
      id={`function-${eventFunction.id}`}
      className={[
        "w-full rounded-3xl p-4 relative overflow-hidden",
        isFunction
          ? "bg-black border border-black text-white"
          : "bg-white border border-gray-200/80 text-black premium-function-card function-card-highlight",
      ].join(" ")}
    >
      <div className="flex items-start gap-2 mb-3 cursor-pointer hover:opacity-80 transition-opacity"
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
          {isFunction && (
            <p className={["font-semibold text-sm", isFunction ? "text-white" : "text-black"].join(" ")}>
              {`${eventFunction.host.display_name} is hosting a function`}
            </p>
          )}
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

      <div className="flex items-start justify-between gap-3 mb-1">
        <p 
          className={`font-bold text-lg flex-1 min-w-0 ${isFunction ? "text-white" : "text-black"} ${
            (isListing && eventFunction.listing_status && eventFunction.listing_status !== "active") || 
            (isFunction && (eventFunction as any).status === "cancelled") 
              ? "opacity-60 line-through" 
              : ""
          }`}
        >
          {eventFunction.title}
        </p>
        {onShareInMessages && (
          <button
            type="button"
            onClick={() => {
              const payload = isSell 
                ? { kind: "listing" as const, function_id: eventFunction.id, listing_kind: "sell" as const }
                : isService 
                  ? { kind: "listing" as const, function_id: eventFunction.id, listing_kind: "service" as const }
                  : { kind: "function" as const, function_id: eventFunction.id };
              
              onShareInMessages(payload);
            }}
            className={[
              "shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-colors tap-scale border",
              isFunction
                ? "border-white/20 bg-white/10 text-white hover:bg-white/15"
                : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50 shadow-sm",
            ].join(" ")}
            aria-label={`Send ${eventFunction.title} in messages`}
            title="Share in messages"
          >
            <Send size={15} strokeWidth={2} />
          </button>
        )}
      </div>
      {(() => {
        const media = (eventFunction.media || [])
          .slice()
          .sort((a, b) => (a.sort_index ?? 0) - (b.sort_index ?? 0))
          .map((m) => ({
            url: m.media_url,
            type: String(m.media_type || "").startsWith("video") ? ("video" as const) : ("image" as const),
          }));
        const fallback = eventFunction.image_url ? [{ url: eventFunction.image_url, type: "image" as const }] : [];
        const items = media.length > 0 ? media : fallback;
        if (items.length === 0) return null;
        return (
          <div className="mb-3 rounded-xl overflow-hidden bg-gray-100 relative">
            <FixedMediaCarousel items={items} />
            {isListing && eventFunction.listing_status && eventFunction.listing_status !== "active" && (
              <div className="absolute inset-0 bg-black/50 z-10 flex items-center justify-center backdrop-blur-[2px] pointer-events-none">
                <span className="px-4 py-2 bg-white text-black font-extrabold text-lg uppercase tracking-widest rounded-xl -rotate-6 shadow-sm">
                  {eventFunction.listing_status === "sold" ? "SOLD" : "PAUSED"}
                </span>
              </div>
            )}
            {isFunction && (eventFunction as any).status === "cancelled" && (
              <div className="absolute inset-0 bg-black/60 z-10 flex items-center justify-center backdrop-blur-[2px] pointer-events-none">
                <span className="px-4 py-2 bg-white text-black font-extrabold text-lg uppercase tracking-widest rounded-xl -rotate-6 shadow-sm">
                  CANCELLED
                </span>
              </div>
            )}
          </div>
        );
      })()}
      {cleanedDescription && (
        <p className={["text-sm mb-3", isFunction ? "text-white/80" : "text-gray-600"].join(" ")}>{cleanedDescription}</p>
      )}

      {/* No contact/booking pill on listings (DM flow handles it). */}

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

      {isMember && !me?.has_paid && (
        <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-2xl bg-amber-50 border border-amber-200">
          <span className="text-amber-800 text-xs font-bold">Spot reserved — complete payment to confirm</span>
        </div>
      )}

      <div className={["pt-1 border-t", isFunction ? "border-white/10" : "border-gray-100"].join(" ")}>
        <div className="flex items-center justify-between gap-2 mt-3">
          <div className={["text-xs flex items-center gap-1.5", isFunction ? "text-white/65" : "text-gray-400"].join(" ")}>
            <CalendarDays size={13} /> {isListing ? "Available now" : formatEventDate(eventFunction.date)}
          </div>

          <div className="flex items-center gap-2">
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

            {isFunction && onOpenFunctionThread && (
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

            {isFunction && isMember && me?.has_paid && onOpenFunctionAttendeeChat && (
              <button
                type="button"
                onClick={() => onOpenFunctionAttendeeChat(eventFunction)}
                className={[
                  "w-11 h-11 rounded-xl border flex items-center justify-center transition-colors",
                  "border-green-500/35 bg-green-500/12 text-green-200 hover:bg-green-500/18",
                ].join(" ")}
                aria-label={`Open attendee chat for ${eventFunction.title}`}
                title="Attendee chat"
              >
                <Users size={16} />
              </button>
            )}

            {isHost ? (
              <span className={["text-sm font-semibold", isFunction ? "text-white/65" : "text-gray-500"].join(" ")}>
                Hosting
              </span>
            ) : suppressListingPay && isListing ? (
              <span className={["text-xs font-semibold text-center max-w-[11rem]", isFunction ? "text-white/55" : "text-gray-400"].join(" ")}>
                Pay in chat when ready
              </span>
            ) : isListing && onMessageListing ? (
              <button
                type="button"
                disabled={eventFunction.listing_status === "sold" || eventFunction.listing_status === "paused"}
                onClick={() => onMessageListing(eventFunction)}
                className={[
                  "px-5 py-2.5 rounded-xl font-bold text-sm transition-colors",
                  eventFunction.listing_status && eventFunction.listing_status !== "active"
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200"
                    : isFunction 
                      ? "bg-white text-black hover:bg-white/90" 
                      : "bg-black text-white hover:bg-gray-800",
                ].join(" ")}
              >
                {eventFunction.listing_status === "sold" ? "Sold Out" : eventFunction.listing_status === "paused" ? "Paused" : "Message"}
              </button>
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
                disabled={isFunction && (eventFunction as any).status === "cancelled"}
                onClick={() => onJoinFunction?.(eventFunction)}
                className={[
                  "px-4 py-2 rounded-xl font-bold text-sm transition-colors",
                  isFunction && (eventFunction as any).status === "cancelled"
                    ? "bg-white/10 text-white/40 cursor-not-allowed"
                    : isFunction 
                      ? "bg-white text-black hover:bg-white/90" 
                      : "bg-black text-white hover:bg-gray-800",
                ].join(" ")}
              >
                {isFunction && (eventFunction as any).status === "cancelled" ? "Cancelled" : isSell ? "Purchase" : isService ? "Book" : "Join Function"}
              </button>
            ) : (
              <span className={["text-sm font-semibold", isFunction ? "text-white/65" : "text-gray-500"].join(" ")}>
                {isFunction && (eventFunction as any).status === "cancelled" ? "Cancelled" : isFull ? "Full" : "Joined"}
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

