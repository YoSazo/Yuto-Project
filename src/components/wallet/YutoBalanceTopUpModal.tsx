import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { haptics } from "../../lib/haptics";
import { analytics } from "../../lib/analytics";

const DEFAULT_PRESETS = [100, 250, 500, 1000] as const;

/**
 * Profile-style top-up: large amount, preset chips, minimal chrome.
 * Polls `/api/status` after STK push so the modal auto-advances when M-PESA confirms.
 */
export function YutoBalanceTopUpModal({
  open,
  onClose,
  userId,
  mpesaPhoneNumber,
  initialAmount = 0,
  title = "Top Up Yuto Balance",
  contextLine,
  minAmount = 20,
  presets = DEFAULT_PRESETS,
  retryCtaLabel = "I've paid — continue",
  onRetryAfterPaid,
}: {
  open: boolean;
  onClose: () => void;
  userId: string;
  mpesaPhoneNumber: string;
  /** When the sheet opens, seed the amount field (e.g. computed gap). */
  initialAmount?: number;
  title?: string;
  /** Single muted line under the header (why they're topping up). */
  contextLine?: string;
  minAmount?: number;
  presets?: readonly number[];
  retryCtaLabel?: string;
  /** If set, after STK succeeds we stay open and offer this action (e.g. retry join). */
  onRetryAfterPaid?: () => void | Promise<void>;
}) {
  const [amountStr, setAmountStr] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [message, setMessage] = useState("");
  const [phase, setPhase] = useState<"form" | "prompt_sent">("form");
  const [pollCount, setPollCount] = useState(0);
  const invoiceIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setAmountStr(initialAmount > 0 ? String(initialAmount) : "");
    setMessage("");
    setPhase("form");
    setIsSending(false);
    setPollCount(0);
    invoiceIdRef.current = null;
  }, [open, initialAmount]);

  // Poll /api/status while waiting for the STK confirmation.
  useEffect(() => {
    if (!open || phase !== "prompt_sent" || !invoiceIdRef.current) return;
    const invoiceId = invoiceIdRef.current;
    let stopped = false;

    const iv = window.setInterval(async () => {
      if (stopped) return;
      try {
        const res = await fetch("/api/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ invoice_id: invoiceId }),
        });
        const data = (await res.json()) as { state?: string };
        const state = String(data.state || "").toUpperCase();
        setPollCount((c) => c + 1);

        if (state === "COMPLETE") {
          window.clearInterval(iv);
          stopped = true;
          invoiceIdRef.current = null;
          haptics.success();
          toast.success("Top-up confirmed");
          analytics.topupStkCompleted({ amountKes: parseInt(amountStr, 10) || 0 });
          if (onRetryAfterPaid) {
            try {
              await onRetryAfterPaid();
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Couldn't continue.");
            }
          }
          onClose();
        } else if (state === "FAILED" || state === "CANCELLED") {
          window.clearInterval(iv);
          stopped = true;
          invoiceIdRef.current = null;
          haptics.error();
          toast.error("Payment was cancelled or failed.");
          analytics.topupStkFailed({ amountKes: parseInt(amountStr, 10) || 0, reason: state });
          setPhase("form");
          setMessage("Payment cancelled or failed. Try again.");
        }
      } catch {
        /* keep polling */
      }
    }, 3000);

    return () => {
      stopped = true;
      window.clearInterval(iv);
    };
  }, [open, phase, onClose, onRetryAfterPaid]);

  const phoneOk = mpesaPhoneNumber.replace(/\D/g, "").length >= 12;

  const handleTopUp = async () => {
    if (!phoneOk) {
      setMessage("Save a valid M-PESA number on your profile first.");
      return;
    }
    const amountNum = parseInt(amountStr, 10);
    if (!amountNum || amountNum < minAmount) {
      setMessage(`Minimum top-up is KSH ${minAmount.toLocaleString()}.`);
      return;
    }

    setIsSending(true);
    setMessage("");
    setPollCount(0);
    try {
      const res = await fetch("/api/charge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone_number: mpesaPhoneNumber.replace(/\D/g, ""),
          amount: amountNum,
          user_id: userId,
          is_topup: true,
        }),
      });
      const data = await res.json();
      if (data.success) {
        invoiceIdRef.current = typeof data.invoice_id === "string" ? data.invoice_id : null;
        setPhase("prompt_sent");
        analytics.topupStkSent({
          amountKes: amountNum,
          phoneSuffix: mpesaPhoneNumber.slice(-3),
        });
        if (onRetryAfterPaid) {
          setMessage("Check your phone for M-PESA. Confirm the payment and we'll continue automatically.");
        } else {
          setMessage("Check your phone for M-PESA. We'll close this when it lands.");
        }
      } else {
        setMessage(data.message || "Failed to start M-PESA. Try again.");
      }
    } catch {
      setMessage("Network error. Try again.");
    }
    setIsSending(false);
  };

  const handleRetry = async () => {
    if (!onRetryAfterPaid) return;
    setIsSending(true);
    setMessage("");
    try {
      await onRetryAfterPaid();
      onClose();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Couldn't continue. Try again.");
    }
    setIsSending(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end md:items-center justify-center z-50 fade-in">
      <div className="bg-white dark:bg-zinc-900 rounded-t-3xl md:rounded-3xl w-full max-w-md p-6 modal-slide-up">
        <div className="flex justify-between items-start gap-3 mb-4">
          <div className="min-w-0">
            <h2 className="font-bold text-xl text-black dark:text-white">{title}</h2>
            {contextLine && <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 leading-snug">{contextLine}</p>}
          </div>
          <button type="button" onClick={onClose} className="text-2xl text-gray-400 hover:text-black dark:hover:text-white bg-transparent border-none shrink-0">
            ✕
          </button>
        </div>

        {phase === "form" ? (
          <>
            <div className="mb-6 flex flex-col items-center w-full">
              <span className="text-sm text-gray-400 font-semibold mb-2 uppercase tracking-wide">Amount (KSH)</span>
              <input
                type="text"
                inputMode="numeric"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value.replace(/\D/g, ""))}
                placeholder="0"
                className="text-[48px] font-bold text-center text-black dark:text-white bg-transparent border-none outline-none w-full mb-4 placeholder:text-gray-300 dark:placeholder:text-gray-700"
              />
              <div className="flex gap-2 w-full mb-2">
                {presets.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setAmountStr(String(preset))}
                    className="flex-1 py-3 rounded-2xl font-bold text-sm border-none bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors active:scale-95"
                  >
                    +{preset}
                  </button>
                ))}
              </div>
            </div>

            {!phoneOk && (
              <p className="text-sm text-center text-gray-500 mb-3">Add your M-PESA number in Profile before topping up.</p>
            )}

            {message && (
              <p className={`text-sm text-center font-medium mb-4 ${message.includes("Check your phone") ? "text-green-600" : "text-red-500"}`}>
                {message}
              </p>
            )}

            <button
              type="button"
              onClick={handleTopUp}
              disabled={isSending || !amountStr || !phoneOk}
              className="w-full py-4 bg-black dark:bg-white text-white dark:text-black border-none rounded-full font-bold text-lg disabled:opacity-50 transition-all active:scale-[0.98]"
            >
              {isSending ? "Sending..." : "Top Up"}
            </button>
          </>
        ) : (
          <>
            <div className="py-6 text-center">
              <div className="relative w-16 h-16 mx-auto mb-4">
                <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center text-2xl">📲</div>
                <div className="absolute inset-0 rounded-full bg-green-400 animate-ping opacity-20" />
              </div>
              <p className="font-bold text-base text-black dark:text-white mb-1">Check your phone</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 px-4">Enter your M-PESA PIN to confirm.</p>

              <div className="flex items-center justify-center gap-1.5 mt-5">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      pollCount > i ? "bg-green-500" : "bg-gray-200 dark:bg-zinc-700"
                    }`}
                  />
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-2 font-semibold">
                {pollCount === 0
                  ? "Waiting for PIN..."
                  : pollCount < 4
                  ? "Checking payment..."
                  : "Still waiting — keep this open."}
              </p>
            </div>

            {message && <p className="text-sm text-center text-gray-500 font-medium mb-4 px-4">{message}</p>}

            <div className="flex flex-col gap-3">
              {onRetryAfterPaid && (
                <button
                  type="button"
                  onClick={() => void handleRetry()}
                  disabled={isSending}
                  className="w-full py-4 border-none bg-black dark:bg-white text-white dark:text-black rounded-full font-bold text-base disabled:opacity-50 transition-all active:scale-[0.98]"
                >
                  {isSending ? "Working..." : retryCtaLabel}
                </button>
              )}
              <button type="button" onClick={onClose} className="w-full py-3 bg-transparent border-none text-gray-500 text-sm font-semibold hover:text-black dark:hover:text-white">
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
