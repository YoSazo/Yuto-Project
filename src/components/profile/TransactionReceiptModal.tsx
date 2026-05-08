import { useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Calendar,
  Check,
  Clock,
  Copy,
  Hash,
  Receipt,
  Share2,
  Smartphone,
  Sparkles,
  Ticket,
  Undo2,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
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
 * Receipt anatomy by transaction kind:
 *
 *   transfer_sent / transfer_received        →  Sender · Recipient · Note
 *   wallet_offer_sent / _received            →  Sender · Recipient · "Settled" or "Pending until claimed"
 *   topup / topup_completed                  →  Method = M-PESA STK · Phone · M-PESA receipt code · Invoice id
 *   withdrawal                               →  Method = M-PESA B2C · Destination phone · Tracking id
 *   split_payment_sent / _received           →  Group name · Plan title · Per-person amount · Group deep-link
 *   function_payment_sent / _received        →  Function title · Host name · Function deep-link
 *   function_group_payment_sent              →  Function title · Ticket count · Buyer's friends covered
 *   function_ticket_gifted                   →  Function title · Gifter name · Function deep-link
 *   purchase_sent / purchase_received        →  Listing title · Counterparty · Listing kind = sell
 *   booking_sent / booking_received          →  Listing title · Counterparty · Listing kind = service
 *   referral_bonus                           →  Method = System · Friend who triggered the bonus
 *   cancellation_refund                      →  Reason: function cancelled · Function title
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
  status?: string | null;
  method?: string | null;
  metadata?: Record<string, any> | null;
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
  return id.replace(/-/g, "").slice(0, 8).toUpperCase();
}

function methodLabel(method: string | null | undefined): { label: string; icon: JSX.Element } {
  switch (method) {
    case "mpesa_stk":
      return { label: "M-PESA STK push", icon: <Smartphone size={14} /> };
    case "mpesa_b2c":
      return { label: "M-PESA send-out", icon: <Smartphone size={14} /> };
    case "system":
      return { label: "Yuto system", icon: <Sparkles size={14} /> };
    case "yuto_balance":
    default:
      return { label: "Yuto Balance", icon: <Wallet size={14} /> };
  }
}

function statusChip(status: string | null | undefined): { label: string; className: string; icon: JSX.Element } {
  switch (status) {
    case "pending":
      return {
        label: "Pending",
        className: "bg-amber-50 text-amber-700",
        icon: <Clock size={12} strokeWidth={3} />,
      };
    case "failed":
      return {
        label: "Failed",
        className: "bg-red-50 text-red-700",
        icon: <X size={12} strokeWidth={3} />,
      };
    case "refunded":
      return {
        label: "Refunded",
        className: "bg-blue-50 text-blue-700",
        icon: <Undo2 size={12} strokeWidth={3} />,
      };
    case "settled":
    default:
      return {
        label: "Settled",
        className: "bg-green-50 text-green-700",
        icon: <Check size={12} strokeWidth={3} />,
      };
  }
}

/**
 * Pick the icon that best represents WHAT this money movement was. Direction
 * (in/out) is communicated by colour; the icon adds the "what it is" axis.
 */
function kindIcon(kind: string | null | undefined, isPositive: boolean): JSX.Element {
  if (!kind) return isPositive ? <ArrowDownLeft size={22} /> : <ArrowUpRight size={22} />;
  if (/^topup|deposit/.test(kind)) return <ArrowDownLeft size={22} />;
  if (/^withdraw/.test(kind)) return <Smartphone size={22} />;
  if (/refund/.test(kind)) return <Undo2 size={22} />;
  if (/referral_bonus/.test(kind)) return <Sparkles size={22} />;
  if (/function_(payment|group_payment)|ticket|booking|purchase/.test(kind)) return <Ticket size={22} />;
  if (/split/.test(kind)) return <Users size={22} />;
  return isPositive ? <ArrowDownLeft size={22} /> : <ArrowUpRight size={22} />;
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
  const navigate = useNavigate();
  const [sharing, setSharing] = useState(false);

  const amount = Number(tx.amount) || 0;
  const isPositive = amount > 0;
  const isZero = amount === 0;
  const { title, subtitle } = describe(tx);
  const cp = tx.counterparty;
  const counterpartyLabel = cp?.display_name?.trim() || cp?.username || null;
  const counterpartyHandle = cp?.username ? `@${cp.username}` : null;
  const meta = (tx.metadata || {}) as Record<string, any>;
  const status = tx.status || "settled";
  const method = methodLabel(tx.method);
  const chip = statusChip(status);

  // Sender / Recipient labels — derived from amount sign.
  // Positive = money INTO this user → recipient is "you", sender is the counterparty.
  // Negative = money OUT of this user → sender is "you", recipient is the counterparty.
  const senderLabel = isPositive ? counterpartyLabel || "—" : ownerName;
  const recipientLabel = isPositive ? ownerName : counterpartyLabel || "—";

  // Pull rich metadata when we have it. None of these are required; the
  // receipt gracefully omits any field whose data is missing.
  const mpesaReceipt: string | null = meta.mpesa_receipt || meta.mpesa_reference || null;
  const phone: string | null = meta.phone || null;
  const intaSendId: string | null = meta.invoice_id || meta.tracking_id || null;
  const trackingId: string | null = meta.tracking_id || null;
  const planTitle: string | null = meta.plan_title || null;
  const groupName: string | null = meta.group_name || null;
  const groupId: string | null = meta.group_id || null;
  const functionTitle: string | null = meta.function_title || null;
  const functionId: string | null = meta.function_id || null;
  const ticketCount: number | null = meta.ticket_count || null;
  const perPersonKes: number | null = meta.per_person_kes || null;
  const totalKes: number | null = meta.total_kes || null;
  const reason: string | null = meta.reason || null;

  // Build the share-friendly text version. Mirrors the modal so a screenshot
  // and a copy-paste read identically.
  const receiptText = useMemo(() => {
    const lines: Array<string | null> = [
      "Yuto receipt",
      "─────────────",
      title,
      `${isZero ? "" : isPositive ? "+" : "−"}KSH ${formatKes(amount)}`,
      `Status: ${chip.label}`,
      `Method: ${method.label}`,
      "",
      `From: ${senderLabel}${counterpartyHandle && isPositive ? ` (${counterpartyHandle})` : ""}`,
      `To:   ${recipientLabel}${counterpartyHandle && !isPositive ? ` (${counterpartyHandle})` : ""}`,
      "",
      `Date: ${formatDateTime(tx.created_at)}`,
      `Reference: YUTO-${shortId(tx.id)}`,
      mpesaReceipt ? `M-PESA receipt: ${mpesaReceipt}` : null,
      phone ? `Phone: ${phone}` : null,
      intaSendId ? `Provider id: ${intaSendId}` : null,
      functionTitle ? `Function: ${functionTitle}` : null,
      ticketCount ? `Tickets: ${ticketCount}` : null,
      perPersonKes ? `Per person: KSH ${formatKes(perPersonKes)}` : null,
      totalKes ? `Group total: KSH ${formatKes(totalKes)}` : null,
      planTitle ? `Plan: ${planTitle}` : null,
      groupName && !planTitle ? `Group: ${groupName}` : null,
      reason ? `Reason: ${reason.replace(/_/g, " ")}` : null,
      subtitle && !mpesaReceipt && !planTitle && !functionTitle ? `Note: ${subtitle}` : null,
      "",
      "Settled on Yuto · yuto.social",
    ];
    return lines.filter((l) => l !== null).join("\n");
  }, [
    amount,
    chip.label,
    counterpartyHandle,
    functionTitle,
    groupName,
    intaSendId,
    isPositive,
    isZero,
    method.label,
    mpesaReceipt,
    perPersonKes,
    phone,
    planTitle,
    reason,
    recipientLabel,
    senderLabel,
    subtitle,
    ticketCount,
    title,
    totalKes,
    tx.created_at,
    tx.id,
  ]);

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

  // Contextual deep-links — let the user tap into the original surface so the
  // receipt actually feels alive, not just a static slip.
  const contextLinks: Array<{ label: string; onClick: () => void; icon: JSX.Element }> = [];
  if (groupId) {
    contextLinks.push({
      label: groupName ? `Open ${groupName}` : "Open split group",
      icon: <Users size={14} />,
      onClick: () => {
        onClose();
        navigate(`/yuto/${groupId}`);
      },
    });
  }
  if (functionId) {
    contextLinks.push({
      label: functionTitle ? `Open ${functionTitle}` : "Open function",
      icon: <Ticket size={14} />,
      onClick: () => {
        onClose();
        navigate("/home", { state: { focus: { kind: "function", id: functionId } } });
      },
    });
  }
  if (cp?.id) {
    contextLinks.push({
      label: counterpartyLabel ? `Open ${counterpartyLabel}'s profile` : "Open counterparty",
      icon: <Users size={14} />,
      onClick: () => {
        onClose();
        navigate(`/user/${cp.id}`);
      },
    });
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end md:items-center justify-center z-50 fade-in">
      <div className="bg-white rounded-t-3xl md:rounded-3xl w-full max-w-md modal-slide-up overflow-hidden max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
          <div className="flex items-center gap-2">
            <Receipt size={18} />
            <h2 className="font-bold text-lg text-black">Receipt</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-5 pb-5 overflow-y-auto">
          {/* Hero: amount + direction + status */}
          <div className="rounded-3xl bg-gray-50 border border-gray-100 p-6 flex flex-col items-center text-center">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-3 ${
                isPositive
                  ? "bg-green-50 text-green-600"
                  : isZero
                    ? "bg-gray-100 text-gray-700"
                    : "bg-gray-100 text-black"
              }`}
            >
              {kindIcon(tx.kind, isPositive)}
            </div>

            <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold">
              {isZero ? "Item received" : isPositive ? "Money in" : "Money out"}
            </p>
            <p
              className={`mt-1 text-4xl font-bold tracking-tight ${
                isPositive ? "text-green-600" : isZero ? "text-gray-700" : "text-black"
              }`}
            >
              {isZero
                ? "Free / gifted"
                : `${isPositive ? "+" : "−"}KES ${formatKes(amount)}`}
            </p>
            <p className="mt-3 font-bold text-black">{title}</p>
            {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}

            <div className="mt-4 flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold ${chip.className}`}
              >
                {chip.icon}
                {chip.label}
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-gray-100 text-gray-700">
                {method.icon}
                {method.label}
              </span>
            </div>

            {cp && (
              <div className="mt-5 flex items-center gap-2">
                <UserAvatar
                  name={cp.display_name || cp.username || "User"}
                  avatarUrl={cp.avatar_url}
                  size="sm"
                />
                <div className="text-left">
                  <p className="text-sm font-bold text-black leading-tight">{counterpartyLabel}</p>
                  {counterpartyHandle && (
                    <p className="text-xs text-gray-400 font-semibold leading-tight">
                      {counterpartyHandle}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Sender / Recipient — the directional truth, separately from amount */}
          <div className="mt-4 rounded-2xl border border-gray-100 overflow-hidden">
            <div className="grid grid-cols-2 divide-x divide-gray-100">
              <div className="p-4">
                <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">From</p>
                <p className="mt-1 font-bold text-black truncate">{senderLabel}</p>
              </div>
              <div className="p-4">
                <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">To</p>
                <p className="mt-1 font-bold text-black truncate">{recipientLabel}</p>
              </div>
            </div>
          </div>

          {/* Detail rows — only render fields we actually have */}
          <dl className="mt-4 grid grid-cols-2 gap-y-3 text-sm">
            <dt className="text-gray-400 font-semibold flex items-center gap-1.5"><Calendar size={12} /> Date</dt>
            <dd className="text-black font-semibold text-right">{formatDateTime(tx.created_at)}</dd>

            <dt className="text-gray-400 font-semibold flex items-center gap-1.5"><Hash size={12} /> Reference</dt>
            <dd className="text-black font-semibold text-right tracking-wider">YUTO-{shortId(tx.id)}</dd>

            <dt className="text-gray-400 font-semibold">Account</dt>
            <dd className="text-black font-semibold text-right truncate">{ownerName}</dd>

            {mpesaReceipt && (
              <>
                <dt className="text-gray-400 font-semibold">M-PESA receipt</dt>
                <dd className="text-black font-semibold text-right tracking-wider">{mpesaReceipt}</dd>
              </>
            )}

            {phone && (
              <>
                <dt className="text-gray-400 font-semibold">Phone</dt>
                <dd className="text-black font-semibold text-right">{phone}</dd>
              </>
            )}

            {intaSendId && (
              <>
                <dt className="text-gray-400 font-semibold">Provider id</dt>
                <dd className="text-black font-semibold text-right truncate font-mono text-xs">
                  {intaSendId}
                </dd>
              </>
            )}

            {trackingId && trackingId !== intaSendId && (
              <>
                <dt className="text-gray-400 font-semibold">Tracking id</dt>
                <dd className="text-black font-semibold text-right truncate font-mono text-xs">
                  {trackingId}
                </dd>
              </>
            )}

            {ticketCount != null && (
              <>
                <dt className="text-gray-400 font-semibold">Tickets</dt>
                <dd className="text-black font-semibold text-right">{ticketCount}</dd>
              </>
            )}

            {perPersonKes != null && (
              <>
                <dt className="text-gray-400 font-semibold">Per person</dt>
                <dd className="text-black font-semibold text-right">KSH {formatKes(perPersonKes)}</dd>
              </>
            )}

            {totalKes != null && (
              <>
                <dt className="text-gray-400 font-semibold">Group total</dt>
                <dd className="text-black font-semibold text-right">KSH {formatKes(totalKes)}</dd>
              </>
            )}

            {planTitle && (
              <>
                <dt className="text-gray-400 font-semibold">Plan</dt>
                <dd className="text-black font-semibold text-right truncate">{planTitle}</dd>
              </>
            )}

            {groupName && !planTitle && (
              <>
                <dt className="text-gray-400 font-semibold">Group</dt>
                <dd className="text-black font-semibold text-right truncate">{groupName}</dd>
              </>
            )}

            {functionTitle && (
              <>
                <dt className="text-gray-400 font-semibold">Function</dt>
                <dd className="text-black font-semibold text-right truncate">{functionTitle}</dd>
              </>
            )}

            {reason && (
              <>
                <dt className="text-gray-400 font-semibold">Reason</dt>
                <dd className="text-black font-semibold text-right truncate">
                  {reason.replace(/_/g, " ")}
                </dd>
              </>
            )}
          </dl>

          {/* Contextual deep-links: tapping receipt → original surface. */}
          {contextLinks.length > 0 && (
            <div className="mt-5 flex flex-col gap-2">
              {contextLinks.map((link, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    haptics.tap();
                    link.onClick();
                  }}
                  className="w-full h-11 rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors text-sm font-bold text-black flex items-center justify-center gap-2"
                >
                  {link.icon}
                  {link.label}
                </button>
              ))}
            </div>
          )}

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
