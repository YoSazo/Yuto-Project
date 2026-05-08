import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Check, Copy, Share2, X } from "lucide-react";
import UserAvatar from "../UserAvatar";
import { toast } from "sonner";
import { haptics } from "../../lib/haptics";

/**
 * Per-transaction receipt + proof.
 *
 * Trust story: when someone settles inside Yuto, they need a *thing* they can
 * show — a clean, dated, line-item receipt with the counterparty's name and a
 * stable transaction id. This is what users instinctively screenshot for
 * proof, so we make it easy to share and copy properly instead of forcing a
 * blurry phone shot of the wallet history list.
 *
 * No image rasterization (no html2canvas dep): we ship a clean text receipt
 * via Web Share when available, and fall back to clipboard. Works on every
 * browser and PWA install target.
 */

export type ReceiptTransaction = {
  id: string;
  amount: number | string;
  created_at: string;
  note: string | null;
  kind: string | null;
  counterparty?: {
    id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
};

type DescriptionFn = (tx: ReceiptTransaction) => { title: string; subtitle: string | null };

function formatKes(amount: number) {
  return Math.abs(amount).toLocaleString("en-KE", { maximumFractionDigits: 0 });
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function shortId(id: string) {
  // Stable visible snippet — first 8 chars of the UUID. Enough to disambiguate
  // for support without exposing the full primary key in screenshots.
  return id.replace(/-/g, "").slice(0, 8).toUpperCase();
}

export function TransactionReceiptModal({
  tx,
  describe,
  ownerName,
  onClose,
}: {
  tx: ReceiptTransaction;
  describe: DescriptionFn;
  ownerName: string;
  onClose: () => void;
}) {
  const [sharing, setSharing] = useState(false);
  const amount = Number(tx.amount) || 0;
  const isPositive = amount > 0;
  const { title, subtitle } = describe(tx);
  const cp = tx.counterparty;
  const counterpartyLabel = cp?.display_name || cp?.username || null;

  const receiptText = [
    "Yuto receipt",
    "─────────────",
    title,
    `${isPositive ? "+" : "−"}KSH ${formatKes(amount)}`,
    counterpartyLabel ? `Counterparty: ${counterpartyLabel}` : null,
    `Date: ${formatDateTime(tx.created_at)}`,
    `Reference: YUTO-${shortId(tx.id)}`,
    `Account: ${ownerName}`,
    subtitle ? `Note: ${subtitle}` : null,
    "",
    "Settled on Yuto · yuto.social",
  ]
    .filter(Boolean)
    .join("\n");

  const handleShare = async () => {
    setSharing(true);
    haptics.tap();
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: "Yuto receipt", text: receiptText });
        return;
      }
      await navigator.clipboard.writeText(receiptText);
      toast.success("Receipt copied to clipboard");
    } catch (e) {
      // User cancelling Web Share throws AbortError; treat as a no-op.
      if (e instanceof Error && e.name === "AbortError") return;
      console.error("share receipt:", e);
      toast.error("Couldn't share receipt.");
    } finally {
      setSharing(false);
    }
  };

  const handleCopy = async () => {
    haptics.tap();
    try {
      await navigator.clipboard.writeText(receiptText);
      toast.success("Receipt copied");
    } catch {
      toast.error("Couldn't copy receipt.");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end md:items-center justify-center z-50 fade-in">
      <div className="bg-white rounded-t-3xl md:rounded-3xl w-full max-w-md modal-slide-up overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h2 className="font-bold text-lg text-black">Receipt</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-5 pb-5">
          <div className="rounded-3xl bg-gray-50 border border-gray-100 p-6 flex flex-col items-center text-center">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-3 ${isPositive ? "bg-green-50 text-green-600" : "bg-gray-100 text-black"}`}
            >
              {isPositive ? <ArrowDownLeft size={22} /> : <ArrowUpRight size={22} />}
            </div>

            <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold">
              {isPositive ? "Money in" : "Money out"}
            </p>
            <p
              className={`mt-1 text-4xl font-bold tracking-tight ${isPositive ? "text-green-600" : "text-black"}`}
            >
              {isPositive ? "+" : "−"}KES {formatKes(amount)}
            </p>
            <p className="mt-3 font-bold text-black">{title}</p>
            {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}

            {cp && (
              <div className="mt-5 flex items-center gap-2">
                <UserAvatar
                  name={cp.display_name || cp.username || "User"}
                  avatarUrl={cp.avatar_url}
                  size="sm"
                />
                <span className="text-sm font-semibold text-black">{counterpartyLabel}</span>
              </div>
            )}
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-y-3 text-sm">
            <dt className="text-gray-400 font-semibold">Date</dt>
            <dd className="text-black font-semibold text-right">{formatDateTime(tx.created_at)}</dd>

            <dt className="text-gray-400 font-semibold">Reference</dt>
            <dd className="text-black font-semibold text-right tracking-wider">YUTO-{shortId(tx.id)}</dd>

            <dt className="text-gray-400 font-semibold">Account</dt>
            <dd className="text-black font-semibold text-right truncate">{ownerName}</dd>

            <dt className="text-gray-400 font-semibold">Settled</dt>
            <dd className="text-right">
              <span className="inline-flex items-center gap-1 text-green-600 font-extrabold">
                <Check size={14} strokeWidth={3} /> On platform
              </span>
            </dd>
          </dl>

          <div className="mt-6 flex gap-2">
            <button
              type="button"
              onClick={() => void handleShare()}
              disabled={sharing}
              className="flex-1 h-12 rounded-2xl bg-black text-white font-bold flex items-center justify-center gap-2 hover:bg-gray-800 transition-colors disabled:opacity-60"
            >
              <Share2 size={16} />
              {sharing ? "Sharing..." : "Share receipt"}
            </button>
            <button
              type="button"
              onClick={() => void handleCopy()}
              className="h-12 px-4 rounded-2xl bg-gray-100 text-black font-bold flex items-center justify-center gap-2 hover:bg-gray-200 transition-colors"
              aria-label="Copy receipt"
              title="Copy receipt"
            >
              <Copy size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
