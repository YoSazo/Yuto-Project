import { useEffect, useState } from "react";
import type { Plan, FunctionListing } from "../../pages/home/types";
import { DmSharePickerModal } from "./DmSharePickerModal";
import { Image as ImageIcon, X } from "lucide-react";

export function DmPlusModal({
  open,
  onClose,
  onPickPlan,
  onPickFunction,
  onRequestSplit,
  onSendMoney,
  sendAvailableBalanceKes = null,
  sendBalanceLoading = false,
  onOpenCharge,
}: {
  open: boolean;
  onClose: () => void;
  onPickPlan: (plan: Plan) => void;
  onPickFunction: (fn: FunctionListing, kind: "function" | "sell" | "service") => void;
  onRequestSplit: (args: { amountKes: number; memo: string; mediaFile?: File | null }) => void | Promise<void>;
  onSendMoney: (args: { amountKes: number; note: string }) => void | Promise<void>;
  /** Same as Profile wallet Send: spendable balance; null before first load */
  sendAvailableBalanceKes?: number | null;
  sendBalanceLoading?: boolean;
  /** DM-only: opens seller charge flow (+ menu). Omit in group chats. */
  onOpenCharge?: () => void;
}) {
  const [topTab, setTopTab] = useState<"share" | "split" | "send" | "charge">("share");
  const showChargeTab = typeof onOpenCharge === "function";
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTopTab("share");
    setAmount("");
    setMemo("");
    setBusy(false);
    setError("");
    setMediaFile(null);
    if (mediaPreview) URL.revokeObjectURL(mediaPreview);
    setMediaPreview(null);
  }, [open]);

  if (!open) return null;

  const handleRequest = async () => {
    const amountKes = Number(amount.replace(/,/g, ""));
    if (!Number.isFinite(amountKes) || amountKes <= 0) {
      setError("Enter a valid amount.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onRequestSplit({ amountKes: Math.round(amountKes), memo: memo.trim(), mediaFile });
      onClose();
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Couldn't create the request. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const handleSend = async () => {
    const amountKes = Number(amount.replace(/,/g, ""));
    if (!Number.isFinite(amountKes) || amountKes <= 0) {
      setError("Enter a valid amount.");
      return;
    }
    const rounded = Math.round(amountKes);
    if (sendAvailableBalanceKes != null && rounded > sendAvailableBalanceKes) {
      setError("Insufficient balance.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onSendMoney({ amountKes: rounded, note: memo.trim() });
      onClose();
    } catch (e) {
      console.error(e);
      const msg =
        typeof e === "object" &&
        e &&
        "message" in e &&
        typeof (e as { message?: unknown }).message === "string"
          ? (e as { message: string }).message
          : e instanceof Error
            ? e.message
            : "Couldn't send. Try again.";
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  const sendBtnDisabled =
    busy ||
    !amount ||
    sendBalanceLoading ||
    (sendAvailableBalanceKes != null && Number(amount.replace(/,/g, "")) > sendAvailableBalanceKes);

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center fade-in bg-black/60 backdrop-blur-sm">
      <button type="button" className="absolute inset-0 z-0 cursor-default border-none bg-transparent" aria-label="Dismiss" onClick={onClose} />

      <div className="relative z-10 bg-white dark:bg-zinc-900 rounded-t-3xl md:rounded-3xl w-full max-w-2xl p-6 md:p-7 modal-slide-up transition-colors">
        <div className="flex items-center justify-between mb-4">
          <p className="font-extrabold text-black dark:text-white text-lg">
            {topTab === "share"
              ? "Send…"
              : topTab === "charge"
                ? "Charge"
                : topTab === "split"
                  ? "Split"
                  : "Send"}
          </p>
          <button onClick={onClose} className="text-2xl text-gray-400 hover:text-black dark:hover:text-white bg-transparent border-none">
            ✕
          </button>
        </div>

        <div className="mb-4">
          <div className="bg-gray-100 dark:bg-zinc-800 rounded-full p-1 grid gap-1 grid-cols-2">
            <button
              type="button"
              onClick={() => setTopTab("share")}
              className={`h-11 rounded-full font-bold text-xs sm:text-sm transition-colors ${topTab === "share" ? "bg-black text-white dark:bg-white dark:text-black" : "bg-transparent text-gray-500 dark:text-gray-400"}`}
            >
              Share
            </button>
            {false && showChargeTab ? (
              <button
                type="button"
                onClick={() => setTopTab("charge")}
                className={`h-11 rounded-full font-bold text-xs sm:text-sm transition-colors ${topTab === "charge" ? "bg-black text-white dark:bg-white dark:text-black" : "bg-transparent text-gray-500 dark:text-gray-400"}`}
              >
                Charge
              </button>
            ) : null}
            {false && (
            <button
              type="button"
              onClick={() => setTopTab("split")}
              className={`h-11 rounded-full font-bold text-xs sm:text-sm transition-colors ${topTab === "split" ? "bg-black text-white dark:bg-white dark:text-black" : "bg-transparent text-gray-500 dark:text-gray-400"}`}
            >
              Split
            </button>
            )}
            <button
              type="button"
              onClick={() => setTopTab("send")}
              className={`h-11 rounded-full font-bold text-xs sm:text-sm transition-colors ${topTab === "send" ? "bg-black text-white dark:bg-white dark:text-black" : "bg-transparent text-gray-500 dark:text-gray-400"}`}
            >
              Send
            </button>
          </div>
        </div>

        {topTab === "share" ? (
          <DmSharePickerModal open onClose={onClose} onPickPlan={onPickPlan} onPickFunction={onPickFunction} embedded />
        ) : topTab === "charge" ? (
          <div className="rounded-3xl border border-gray-200 dark:border-zinc-800 p-6">
            <p className="text-sm font-semibold text-gray-600 dark:text-gray-300 leading-relaxed">
              Request payment for a listing or a custom amount. The buyer pays from their Yuto Balance (held until handoff or instant, depending on what you pick).
            </p>
            <button
              type="button"
              className="w-full mt-5 py-4 rounded-2xl bg-black dark:bg-white text-white dark:text-black font-extrabold text-base active:scale-[0.99] transition-transform"
              onClick={() => {
                onOpenCharge?.();
              }}
            >
              Create charge
            </button>
          </div>
        ) : topTab === "split" ? (
          <div>
            <div className="rounded-3xl border border-gray-200 dark:border-zinc-800 p-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Amount (KSH)</p>
              <input
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))}
                placeholder="500"
                className="w-full text-4xl font-black tracking-tight outline-none border-none bg-transparent text-black dark:text-white placeholder:text-gray-300 dark:placeholder:text-gray-600"
              />

              <div className="mt-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Memo</p>
                <input
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  placeholder="Uber, drinks…"
                  maxLength={40}
                  className="w-full h-12 rounded-2xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-black dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 px-4 text-sm outline-none focus:border-black dark:focus:border-white transition-colors"
                />
              </div>

              <div className="mt-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Photo / video (optional)</p>
                {mediaPreview ? (
                  <div className="relative rounded-2xl overflow-hidden bg-gray-100 dark:bg-zinc-800">
                    {mediaFile?.type.startsWith("video/") ? (
                      <video src={mediaPreview} className="w-full h-64 object-cover" muted playsInline autoPlay loop />
                    ) : (
                      <img src={mediaPreview} alt="" className="w-full h-64 object-cover" draggable={false} />
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        if (mediaPreview) URL.revokeObjectURL(mediaPreview);
                        setMediaFile(null);
                        setMediaPreview(null);
                      }}
                      className="absolute top-2 right-2 w-8 h-8 bg-black/60 rounded-full flex items-center justify-center text-white border-none"
                      aria-label="Remove media"
                      title="Remove"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <>
                    <input
                      type="file"
                      accept="image/*,video/*"
                      className="hidden"
                      id="split-media"
                      onChange={(e) => {
                        const f = e.target.files?.[0] || null;
                        if (!f) return;
                        if (mediaPreview) URL.revokeObjectURL(mediaPreview);
                        const url = URL.createObjectURL(f);
                        setMediaFile(f);
                        setMediaPreview(url);
                        e.currentTarget.value = "";
                      }}
                    />
                    <label
                      htmlFor="split-media"
                      className="w-full py-4 border-2 border-dashed border-gray-200 dark:border-zinc-700 rounded-2xl flex items-center justify-center gap-2 text-gray-400 dark:text-gray-500 hover:border-gray-300 dark:hover:border-zinc-600 hover:text-gray-500 dark:hover:text-gray-300 transition-colors cursor-pointer"
                    >
                      <ImageIcon size={20} />
                      <span className="text-sm font-medium">Add photo or video</span>
                    </label>
                  </>
                )}
              </div>
            </div>

            {error && <p className="text-red-500 text-sm text-center mt-3">{error}</p>}

            <button
              type="button"
              onClick={handleRequest}
              disabled={busy || !amount}
              className={`w-full mt-4 h-12 rounded-2xl font-extrabold text-base transition-colors ${
                busy || !amount ? "bg-gray-200 text-gray-400 cursor-not-allowed dark:bg-zinc-800 dark:text-gray-500" : "bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200"
              }`}
            >
              {busy ? "Creating…" : `Split KSH ${Number(amount || 0).toLocaleString("en-KE")}`}
            </button>
          </div>
        ) : (
          <div>
            <div className="rounded-3xl border border-gray-200 dark:border-zinc-800 p-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Amount (KSH)</p>
              <input
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))}
                placeholder="500"
                className="w-full text-4xl font-black tracking-tight outline-none border-none bg-transparent text-black dark:text-white placeholder:text-gray-300 dark:placeholder:text-gray-600"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-semibold">
                {sendBalanceLoading
                  ? "Available: …"
                  : sendAvailableBalanceKes != null
                    ? `Available: KSH ${sendAvailableBalanceKes.toLocaleString("en-KE")}`
                    : "Available: —"}
              </p>

              <div className="mt-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Note (optional)</p>
                <input
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  placeholder="For food, Uber…"
                  maxLength={60}
                  className="w-full h-12 rounded-2xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-black dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 px-4 text-sm outline-none focus:border-black dark:focus:border-white transition-colors"
                />
              </div>
            </div>

            {error && <p className="text-red-500 text-sm text-center mt-3">{error}</p>}

            <button
              type="button"
              onClick={handleSend}
              disabled={sendBtnDisabled}
              className={`w-full mt-4 h-12 rounded-2xl font-extrabold text-base transition-colors ${
                sendBtnDisabled ? "bg-gray-200 text-gray-400 cursor-not-allowed dark:bg-zinc-800 dark:text-gray-500" : "bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200"
              }`}
            >
              {busy ? "Sending…" : `Send KSH ${Number(amount || 0).toLocaleString("en-KE")}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
