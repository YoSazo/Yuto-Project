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
}: {
  open: boolean;
  onClose: () => void;
  onPickPlan: (plan: Plan) => void;
  onPickFunction: (fn: FunctionListing, kind: "function" | "sell" | "service") => void;
  onRequestSplit: (args: { amountKes: number; memo: string; mediaFile?: File | null }) => void | Promise<void>;
}) {
  const [topTab, setTopTab] = useState<"share" | "split">("share");
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

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center fade-in bg-black/60 backdrop-blur-sm">
      <button type="button" className="absolute inset-0 z-0 cursor-default border-none bg-transparent" aria-label="Dismiss" onClick={onClose} />

      <div className="relative z-10 bg-white rounded-t-3xl md:rounded-3xl w-full max-w-2xl p-6 md:p-7 modal-slide-up">
        <div className="flex items-center justify-between mb-4">
          <p className="font-extrabold text-black text-lg">{topTab === "share" ? "Send…" : "Split"}</p>
          <button onClick={onClose} className="text-2xl text-gray-400 hover:text-black bg-transparent border-none">
            ✕
          </button>
        </div>

        <div className="mb-4">
          <div className="bg-gray-100 rounded-full p-1 flex">
            <button
              type="button"
              onClick={() => setTopTab("share")}
              className={`flex-1 h-11 rounded-full font-bold text-sm transition-colors ${
                topTab === "share" ? "bg-black text-white" : "bg-transparent text-gray-500"
              }`}
            >
              Share
            </button>
            <button
              type="button"
              onClick={() => setTopTab("split")}
              className={`flex-1 h-11 rounded-full font-bold text-sm transition-colors ${
                topTab === "split" ? "bg-black text-white" : "bg-transparent text-gray-500"
              }`}
            >
              Split
            </button>
          </div>
        </div>

        {topTab === "share" ? (
          <DmSharePickerModal open onClose={onClose} onPickPlan={onPickPlan} onPickFunction={onPickFunction} embedded />
        ) : (
          <div>
            <div className="rounded-3xl border border-gray-200 p-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Amount (KSH)</p>
              <input
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))}
                placeholder="500"
                className="w-full text-4xl font-black tracking-tight outline-none border-none bg-transparent"
              />

              <div className="mt-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Memo</p>
                <input
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  placeholder="Uber, drinks…"
                  maxLength={40}
                  className="w-full h-12 rounded-2xl border border-gray-200 px-4 text-sm outline-none focus:border-black transition-colors"
                />
              </div>

              <div className="mt-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Photo / video (optional)</p>
                {mediaPreview ? (
                  <div className="relative rounded-2xl overflow-hidden bg-gray-100">
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
                      className="w-full py-4 border-2 border-dashed border-gray-200 rounded-2xl flex items-center justify-center gap-2 text-gray-400 hover:border-gray-300 hover:text-gray-500 transition-colors cursor-pointer"
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
                busy || !amount ? "bg-gray-200 text-gray-400 cursor-not-allowed" : "bg-black text-white hover:bg-gray-800"
              }`}
            >
              {busy ? "Creating…" : `Split KSH ${Number(amount || 0).toLocaleString("en-KE")}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

