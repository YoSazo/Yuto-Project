import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { StorefrontListingItem } from "../../lib/supabase";

export function DmChargeModal({
  open,
  onClose,
  buyerUserId,
  sellerUserId,
  conversationId,
  listings,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  buyerUserId: string;
  sellerUserId: string;
  conversationId: string;
  listings: StorefrontListingItem[];
  onSubmit: (args: {
    amountKes: number;
    releaseMode: "trust" | "held";
    functionId: string | null;
    note: string;
  }) => void | Promise<void>;
}) {
  const [amount, setAmount] = useState("");
  const [releaseMode, setReleaseMode] = useState<"trust" | "held">("held");
  const [functionId, setFunctionId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!open) return;
    setAmount("");
    setReleaseMode("held");
    setFunctionId(null);
    setNote("");
    setBusy(false);
    setErr("");
  }, [open]);

  if (!open) return null;

  const submit = async () => {
    const n = Number(amount.replace(/,/g, ""));
    if (!Number.isFinite(n) || n <= 0) {
      setErr("Enter a valid amount.");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      await onSubmit({
        amountKes: Math.round(n),
        releaseMode,
        functionId,
        note: note.trim(),
      });
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't create charge.");
    } finally {
      setBusy(false);
    }
  };

  void buyerUserId;
  void sellerUserId;
  void conversationId;

  return (
    <div className="fixed inset-0 z-[55] flex items-end md:items-center justify-center fade-in bg-black/60 backdrop-blur-sm">
      <button type="button" className="absolute inset-0 z-0 cursor-default border-none bg-transparent" aria-label="Dismiss" onClick={onClose} />
      <div className="relative z-10 bg-white dark:bg-zinc-900 rounded-t-3xl md:rounded-3xl w-full max-w-md p-6 modal-slide-up shadow-xl transition-colors">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="font-extrabold text-black dark:text-white text-lg">Charge</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 font-semibold">Buyer pays from Yuto Balance</p>
          </div>
          <button type="button" onClick={onClose} className="text-2xl text-gray-400 hover:text-black dark:hover:text-white bg-transparent border-none">
            <X size={22} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Amount (KSH)</p>
            <input
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))}
              placeholder="6000"
              className="w-full text-3xl font-black tracking-tight outline-none border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-black dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 rounded-2xl px-4 py-3 focus:border-black dark:focus:border-white transition-colors"
            />
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Release</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setReleaseMode("held")}
                className={`rounded-2xl py-3 px-3 text-sm font-bold border transition-colors ${
                  releaseMode === "held"
                    ? "bg-black text-white border-black dark:bg-white dark:text-black dark:border-white"
                    : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100 dark:bg-zinc-800 dark:text-gray-300 dark:border-zinc-700 dark:hover:bg-zinc-700"
                }`}
              >
                After handoff
                <span className="block text-[10px] font-semibold opacity-80 mt-0.5">Held until buyer confirms</span>
              </button>
              <button
                type="button"
                onClick={() => setReleaseMode("trust")}
                className={`rounded-2xl py-3 px-3 text-sm font-bold border transition-colors ${
                  releaseMode === "trust" ? "bg-emerald-600 text-white border-emerald-600" : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100 dark:bg-zinc-800 dark:text-gray-300 dark:border-zinc-700 dark:hover:bg-zinc-700"
                }`}
              >
                Trust / delivery
                <span className="block text-[10px] font-semibold opacity-80 mt-0.5">Seller receives instantly</span>
              </button>
            </div>
          </div>

          {listings.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Attach listing (optional)</p>
              <select
                value={functionId ?? ""}
                onChange={(e) => setFunctionId(e.target.value || null)}
                className="w-full h-12 rounded-2xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-black dark:text-white px-3 font-semibold text-sm outline-none focus:border-black dark:focus:border-white"
              >
                <option value="">None</option>
                {listings.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.title} · KSH {l.amount_per_person.toLocaleString("en-KE")}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Note (optional)</p>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Size, pickup spot…"
              maxLength={200}
              className="w-full h-12 rounded-2xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-black dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 px-4 text-sm font-semibold outline-none focus:border-black dark:focus:border-white transition-colors"
            />
          </div>

          {err && <p className="text-sm text-red-500 font-semibold">{err}</p>}

          <button
            type="button"
            disabled={busy}
            onClick={() => void submit()}
            className={`w-full py-4 rounded-full font-bold text-lg transition-colors ${busy ? "bg-gray-100 text-gray-400 dark:bg-zinc-800 dark:text-gray-500" : "bg-black text-white dark:bg-white dark:text-black active:scale-[0.99]"}`}
          >
            {busy ? "Creating…" : "Send charge"}
          </button>
        </div>
      </div>
    </div>
  );
}
