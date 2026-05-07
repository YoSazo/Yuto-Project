import { useEffect, useState } from "react";
import { saveProfilePhoneNumber } from "../../lib/supabase";

export function GroupChargeModal({
  amount,
  groupId,
  userId,
  defaultPhoneNumber,
  onClose,
  onRefreshStatus,
  embedded = false,
}: {
  amount: number;
  groupId: string;
  userId: string;
  defaultPhoneNumber?: string | null;
  onClose: () => void;
  onRefreshStatus?: () => void | Promise<void>;
  embedded?: boolean;
}) {
  const [phone, setPhone] = useState(defaultPhoneNumber || "254");
  const [step, setStep] = useState<"input" | "sending" | "waiting" | "error">("input");
  const [error, setError] = useState("");

  useEffect(() => {
    if (defaultPhoneNumber) setPhone(defaultPhoneNumber);
  }, [defaultPhoneNumber]);

  const handlePay = async () => {
    if (phone.length < 12) {
      setError("Enter a valid phone number (e.g. 254712345678)");
      return;
    }
    setStep("sending");
    setError("");
    try {
      const res = await fetch("/api/charge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone_number: phone, amount, group_id: groupId, user_id: userId }),
      });
      const data = await res.json();
      if (data.success) {
        void saveProfilePhoneNumber(userId, phone).catch(() => {});
        setStep("waiting");
      } else {
        setError(data.message || "Failed to initiate payment");
        setStep("error");
      }
    } catch {
      setError("Network error. Please try again.");
      setStep("error");
    }
  };

  const modalBody =
    step === "input" || step === "error" ? (
      <>
        <div className="flex justify-between items-center mb-5">
          <h2 className="font-bold text-xl text-black">Pay now</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-2xl text-gray-400 hover:text-black bg-transparent border-none cursor-pointer"
          >
            ✕
          </button>
        </div>
        {!embedded && (
          <p className="text-center text-sm text-gray-500 mb-5">
            Amount: <span className="font-bold text-black">KSH {amount.toLocaleString()}</span>
          </p>
        )}
        <div className="mb-5">
          <label className="text-xs text-gray-500 mb-1.5 block">M-PESA Phone Number</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
            placeholder="254712345678"
            maxLength={12}
            className="w-full h-12 border border-gray-300 rounded-full px-5 text-base outline-none focus:border-black transition-colors"
          />
          <p className="text-xs text-gray-400 mt-1.5 ml-2">Format: 254 followed by your number</p>
        </div>
        {error && <p className="text-red-500 text-sm text-center mb-4">{error}</p>}
        <button
          type="button"
          onClick={handlePay}
          disabled={phone.length < 12}
          className={`w-full h-12 rounded-full font-bold text-base transition-colors ${
            phone.length >= 12 ? "bg-black text-white hover:bg-gray-800" : "bg-gray-200 text-gray-400 cursor-not-allowed"
          }`}
        >
          Pay KSH {amount.toLocaleString()}
        </button>
        {step === "error" && onRefreshStatus && (
          <button
            type="button"
            onClick={() => void onRefreshStatus()}
            className="mt-3 w-full text-sm text-gray-500 underline hover:text-black text-center"
          >
            Already paid? Check status
          </button>
        )}
      </>
    ) : step === "sending" ? (
      <div className="py-12 text-center">
        <div className="w-12 h-12 border-4 border-gray-200 border-t-black rounded-full mx-auto mb-4 animate-spin" />
        <p className="font-bold text-lg text-black">Sending to your phone...</p>
      </div>
    ) : (
      <div className="py-12 text-center">
        <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
            <line x1="12" y1="18" x2="12.01" y2="18" />
          </svg>
        </div>
        <p className="font-bold text-lg text-black mb-2">Check your phone</p>
        <p className="text-sm text-gray-500">Enter your M-PESA PIN to complete payment</p>
        <p className="text-xs text-gray-400 mt-6">This will close automatically once confirmed</p>
        {onRefreshStatus && (
          <button
            type="button"
            onClick={() => void onRefreshStatus()}
            className="mt-4 text-sm text-gray-500 underline hover:text-black"
          >
            I already paid — refresh
          </button>
        )}
      </div>
    );

  if (embedded) return <>{modalBody}</>;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end md:items-center justify-center z-50 fade-in">
      <div className="bg-white rounded-t-3xl md:rounded-3xl w-full max-w-md p-6 modal-slide-up">{modalBody}</div>
    </div>
  );
}

