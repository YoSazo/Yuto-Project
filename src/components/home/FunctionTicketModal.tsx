import { useEffect, useState } from "react";
import { Ticket } from "lucide-react";
import { formatEventDate, type FunctionListing } from "../../pages/home/types";

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
}: {
  functionItem: FunctionListing;
  attendeeDisplayName: string;
  userId: string;
  onClose: () => void;
}) {
  const [tick, setTick] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setTick(Date.now()), 1500);
    return () => clearInterval(id);
  }, []);

  const windowIdx = Math.floor(tick / WINDOW_MS);
  const code = liveEntryCode(`${functionItem.id}:${userId}`, windowIdx);
  const nextRefreshMs = WINDOW_MS - (tick % WINDOW_MS);

  const me = (functionItem.function_members ?? []).find((m) => m.user_id === userId);

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
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">Yuto entry</p>
                  <p className="font-bold text-lg text-black leading-tight">Function ticket</p>
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
                Hosted by <span className="font-semibold text-gray-800">{functionItem.host.display_name}</span>
              </p>
              <div className="relative flex flex-wrap gap-2 mt-3 text-xs text-gray-600">
                <span className="px-2.5 py-1 rounded-full bg-white border border-gray-200 font-semibold">
                  {formatEventDate(functionItem.date)}
                </span>
                <span className="px-2.5 py-1 rounded-full bg-white border border-gray-200 font-semibold">
                  KSH {functionItem.amount_per_person.toLocaleString()}
                </span>
                {functionItem.location ? (
                  <span className="px-2.5 py-1 rounded-full bg-white border border-gray-200 font-semibold truncate max-w-full">
                    {functionItem.location}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="text-center mb-1">
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Guest</p>
              <p className="font-bold text-2xl text-black tracking-tight">{attendeeDisplayName}</p>
              {me?.joined_at ? (
                <p className="text-[11px] text-gray-400 mt-1">Confirmed {new Date(me.joined_at).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}</p>
              ) : null}
            </div>

            <div className="relative mt-5 py-5 px-4 rounded-2xl bg-black text-white overflow-hidden">
              <div className="absolute inset-0 ticket-code-pulse opacity-40 pointer-events-none" aria-hidden />
              <p className="relative text-[10px] uppercase tracking-[0.25em] text-white/70 text-center mb-2">Live check-in code</p>
              <p className="relative text-4xl font-black tracking-[0.2em] text-center font-mono tabular-nums" key={windowIdx}>
                {code}
              </p>
              <p className="relative text-[11px] text-white/50 text-center mt-2">
                Refreshes in ~{Math.ceil(nextRefreshMs / 1000)}s · Animated ticket is harder to fake with a screenshot
              </p>
            </div>

            <p className="text-[11px] text-gray-400 text-center mt-5 leading-snug px-2">
              Show this live screen at check-in. The border, shimmer, and code keep moving — a still image won&apos;t match.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
