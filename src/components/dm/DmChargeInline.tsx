import { useEffect, useState } from "react";
import type { DmMessage, ListingDmChargeRow } from "../../lib/supabase";
import { getListingDmCharge, payListingDmCharge, releaseListingDmCharge } from "../../lib/supabase";
import { toast } from "sonner";
import { haptics } from "../../lib/haptics";
import { Lock, ShieldCheck } from "lucide-react";

export function DmChargeInline({
  message,
  currentUserId,
  chargeCache,
  onRefreshCharge,
}: {
  message: DmMessage;
  currentUserId?: string;
  otherUserId?: string;
  chargeCache: Record<string, ListingDmChargeRow>;
  onRefreshCharge: (id: string) => void | Promise<void>;
}) {
  const chargeId = (message.payload as { charge_id?: string } | null)?.charge_id;
  const row = chargeId ? chargeCache[chargeId] : undefined;
  const [local, setLocal] = useState<ListingDmChargeRow | null>(null);
  const effective = row || local;

  useEffect(() => {
    if (!chargeId) return;
    if (row) return;
    void (async () => {
      try {
        const r = await getListingDmCharge(chargeId);
        if (r) {
          setLocal(r);
          await onRefreshCharge(chargeId);
        }
      } catch (e) {
        console.error(e);
      }
    })();
  }, [chargeId, row, onRefreshCharge]);

  if (!chargeId) {
    return (
      <div className="max-w-[90%] rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-500">Invalid charge</div>
    );
  }

  const isBuyer = currentUserId && effective && effective.buyer_id === currentUserId;
  const isSeller = currentUserId && effective && effective.seller_id === currentUserId;
  const pending = effective?.status === "pending";
  const paidHeld = effective?.status === "paid" && effective?.release_mode === "held";
  const done =
    effective?.status === "released" || (effective?.status === "paid" && effective?.release_mode === "trust");
  const cancelled = effective?.status === "cancelled";

  return (
    <div
      className={[
        "max-w-[min(100%,20rem)] rounded-3xl border-2 p-4 shadow-sm",
        effective?.release_mode === "held" ? "border-sky-200 bg-sky-50" : "border-emerald-200 bg-emerald-50",
      ].join(" ")}
    >
      <div className="flex items-center gap-2 mb-1">
        {effective?.release_mode === "held" ? (
          <Lock size={16} className="text-sky-700 shrink-0" />
        ) : (
          <ShieldCheck size={16} className="text-emerald-700 shrink-0" />
        )}
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
          {effective?.release_mode === "held" ? "Pay — held until handoff" : "Pay — trust / delivery"}
        </p>
      </div>
      <p className="text-2xl font-black text-black">KSH {effective ? effective.amount_kes.toLocaleString("en-KE") : "—"}</p>
      {effective?.note ? <p className="text-xs text-gray-600 mt-1 font-semibold">{effective.note}</p> : null}
      <div className="mt-3">
        {cancelled && <p className="text-sm font-bold text-gray-500">Cancelled</p>}
        {done && <p className="text-sm font-bold text-emerald-700">Complete</p>}
        {pending && isBuyer && (
          <button
            type="button"
            onClick={async () => {
              try {
                await payListingDmCharge(chargeId);
                haptics.success();
                toast.success("Paid from Yuto Balance");
                await onRefreshCharge(chargeId);
              } catch (e) {
                console.error(e);
                toast.error(e instanceof Error ? e.message : "Couldn't pay");
              }
            }}
            className="w-full py-3.5 rounded-2xl bg-black text-white font-extrabold text-base"
          >
            Pay with Yuto Balance
          </button>
        )}
        {pending && isSeller && <p className="text-sm font-semibold text-amber-800">Waiting for payment</p>}
        {paidHeld && (isBuyer || isSeller) && (
          <button
            type="button"
            onClick={async () => {
              try {
                await releaseListingDmCharge(chargeId);
                haptics.success();
                toast.success("Released to seller");
                await onRefreshCharge(chargeId);
              } catch (e) {
                console.error(e);
                toast.error(e instanceof Error ? e.message : "Couldn't release");
              }
            }}
            className="w-full py-3.5 rounded-2xl bg-sky-600 text-white font-extrabold text-base"
          >
            {isBuyer ? "I received it — release to seller" : "Confirm handoff — release"}
          </button>
        )}
        {!effective && <p className="text-sm text-gray-400 font-semibold">Loading…</p>}
      </div>
    </div>
  );
}
