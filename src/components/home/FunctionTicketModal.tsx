import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MessageCircle, Send, Store, Ticket } from "lucide-react";
import { formatEventDate, type FunctionListing } from "../../pages/home/types";
import UserAvatar from "../UserAvatar";
import { confirmListingReceipt, ensureFunctionAttendeeChat } from "../../lib/supabase";

function extractFulfillmentLine(description: string | null): string | null {
  if (!description) return null;
  const m = description.match(/(?:^|\n)\s*Fulfillment:\s*(.+)\s*$/i);
  return m?.[1]?.trim() ? m[1].trim() : null;
}

function liveEntryCode(seed: string, windowIdx: number): string {
  const s = `${seed}:${windowIdx}`;
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return String(100000 + (h % 900000));
}

const WINDOW_MS = 12_000;

export function FunctionTicketModal({
  functionItem,
  attendeeDisplayName,
  userId,
  onClose,
  showGroupBuy,
  groupBuyFriends,
  groupBuySelectedIds,
  onToggleGroupBuyFriend,
  onBuyForGroupAndSplit,
  groupBuyBusy,
  groupBuyError,
}: {
  functionItem: FunctionListing;
  attendeeDisplayName: string;
  userId: string;
  onClose: () => void;
  showGroupBuy?: boolean;
  groupBuyFriends?: { id: string; username: string; display_name: string; avatar_url: string | null }[];
  groupBuySelectedIds?: string[];
  onToggleGroupBuyFriend?: (friendUserId: string) => void;
  onBuyForGroupAndSplit?: () => void;
  groupBuyBusy?: boolean;
  groupBuyError?: string;
}) {
  const navigate = useNavigate();
  const [tick, setTick] = useState(() => Date.now());
  const [joiningChat, setJoiningChat] = useState(false);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => setTick(Date.now()), 1500);
    return () => clearInterval(id);
  }, []);

  const windowIdx = Math.floor(tick / WINDOW_MS);
  const code = liveEntryCode(`${functionItem.id}:${userId}`, windowIdx);
  const nextRefreshMs = WINDOW_MS - (tick % WINDOW_MS);

  const me = (functionItem.function_members ?? []).find((m) => m.user_id === userId);
  const isSell = functionItem.location === "__SELL__";
  const isService = functionItem.location === "__SERVICE__";
  const isListing = isSell || isService;
  const intentLabel = isListing ? "Proof" : "Ticket";
  const fulfillment = isListing ? extractFulfillmentLine(functionItem.description) : null;
  const buyerConfirmedAt = (me as any)?.buyer_confirmed_at as string | null | undefined;
  const shareUrl = useMemo(() => {
    const shareOrigin =
      window.location.hostname === "localhost" || window.location.hostname.startsWith("127.")
        ? window.location.origin
        : "https://yuto.social";
    return `${shareOrigin}/function/${functionItem.id}`;
  }, [functionItem.id]);

  return (
    <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center fade-in bg-black/70 backdrop-blur-sm">
      <button type="button" className="absolute inset-0 cursor-default border-none bg-transparent" aria-label="Dismiss" onClick={onClose} />
      <div className="relative w-full max-w-md mx-4 mb-6 md:mb-0 ticket-live-ring rounded-[22px] shadow-2xl max-h-[90vh] overflow-visible">
        <div className="relative rounded-[20px] bg-white overflow-hidden m-[3px]">
          <div className="ticket-scanlines pointer-events-none absolute inset-0 z-[1]" aria-hidden />
          <div className="ticket-watermark pointer-events-none absolute inset-0 z-[1] overflow-hidden" aria-hidden>
            <span className="ticket-watermark-text font-black text-black select-none">
              {attendeeDisplayName.slice(0, 12).toUpperCase() || "GUEST"}
            </span>
          </div>

          <div className="relative z-10 p-6">
            <div className="flex justify-between items-start gap-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center">
                  <Ticket size={20} strokeWidth={2.5} />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">
                    {isSell ? "Yuto purchase" : isService ? "Yuto booking" : "Yuto entry"}
                  </p>
                  <p className="font-bold text-lg text-black leading-tight">
                    {isSell ? "Proof of purchase" : isService ? "Proof of booking" : "Function ticket"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="text-2xl text-gray-400 hover:text-black bg-transparent border-none shrink-0"
              >
                ✕
              </button>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-gray-50/90 px-4 py-4 mb-4 overflow-hidden relative">
              <div className="ticket-inner-shimmer absolute inset-0 pointer-events-none" aria-hidden />
              <p className="relative font-bold text-black text-xl leading-snug">{functionItem.title}</p>
              <p className="relative text-sm text-gray-500 mt-2">
                {isSell ? (
                  <>
                    Sold by{" "}
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        navigate(`/user/${functionItem.host.id}`);
                      }}
                      className="font-semibold text-gray-800 underline underline-offset-2"
                    >
                      {functionItem.host.display_name}
                    </button>
                  </>
                ) : isService ? (
                  <>
                    Provided by{" "}
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        navigate(`/user/${functionItem.host.id}`);
                      }}
                      className="font-semibold text-gray-800 underline underline-offset-2"
                    >
                      {functionItem.host.display_name}
                    </button>
                  </>
                ) : (
                  <>
                    Hosted by{" "}
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        navigate(`/user/${functionItem.host.id}`);
                      }}
                      className="font-semibold text-gray-800 underline underline-offset-2"
                    >
                      {functionItem.host.display_name}
                    </button>
                  </>
                )}
              </p>
              {fulfillment && (
                <p className="relative text-sm text-gray-600 mt-2">
                  <span className="font-semibold text-gray-800">
                    {isService ? "Contact / booking:" : "Pickup / contact:"}
                  </span>{" "}
                  {fulfillment}
                </p>
              )}
              <div className="relative flex flex-wrap gap-2 mt-3 text-xs text-gray-600">
                {!isListing && (
                  <span className="px-2.5 py-1 rounded-full bg-white border border-gray-200 font-semibold">
                    {formatEventDate(functionItem.date)}
                  </span>
                )}
                <span className="px-2.5 py-1 rounded-full bg-white border border-gray-200 font-semibold">
                  KSH {functionItem.amount_per_person.toLocaleString()}
                </span>
                {functionItem.location && !isSell ? (
                  <span className="px-2.5 py-1 rounded-full bg-white border border-gray-200 font-semibold truncate max-w-full">
                    {functionItem.location}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="text-center mb-1">
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">
                {isSell ? "Buyer" : isService ? "Client" : "Guest"}
              </p>
              <p className="font-bold text-2xl text-black tracking-tight">{attendeeDisplayName}</p>
              {me?.joined_at ? (
                <p className="text-[11px] text-gray-400 mt-1">Confirmed {new Date(me.joined_at).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}</p>
              ) : null}
            </div>

            <div className="relative mt-5 py-5 px-4 rounded-2xl bg-black text-white overflow-hidden">
              <div className="absolute inset-0 ticket-code-pulse opacity-40 pointer-events-none" aria-hidden />
              <p className="relative text-[10px] uppercase tracking-[0.25em] text-white/70 text-center mb-2">
                Live {intentLabel} code
              </p>
              <p className="relative text-4xl font-black tracking-[0.2em] text-center font-mono tabular-nums" key={windowIdx}>
                {code}
              </p>
              <p className="relative text-[11px] text-white/50 text-center mt-2">
                Refreshes in ~{Math.ceil(nextRefreshMs / 1000)}s · Animated {intentLabel.toLowerCase()} is harder to fake with a screenshot
              </p>
            </div>

            {!isListing && me?.has_paid && (
              <button
                type="button"
                disabled={sharing}
                onClick={async () => {
                  setSharing(true);
                  const title = `🎟️ I just got my ticket to ${functionItem.title}`;
                  const text = `Grab yours here: ${shareUrl}`;
                  try {
                    if (navigator.share) {
                      await navigator.share({ title, text, url: shareUrl });
                      return;
                    }
                  } catch {
                    // fall back
                  } finally {
                    setSharing(false);
                  }
                  try {
                    await navigator.clipboard.writeText(shareUrl);
                    alert("Link copied!");
                  } catch {
                    alert(shareUrl);
                  } finally {
                    setSharing(false);
                  }
                }}
                className="w-full mt-4 py-3.5 bg-black text-white rounded-2xl font-extrabold text-sm flex items-center justify-center gap-2 tap-scale disabled:opacity-60"
              >
                <Send size={16} />
                {sharing ? "Preparing..." : "Share / Invite Friends"}
              </button>
            )}

            {isListing && me?.has_paid && !buyerConfirmedAt && (
              <button
                type="button"
                onClick={async () => {
                  try {
                    await confirmListingReceipt(functionItem.id, userId);
                    alert("Thanks — marked as received. This unlocks the seller’s payout.");
                    onClose();
                  } catch (e) {
                    console.error(e);
                    alert("Couldn't confirm yet. Try again.");
                  }
                }}
                className="w-full mt-4 py-3.5 bg-black text-white rounded-2xl font-extrabold text-sm tap-scale"
              >
                Confirm receipt
              </button>
            )}

            {isListing && me?.has_paid && (
              <div className="mt-4 rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Want to sell too?</p>
                <p className="text-sm text-gray-700 mt-1 font-semibold">
                  Open your own storefront on Yuto and start getting paid.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    navigate("/profile");
                  }}
                  className="mt-3 w-full h-11 rounded-2xl bg-black hover:bg-gray-800 text-white font-extrabold transition-colors flex items-center justify-center gap-2"
                >
                  <Store size={16} /> Open my Storefront
                </button>
              </div>
            )}

            {!isListing && (
              <button
                type="button"
                onClick={async () => {
                  setJoiningChat(true);
                  try {
                    const gid = await ensureFunctionAttendeeChat(functionItem.id);
                    onClose();
                    navigate(`/messages/group/${gid}`);
                  } catch (e) {
                    console.error(e);
                    alert("Couldn't open chat. Try again.");
                  } finally {
                    setJoiningChat(false);
                  }
                }}
                disabled={joiningChat}
                className="w-full mt-4 py-3.5 bg-gray-100 text-black rounded-2xl font-bold text-sm flex items-center justify-center gap-2 tap-scale disabled:opacity-50"
              >
                <MessageCircle size={16} />
                {joiningChat ? "Opening Chat..." : "Enter Event Chat"}
              </button>
            )}

            {showGroupBuy && (
              <div className="mt-5 pt-4 border-t border-gray-100 space-y-3 text-left">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">Buy for group &amp; split</p>
                <p className="text-xs text-gray-500 leading-snug">
                  Pay for friends who don&apos;t have a ticket yet, then start a Yuto split and group chat with the same people.
                </p>
                {groupBuyFriends && groupBuyFriends.length > 0 ? (
                  <>
                    <div className="flex flex-wrap gap-2">
                      {groupBuyFriends.map((f) => {
                        const sel = groupBuySelectedIds?.includes(f.id);
                        return (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => onToggleGroupBuyFriend?.(f.id)}
                            disabled={groupBuyBusy}
                            className={`flex items-center gap-2 px-3 py-2 rounded-full border-2 text-sm font-semibold transition-all ${
                              sel ? "bg-black border-black text-white" : "bg-white border-gray-200 text-black"
                            } disabled:opacity-50`}
                          >
                            <UserAvatar name={f.display_name} avatarUrl={f.avatar_url} size="sm" className={sel ? "ring-2 ring-white" : ""} />
                            <span className="truncate max-w-[140px]">{f.display_name}</span>
                          </button>
                        );
                      })}
                    </div>
                    {groupBuyError ? <p className="text-xs text-red-500 font-semibold">{groupBuyError}</p> : null}
                    <button
                      type="button"
                      disabled={groupBuyBusy || !(groupBuySelectedIds && groupBuySelectedIds.length > 0)}
                      onClick={() => onBuyForGroupAndSplit?.()}
                      className="w-full py-3.5 rounded-2xl font-bold text-white bg-gray-900 disabled:bg-gray-200 disabled:text-gray-400 tap-scale"
                    >
                      {groupBuyBusy ? "Working…" : "Pay & create split + chat"}
                    </button>
                  </>
                ) : (
                  <p className="text-xs text-gray-400">Add friends on Yuto to cover their tickets from here.</p>
                )}
              </div>
            )}

            <p className="text-[11px] text-gray-400 text-center mt-5 leading-snug px-2">
              Show this live screen. The border, shimmer, and code keep moving — a still image won&apos;t match.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
