import { useEffect, useState } from "react";
import type { DmMessage, ListingDmChargeRow } from "../../lib/supabase";
import { getListingDmCharge, payListingDmCharge, releaseListingDmCharge, fetchYutoBalance } from "../../lib/supabase";
import { toast } from "sonner";
import { haptics } from "../../lib/haptics";
import { Lock, ShieldCheck, BadgeDollarSign, Info, Clock } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { YutoBalanceTopUpModal } from "../wallet/YutoBalanceTopUpModal";
import { MIN_MPESA_TOPUP_KES } from "../../pages/home/computeTopUp";

export function DmChargeInline({
  message,
  currentUserId,
  otherUserId,
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

  const { profile: viewerProfile } = useAuth();
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
      <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm text-gray-400 text-sm font-semibold">
        Invalid charge
      </div>
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
    <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm w-full max-w-[min(100%,18rem)] mx-auto overflow-hidden">
      <div className="flex flex-col items-center text-center gap-1.5 mb-4">
        <div className={`w-14 h-14 rounded-full flex items-center justify-center shrink-0 ${effective?.release_mode === "held" ? "bg-blue-50 text-blue-600" : "bg-emerald-50 text-emerald-600"}`}>
          <BadgeDollarSign size={28} />
        </div>
        <p className="font-extrabold text-2xl text-black leading-tight">
          KSH {effective ? effective.amount_kes.toLocaleString("en-KE") : "—"}
        </p>
        <div className="flex items-center gap-1 justify-center">
           {effective?.release_mode === "held" ? <Lock size={12} className="text-gray-400" /> : <ShieldCheck size={12} className="text-gray-400" />}
           <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
            {effective?.release_mode === "held" ? "Held until handoff" : "Direct payment"}
          </p>
        </div>
        {effective?.note && (
          <p className="text-xs text-gray-500 font-semibold mt-1 px-2 line-clamp-2">{effective.note}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {cancelled && (
          <div className="w-full py-2.5 rounded-xl bg-gray-50 text-gray-400 text-sm font-bold flex items-center justify-center">
            Cancelled
          </div>
        )}
        {done && (
          <div className="w-full py-2.5 rounded-xl bg-emerald-50 text-emerald-600 text-sm font-bold flex items-center justify-center gap-1.5">
            <Check size={16} /> Complete
          </div>
        )}

        {pending && isBuyer && (
          <button
            type="button"
            onClick={handlePay}
            className="w-full py-3 rounded-xl bg-black text-white text-sm font-bold shadow-lg shadow-black/10 active:scale-[0.98] transition-transform"
          >
            Pay now
          </button>
        )}

        {pending && isSeller && (
          <div className="w-full py-2.5 rounded-xl bg-amber-50 text-amber-700 text-sm font-bold flex items-center justify-center gap-1.5">
            <Clock size={16} /> Waiting for payment
          </div>
        )}

        {paidHeld && (
          <div className="flex flex-col gap-2">
            {isSeller && (
              <p className="text-[10px] text-blue-600 font-bold uppercase tracking-tight text-center px-1">
                Waiting for buyer to confirm receipt
              </p>
            )}
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
              className="w-full py-3 rounded-xl bg-blue-600 text-white text-sm font-bold shadow-lg shadow-blue-500/20 active:scale-[0.98] transition-transform"
            >
              {isBuyer
                ? (effective?.note?.toLowerCase().includes("service") || effective?.function_id
                  ? "Confirm & release"
                  : "I received it — release")
                : "Confirm handoff"}
            </button>
          </div>
        )}

        {!effective && (
          <div className="w-full py-2.5 text-center text-gray-400 text-xs font-semibold animate-pulse">
            Loading charge details…
          </div>
        )}
      </div>

      {showTopUp && currentUserId && effective && (
        <YutoBalanceTopUpModal
          open
          onClose={() => setShowTopUp(false)}
          userId={currentUserId}
          mpesaPhoneNumber={viewerProfile?.phone_number || ""}
          initialAmount={topUpAmount}
          contextLine={`This charge is KSH ${effective.amount_kes.toLocaleString()}. You're short on Yuto Balance. Add KSH ${topUpAmount.toLocaleString()} to continue.`}
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

function Check({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
