import { useMemo, useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import UserAvatar from "../UserAvatar";

export type RosterMember = {
  user_id: string;
  name: string;
  avatar_url: string | null;
  paid: boolean;
};

/**
 * Pinned header strip that surfaces the "who's in / who's paid" state
 * directly inside chat surfaces (plan + function chats).
 *
 * Two modes:
 *  - "split": hard money state. Shows X of Y paid, KSH left, dims/badges
 *    unpaid members so the chat itself becomes the social pressure.
 *  - "rsvp":  pre-money state (e.g. plan not yet locked in). Shows joined
 *    count vs slots, no payment indicators.
 *
 * Tap to expand a sorted list (unpaid first in split mode) so holdouts
 * are visible by name, not just by number.
 */
export function RosterStrip({
  mode,
  members,
  perPersonKes,
  slots,
  currentUserId,
  hostUserId,
}: {
  mode: "split" | "rsvp";
  members: RosterMember[];
  perPersonKes?: number | null;
  slots?: number | null;
  currentUserId?: string;
  hostUserId?: string | null;
}) {
  const [expanded, setExpanded] = useState(false);

  const total = members.length;
  const paidCount = useMemo(() => members.filter((m) => m.paid).length, [members]);
  const unpaidCount = total - paidCount;
  const remainingKes = perPersonKes ? unpaidCount * perPersonKes : null;

  // Unpaid first so holdouts are loud; current user gets pulled to top of paid for clarity.
  const sorted = useMemo(() => {
    if (mode !== "split") return members;
    return [...members].sort((a, b) => {
      if (a.paid !== b.paid) return a.paid ? 1 : -1;
      if (a.user_id === currentUserId) return -1;
      if (b.user_id === currentUserId) return 1;
      return 0;
    });
  }, [members, mode, currentUserId]);

  if (total === 0) return null;

  const headerLine =
    mode === "split"
      ? `${paidCount} of ${total} paid${remainingKes !== null && remainingKes > 0 ? ` · KSH ${remainingKes.toLocaleString()} left` : ""}`
      : `${total} joined${slots ? ` · ${Math.max(0, slots - total)} spot${slots - total === 1 ? "" : "s"} left` : ""}`;

  return (
    <div className="border-b border-gray-100 bg-gradient-to-b from-white to-gray-50/50">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full px-4 py-3 flex items-center gap-3 bg-transparent border-none text-left"
      >
        <div className="flex -space-x-2 shrink-0">
          {sorted.slice(0, 5).map((m) => (
            <div key={m.user_id} className="relative">
              <div
                className={[
                  "rounded-full ring-2 ring-white",
                  mode === "split" && !m.paid ? "opacity-50" : "opacity-100",
                ].join(" ")}
              >
                <UserAvatar name={m.name} avatarUrl={m.avatar_url} size="sm" />
              </div>
              {mode === "split" && m.paid && (
                <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-green-500 ring-2 ring-white flex items-center justify-center">
                  <Check size={8} strokeWidth={4} className="text-white" />
                </span>
              )}
            </div>
          ))}
          {total > 5 && (
            <div className="w-9 h-9 rounded-full bg-gray-100 ring-2 ring-white flex items-center justify-center text-xs font-extrabold text-gray-500">
              +{total - 5}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-extrabold text-sm text-black truncate">{headerLine}</p>
          {mode === "split" && unpaidCount > 0 && (
            <p className="text-xs text-gray-400 truncate">
              Waiting on{" "}
              {sorted
                .filter((m) => !m.paid)
                .slice(0, 3)
                .map((m) => (m.user_id === currentUserId ? "you" : m.name.split(" ")[0]))
                .join(", ")}
              {unpaidCount > 3 ? ` +${unpaidCount - 3}` : ""}
            </p>
          )}
          {mode === "split" && unpaidCount === 0 && (
            <p className="text-xs text-green-600 font-bold truncate">Everyone's paid</p>
          )}
        </div>
        <ChevronDown
          size={16}
          className={[
            "shrink-0 text-gray-400 transition-transform",
            expanded ? "rotate-180" : "rotate-0",
          ].join(" ")}
        />
      </button>

      {expanded && (
        <div className="px-4 pb-3 max-h-56 overflow-y-auto">
          <ul className="flex flex-col divide-y divide-gray-100">
            {sorted.map((m) => {
              const isHost = hostUserId && m.user_id === hostUserId;
              const isMe = currentUserId && m.user_id === currentUserId;
              return (
                <li key={m.user_id} className="py-2 flex items-center gap-3">
                  <UserAvatar name={m.name} avatarUrl={m.avatar_url} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-black truncate">
                      {isMe ? "You" : m.name}
                      {isHost ? <span className="ml-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Host</span> : null}
                    </p>
                  </div>
                  {mode === "split" ? (
                    m.paid ? (
                      <span className="text-[11px] font-extrabold text-green-600 bg-green-50 px-2 py-1 rounded-full">
                        Paid
                      </span>
                    ) : (
                      <span className="text-[11px] font-extrabold text-amber-700 bg-amber-50 px-2 py-1 rounded-full">
                        Unpaid
                      </span>
                    )
                  ) : (
                    <span className="text-[11px] font-extrabold text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                      In
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
