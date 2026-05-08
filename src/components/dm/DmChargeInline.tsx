import { useEffect, useState } from "react";
import type { DmMessage, ListingDmChargeRow } from "../../lib/supabase";
import { getListingDmCharge, payListingDmCharge, releaseListingDmCharge, fetchYutoBalance } from "../../lib/supabase";
import { toast } from "sonner";
import { haptics } from "../../lib/haptics";
import { Lock, ShieldCheck } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { YutoBalanceTopUpModal } from "../wallet/YutoBalanceTopUpModal";
import { MIN_MPESA_TOPUP_KES } from "../../pages/home/computeTopUp";

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

  const { profile } = useAuth();
  const [showTopUp, setShowTopUp] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState(MIN_MPESA_TOPUP_KES);

  const handlePay = async () => {
    if (!effective || !chargeId || !currentUserId) return;
    try {
      await payListingDmCharge(chargeId);
      haptics.success();
      toast.success("Paid from Yuto Balance");
      await onRefreshCharge(chargeId);
    } catch (e: any) {
      console.error(e);
      const msg = e.message || String(e);
      if (msg.includes("Insufficient Yuto balance")) {
        const currentBalance = await fetchYutoBalance(currentUserId);
        const gap = effective.amount_kes - currentBalance;
        setTopUpAmount(Math.max(MIN_MPESA_TOPUP_KES, gap));
        setShowTopUp(true);
      } else {
        toast.error(msg || "Couldn't pay");
      }
    }
  };

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
    <div className="max-w-[min(100%,22rem)] rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
  <div className="flex items-center gap-2 mb-2">
    {effective?.release_mode === "held" ? (
      <Lock size={14} className="text-gray-400 shrink-0" />
    ) : (
      <ShieldCheck size={14} className="text-gray-400 shrink-0" />
    )}
    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
      {effective?.release_mode === "held" ? "Pay — held until handoff" : "Pay — trust / delivery"}
    </p>
  </div>
  <p className="text-3xl font-black text-black leading-tight">
    KSH {effective ? effective.amount_kes.toLocaleString("en-KE") : "—"}
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
            onClick={handlePay}
            className="w-full py-4 rounded-2xl bg-black text-green-400 font-extrabold text-lg"
          >
            Pay with Yuto Balance
          </button>
        )}
        {pending && isSeller && <p className="text-sm font-semibold text-amber-800">Waiting for payment</p>}
        
        {/* NEW: The Seller Nudge */}
        {paidHeld && isSeller && (
          <p className="text-xs text-sky-700 font-semibold mb-2 text-center">
            Waiting for buyer to confirm receipt, or tap below after handoff
          </p>
        )}

        {/* UPDATED: Smarter Button Text */}
        {paidHeld && (isBuyer || isSeller) && effective && (
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
            className="w-full py-4 rounded-2xl bg-black text-white font-extrabold text-lg"
          >
            {isBuyer
              ? effective.note?.toLowerCase().includes("service") || effective.function_id
                ? "Done — release payment to seller"
                : "I received it — release to seller"
              : "Confirm handoff — release payment"}
          </button>
        )}
        
        {!effective && <p className="text-sm text-gray-400 font-semibold">Loading…</p>}
      </div>

      {showTopUp && currentUserId && effective && (
        <YutoBalanceTopUpModal
          open
          onClose={() => setShowTopUp(false)}
          userId={currentUserId}
          mpesaPhoneNumber={profile?.phone_number || ""}
          initialAmount={topUpAmount}
          contextLine={`This charge is KSH ${effective.amount_kes.toLocaleString()}. You are short on Yuto Balance. Add at least KSH ${topUpAmount.toLocaleString()} to continue.`}
          retryCtaLabel="I've paid — try again"
          onRetryAfterPaid={async () => {
            setShowTopUp(false);
            await handlePay();
          }}
        />
      )}
    </div>
  );
}
