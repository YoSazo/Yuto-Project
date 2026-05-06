import { useState, useEffect } from "react";

const DEFAULT_PRESETS = [100, 250, 500, 1000] as const;

/**
 * Profile-style top-up: large amount, preset chips, minimal chrome.
 * Optional context line for “you’re short” flows; optional retry after STK for join/pay flows.
 */
export function YutoBalanceTopUpModal({
  open,
  onClose,
  userId,
  mpesaPhoneNumber,
  initialAmount = 0,
  title = "Top Up Yuto Balance",
  contextLine,
  minAmount = 10,
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
  /** Single muted line under the header (why they’re topping up). */
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

  useEffect(() => {
    if (!open) return;
    setAmountStr(initialAmount > 0 ? String(initialAmount) : "");
    setMessage("");
    setPhase("form");
    setIsSending(false);
  }, [open, initialAmount]);

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
        if (onRetryAfterPaid) {
          setPhase("prompt_sent");
          setMessage("Check your phone for M-PESA. Confirm the payment, then continue below.");
        } else {
          setMessage("Check your phone for M-PESA! Balance updates automatically.");
          window.setTimeout(() => onClose(), 4000);
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
      <div className="bg-white rounded-t-3xl md:rounded-3xl w-full max-w-md p-6 modal-slide-up">
        <div className="flex justify-between items-start gap-3 mb-4">
          <div className="min-w-0">
            <h2 className="font-bold text-xl text-black">{title}</h2>
            {contextLine && <p className="text-sm text-gray-500 mt-2 leading-snug">{contextLine}</p>}
          </div>
          <button type="button" onClick={onClose} className="text-2xl text-gray-400 hover:text-black bg-transparent border-none shrink-0">
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
                className="text-[48px] font-bold text-center text-black bg-transparent border-none outline-none w-full mb-4"
              />
              <div className="flex gap-2 w-full mb-2">
                {presets.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setAmountStr(String(preset))}
                    className="flex-1 py-3 rounded-2xl font-bold text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors active:scale-95"
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
              className="w-full py-4 bg-black text-white rounded-full font-bold text-lg disabled:opacity-50 transition-all active:scale-[0.98]"
            >
              {isSending ? "Sending..." : "Top Up"}
            </button>
          </>
        ) : (
          <>
            {message && <p className="text-sm text-center text-green-600 font-medium mb-6">{message}</p>}
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => void handleRetry()}
                disabled={isSending}
                className="w-full py-4 bg-black text-white rounded-full font-bold text-lg disabled:opacity-50 transition-all active:scale-[0.98]"
              >
                {isSending ? "Working..." : retryCtaLabel}
              </button>
              <button type="button" onClick={onClose} className="w-full py-3 text-gray-500 text-sm font-semibold hover:text-black">
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
