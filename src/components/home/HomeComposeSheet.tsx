import { useEffect, useMemo, useState, type ChangeEvent, type RefObject } from "react";
import { ClipboardList, PartyPopper, Store, Briefcase, ImagePlus, X, Send } from "lucide-react";

export type ComposeMode = "plan" | "function" | "sell" | "service";

export function HomeComposeSheet({
  open,
  onDismiss,
  originRect,
  composeMode,
  onComposeModeChange,
  planTitle,
  onPlanTitleChange,
  planAmount,
  onPlanAmountChange,
  planSlots,
  onPlanSlotsChange,
  planImagePreview,
  planImageInputRef,
  onPlanImageChange,
  onClearPlanImage,
  functionTitle,
  onFunctionTitleChange,
  functionDescription,
  onFunctionDescriptionChange,
  functionDate,
  onFunctionDateChange,
  functionLocation,
  onFunctionLocationChange,
  functionAmount,
  onFunctionAmountChange,
  functionCapacity,
  onFunctionCapacityChange,
  sellFulfillment,
  onSellFulfillmentChange,
  serviceFulfillment,
  onServiceFulfillmentChange,
  functionImagePreview,
  functionImageInputRef,
  onFunctionImageChange,
  onClearFunctionImage,
  postError,
  isPosting,
  onPost,
}: {
  open: boolean;
  onDismiss: () => void;
  originRect?: DOMRect | null;
  composeMode: ComposeMode;
  onComposeModeChange: (mode: ComposeMode) => void;
  planTitle: string;
  onPlanTitleChange: (value: string) => void;
  planAmount: string;
  onPlanAmountChange: (value: string) => void;
  planSlots: string;
  onPlanSlotsChange: (value: string) => void;
  planImagePreview: string | null;
  planImageInputRef: RefObject<HTMLInputElement | null>;
  onPlanImageChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onClearPlanImage: () => void;
  functionTitle: string;
  onFunctionTitleChange: (value: string) => void;
  functionDescription: string;
  onFunctionDescriptionChange: (value: string) => void;
  functionDate: string;
  onFunctionDateChange: (value: string) => void;
  functionLocation: string;
  onFunctionLocationChange: (value: string) => void;
  functionAmount: string;
  onFunctionAmountChange: (value: string) => void;
  functionCapacity: string;
  onFunctionCapacityChange: (value: string) => void;
  sellFulfillment: string;
  onSellFulfillmentChange: (value: string) => void;
  serviceFulfillment: string;
  onServiceFulfillmentChange: (value: string) => void;
  functionImagePreview: string | null;
  functionImageInputRef: RefObject<HTMLInputElement | null>;
  onFunctionImageChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onClearFunctionImage: () => void;
  postError: string | null;
  isPosting: boolean;
  onPost: () => void;
}) {
  const [mounted, setMounted] = useState(open);
  const [animateIn, setAnimateIn] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      // allow first paint, then animate
      requestAnimationFrame(() => setAnimateIn(true));
      return;
    }
    setAnimateIn(false);
    const id = window.setTimeout(() => setMounted(false), 220);
    return () => window.clearTimeout(id);
  }, [open]);

  const transformOrigin = useMemo(() => {
    if (!originRect) return "50% 100%";
    const x = originRect.left + originRect.width / 2;
    const y = originRect.top + originRect.height / 2;
    return `${x}px ${y}px`;
  }, [originRect]);

  if (!mounted) return null;

  const canSubmit =
    composeMode === "plan"
      ? planTitle.trim().length > 0
      : functionTitle.trim().length > 0 && functionAmount.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div
        className={[
          "absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-200",
          animateIn ? "opacity-100" : "opacity-0",
        ].join(" ")}
        onClick={onDismiss}
      />
      <div
        className="relative w-full bg-white rounded-t-3xl px-5 pt-5 pb-10 z-10 max-h-[90vh] overflow-y-auto"
        style={{
          transformOrigin,
          transform: animateIn ? "translateY(0) scale(1)" : "translateY(18px) scale(0.18)",
          opacity: animateIn ? 1 : 0,
          transition: "transform 260ms cubic-bezier(0.22, 1, 0.36, 1), opacity 200ms ease-out",
        }}
      >
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
        <div className="mb-4">
          <p className="font-bold text-xl text-black text-left">Post something</p>
          <div className="mt-3 flex bg-gray-100 rounded-2xl p-1">
            <button
              type="button"
              onClick={() => onComposeModeChange("plan")}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-colors ${
                composeMode === "plan" ? "bg-white text-black shadow-sm" : "text-gray-400"
              }`}
            >
              <span className="flex items-center justify-center gap-1.5">
                <ClipboardList size={14} /> Plan
              </span>
            </button>
            <button
              type="button"
              onClick={() => onComposeModeChange("function")}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-colors ${
                composeMode === "function" ? "bg-white text-black shadow-sm" : "text-gray-400"
              }`}
            >
              <span className="flex items-center justify-center gap-1.5">
                <PartyPopper size={14} /> Function
              </span>
            </button>
            <button
              type="button"
              onClick={() => onComposeModeChange("sell")}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-colors ${
                composeMode === "sell" ? "bg-white text-black shadow-sm" : "text-gray-400"
              }`}
            >
              <span className="flex items-center justify-center gap-1.5">
                <Store size={14} /> Sell
              </span>
            </button>
            <button
              type="button"
              onClick={() => onComposeModeChange("service")}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-colors ${
                composeMode === "service" ? "bg-white text-black shadow-sm" : "text-gray-400"
              }`}
            >
              <span className="flex items-center justify-center gap-1.5">
                <Briefcase size={14} /> Services
              </span>
            </button>
          </div>
        </div>

        {composeMode === "plan" ? (
          <textarea
            value={planTitle}
            onChange={(e) => onPlanTitleChange(e.target.value)}
            placeholder="Bowling Saturday? Who's in 🎳"
            className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-base resize-none h-24 focus:outline-none focus:border-black transition-colors mb-3"
            maxLength={200}
          />
        ) : (
          <div className="flex flex-col gap-3 mb-3">
            <input
              type="text"
              value={functionTitle}
              onChange={(e) => onFunctionTitleChange(e.target.value)}
              placeholder={
                composeMode === "sell"
                  ? "Shawarma Saturday?"
                  : composeMode === "service"
                    ? "Photography session"
                    : "Friday Night Westlands"
              }
              className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-base focus:outline-none focus:border-black transition-colors"
              maxLength={120}
            />
            <textarea
              value={functionDescription}
              onChange={(e) => onFunctionDescriptionChange(e.target.value)}
              placeholder={
                composeMode === "sell"
                  ? "What are you selling? (mandazis, photography, jerseys...)"
                  : composeMode === "service"
                    ? "What service are you offering? (hair, photos, lessons...)"
                    : "Add a short description..."
              }
              className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-base resize-none h-24 focus:outline-none focus:border-black transition-colors"
              maxLength={240}
            />
          </div>
        )}

        {composeMode === "plan" ? (
          <>
            <div className="mb-4">
              {planImagePreview ? (
                <div className="relative rounded-2xl overflow-hidden bg-gray-100 flex items-center justify-center">
                  <img src={planImagePreview} alt="Preview" className="max-w-full max-h-64 w-auto h-auto object-contain" />
                  <button
                    type="button"
                    onClick={onClearPlanImage}
                    className="absolute top-2 right-2 w-8 h-8 bg-black/60 rounded-full flex items-center justify-center text-white"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => planImageInputRef.current?.click()}
                  className="w-full py-4 border-2 border-dashed border-gray-200 rounded-2xl flex items-center justify-center gap-2 text-gray-400 hover:border-gray-300 hover:text-gray-500 transition-colors"
                >
                  <ImagePlus size={20} />
                  <span className="text-sm font-medium">Add photo</span>
                </button>
              )}
              <input ref={planImageInputRef} type="file" accept="image/*" className="hidden" onChange={onPlanImageChange} />
            </div>

            <div className="flex gap-3 mb-4">
              <div className="flex-1">
                <p className="text-xs text-gray-400 mb-1 font-semibold">Amount (KSH)</p>
                <input
                  type="number"
                  value={planAmount}
                  onChange={(e) => onPlanAmountChange(e.target.value)}
                  placeholder="e.g. 500"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-black transition-colors"
                />
              </div>
              <div className="flex-1">
                <p className="text-xs text-gray-400 mb-1 font-semibold">Slots</p>
                <input
                  type="number"
                  value={planSlots}
                  onChange={(e) => onPlanSlotsChange(e.target.value)}
                  placeholder="e.g. 5"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-black transition-colors"
                />
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-3 mb-3">
            <div className="mb-1">
              {functionImagePreview ? (
                <div className="relative rounded-2xl overflow-hidden bg-gray-100 flex items-center justify-center">
                  <img src={functionImagePreview} alt="Function preview" className="max-w-full max-h-64 w-auto h-auto object-contain" />
                  <button
                    type="button"
                    onClick={onClearFunctionImage}
                    className="absolute top-2 right-2 w-8 h-8 bg-black/60 rounded-full flex items-center justify-center text-white"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => functionImageInputRef.current?.click()}
                  className="w-full py-4 border-2 border-dashed border-gray-200 rounded-2xl flex items-center justify-center gap-2 text-gray-400 hover:border-gray-300 hover:text-gray-500 transition-colors"
                >
                  <ImagePlus size={20} />
                  <span className="text-sm font-medium">
                    {composeMode === "sell" || composeMode === "service" ? "Add photo" : "Add function photo"}
                  </span>
                </button>
              )}
              <input ref={functionImageInputRef} type="file" accept="image/*" className="hidden" onChange={onFunctionImageChange} />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <p className="text-xs text-gray-400 mb-1 font-semibold">
                  {composeMode === "sell" || composeMode === "service" ? "Price (KSH)" : "Amount per person (KSH)"}
                </p>
                <input
                  type="number"
                  value={functionAmount}
                  onChange={(e) => onFunctionAmountChange(e.target.value)}
                  placeholder="e.g. 500"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-black transition-colors"
                />
              </div>
              <div className="flex-1">
                <p className="text-xs text-gray-400 mb-1 font-semibold">
                  {composeMode === "sell" || composeMode === "service" ? "Stock / Available" : "Capacity"}
                </p>
                <input
                  type="number"
                  value={functionCapacity}
                  onChange={(e) => onFunctionCapacityChange(e.target.value)}
                  placeholder={composeMode === "sell" || composeMode === "service" ? "e.g. 50" : "e.g. 25"}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-black transition-colors"
                />
              </div>
            </div>
            {(composeMode === "sell" || composeMode === "service") && (
              <div>
                <p className="text-xs text-gray-400 mb-1 font-semibold">
                  {composeMode === "service" ? "How to book / contact" : "Pickup / delivery / contact"}
                </p>
                <input
                  type="text"
                  value={composeMode === "service" ? serviceFulfillment : sellFulfillment}
                  onChange={(e) =>
                    composeMode === "service"
                      ? onServiceFulfillmentChange(e.target.value)
                      : onSellFulfillmentChange(e.target.value)
                  }
                  placeholder={
                    composeMode === "service"
                      ? "e.g. DM @ali · Call 07xx · Book 2 days ahead"
                      : "e.g. Pick up Westlands · DM @ali · Delivery available"
                  }
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-black transition-colors"
                  maxLength={140}
                />
              </div>
            )}
            {composeMode !== "sell" && composeMode !== "service" && (
              <>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <p className="text-xs text-gray-400 mb-1 font-semibold">Date &amp; time</p>
                    <input
                      type="datetime-local"
                      value={functionDate}
                      onChange={(e) => onFunctionDateChange(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-black transition-colors"
                    />
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1 font-semibold">Location</p>
                  <input
                    type="text"
                    value={functionLocation}
                    onChange={(e) => onFunctionLocationChange(e.target.value)}
                    placeholder="Westlands, Nairobi"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-black transition-colors"
                  />
                </div>
              </>
            )}
          </div>
        )}

        {postError && <p className="mb-3 text-sm text-red-600">{postError}</p>}
        <button
          type="button"
          onClick={onPost}
          disabled={isPosting || !canSubmit}
          className="w-full py-4 bg-black text-white rounded-2xl font-bold text-base disabled:opacity-40 transition-opacity"
        >
          {isPosting ? (
            "Posting..."
          ) : (
            <span className="flex items-center justify-center gap-2">
              <Send size={16} />{" "}
              {composeMode === "plan"
                ? "Post Plan"
                : composeMode === "sell"
                  ? "Post Listing"
                  : composeMode === "service"
                    ? "Post Service"
                    : "Post Function"}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
