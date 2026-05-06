import { useEffect, useMemo, useState, type ChangeEvent, type RefObject } from "react";
import { ClipboardList, PartyPopper, Store, Briefcase, ImagePlus, X, Send } from "lucide-react";

export type ComposeMode = "plan" | "function" | "sell" | "service";

const composeTabs = [
  { id: "plan", label: "Plan", Icon: ClipboardList },
  { id: "function", label: "Function", Icon: PartyPopper },
  { id: "sell", label: "Sell", Icon: Store },
  { id: "service", label: "Services", Icon: Briefcase },
] as const satisfies ReadonlyArray<{ id: ComposeMode; label: string; Icon: (p: { size?: number; className?: string }) => JSX.Element }>;

export function HomeComposeSheet({
  open,
  onDismiss,
  onRequestOpen,
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
  onRequestOpen: () => void;
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
  const [mounted, setMounted] = useState(true);
  const startGeoRef = useMemo(
    () => ({ current: null as null | { sL: number; sB: number; sW: number; sH: number; tL: number; tB: number; tW: number; tH: number } }),
    [],
  );

  const morphRef = useMemo(() => ({ current: null as HTMLDivElement | null }), []);
  const rippleRef = useMemo(() => ({ current: null as HTMLDivElement | null }), []);
  const btnLabelRef = useMemo(() => ({ current: null as HTMLDivElement | null }), []);
  const btnIconRef = useMemo(() => ({ current: null as HTMLSpanElement | null }), []);
  const btnTextRef = useMemo(() => ({ current: null as HTMLSpanElement | null }), []);
  const sheetRef = useMemo(() => ({ current: null as HTMLDivElement | null }), []);

  // keep mounted (morph element is always present)
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const outCubic = (t: number) => 1 - Math.pow(1 - t, 3);
  const outBack = (t: number) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2;
  const outQuint = (t: number) => 1 - Math.pow(1 - t, 5);

  const go = (ms: number, fn: (p: number) => void) =>
    new Promise<void>((resolve) => {
      let t0: number | null = null;
      const f = (ts: number) => {
        if (t0 == null) t0 = ts;
        const p = Math.min((ts - t0) / ms, 1);
        fn(p);
        if (p < 1) requestAnimationFrame(f);
        else resolve();
      };
      requestAnimationFrame(f);
    });

  const geo = (
    left: number,
    bottom: number,
    w: number,
    h: number,
    brTL: number,
    brTR: number,
    brBR: number,
    brBL: number,
    lum: number,
    bA: number,
  ) => {
    const morph = morphRef.current;
    if (!morph) return;
    morph.style.left = `${left}px`;
    morph.style.bottom = `${bottom}px`;
    morph.style.width = `${w}px`;
    morph.style.height = `${h}px`;
    morph.style.borderRadius = `${brTL}px ${brTR}px ${brBR}px ${brBL}px`;
    morph.style.background = `rgb(${lum},${lum},${lum})`;
    morph.style.border = `0.5px solid rgba(255,255,255,${bA})`;
    morph.style.transform = "none";
  };

  const openMorph = async () => {
    if (open) return;
    const morph = morphRef.current;
    const ripple = rippleRef.current;
    const btnLabel = btnLabelRef.current;
    const btnIco = btnIconRef.current;
    const btnTxt = btnTextRef.current;
    const shCont = sheetRef.current;
    if (!morph || !ripple || !btnLabel || !btnIco || !btnTxt || !shCont) return;

    // snapshot real position
    const mr = morph.getBoundingClientRect();
    const sL = mr.left;
    const sB = window.innerHeight - mr.bottom;
    const sW = mr.width;
    const sH = mr.height;

    const shell = document.getElementById("app-shell");
    const shellRect = shell?.getBoundingClientRect();
    const tL = shellRect?.left ?? 0;
    const tW = shellRect?.width ?? window.innerWidth;
    const tB = shellRect ? window.innerHeight - shellRect.bottom : 0;
    const tH = Math.min(560, Math.floor((shellRect?.height ?? window.innerHeight) * 0.9));

    startGeoRef.current = { sL, sB, sW, sH, tL, tB, tW, tH };

    // lock to absolute coords (viewport)
    morph.style.transform = "none";
    morph.style.left = `${sL}px`;
    morph.style.bottom = `${sB}px`;
    morph.style.width = `${sW}px`;
    morph.style.height = `${sH}px`;

    // phase 1 — press
    await go(90, (p) => {
      const e = outCubic(p);
      morph.style.transform = `scale(${1 - e * 0.1})`;
      ripple.style.transform = `scale(${1 + e * 2.2})`;
      ripple.style.opacity = String(e);
    });

    // phase 2 — spring pop
    await go(180, (p) => {
      const e = outBack(p);
      morph.style.transform = `scale(${1 + (e - 1) * 0.1})`;
      ripple.style.opacity = String(1 - p);
    });
    morph.style.transform = "none";
    ripple.style.opacity = "0";
    ripple.style.transform = "scale(0.2)";

    // phase 3 — dissolve label
    await go(100, (p) => {
      const e = outCubic(p);
      btnIco.style.opacity = String(1 - e);
      btnTxt.style.opacity = String(1 - e);
      btnIco.style.transform = `translateX(${-e * 12}px)`;
      btnTxt.style.transform = `translateX(${e * 12}px)`;
    });
    btnLabel.style.visibility = "hidden";

    // mark open now (backdrop becomes interactive during morph)
    onRequestOpen();

    // phase 4 — morph (grow upward/outward)
    await go(500, (p) => {
      const e = outQuint(p);
      const brTop = 100 - (100 - 28) * e;
      const brBot = 100 * (1 - e);

      const l = sL + (tL - sL) * e;
      const b = sB + (tB - sB) * e;
      const w = sW + (tW - sW) * e;
      const h = sH + (tH - sH) * e;
      const lum = Math.round(24 + (245 - 24) * e);
      const bA = 0.18 * (1 - e);

      geo(l, b, w, h, brTop, brTop, brBot, brBot, lum, bA);
    });

    geo(tL, tB, tW, tH, 28, 28, 0, 0, 245, 0);
    morph.style.background = "#f5f5f5";

    // phase 5 — reveal content (stagger)
    shCont.style.opacity = "1";
    shCont.style.pointerEvents = "auto";
    const children = Array.from(shCont.querySelectorAll<HTMLElement>("[data-si]"));
    children.forEach((el, i) => {
      el.style.opacity = "0";
      el.style.transform = "translateY(16px)";
      el.style.transition = "none";
      window.setTimeout(() => {
        el.style.transition =
          "opacity 0.28s cubic-bezier(0.32,0.72,0,1), transform 0.28s cubic-bezier(0.32,0.72,0,1)";
        el.style.opacity = "1";
        el.style.transform = "translateY(0)";
      }, i * 44 + 20);
    });
  };

  const closeMorph = async () => {
    const morph = morphRef.current;
    const btnLabel = btnLabelRef.current;
    const btnIco = btnIconRef.current;
    const btnTxt = btnTextRef.current;
    const shCont = sheetRef.current;
    if (!morph || !btnLabel || !btnIco || !btnTxt || !shCont) return;

    // hide content
    shCont.style.opacity = "0";
    shCont.style.pointerEvents = "none";

    const start = startGeoRef.current;
    if (!start) {
      onDismiss();
      return;
    }
    const { sL, sB, sW, sH, tL, tB, tW, tH } = start;

    await go(400, (p) => {
      const e = outQuint(p);
      const l = tL + (sL - tL) * e;
      const b = tB + (sB - tB) * e;
      const w = tW + (sW - tW) * e;
      const h = tH + (sH - tH) * e;
      const brTop = 28 + (100 - 28) * e;
      const brBot = 0 + 100 * e;
      const lum = Math.round(245 - (245 - 24) * e);
      geo(l, b, w, h, brTop, brTop, brBot, brBot, lum, 0);
    });

    // restore "button" look
    morph.removeAttribute("style");
    btnLabel.style.visibility = "";
    btnIco.style.cssText = "";
    btnTxt.style.cssText = "";
    onDismiss();
  };

  const canSubmit =
    composeMode === "plan"
      ? planTitle.trim().length > 0
      : functionTitle.trim().length > 0 && functionAmount.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Dismiss"
        onClick={closeMorph}
        className={[
          "absolute inset-0 border-none bg-black/0 backdrop-blur-none transition-[background,backdrop-filter] duration-500",
          open ? "pointer-events-auto bg-black/75 backdrop-blur-sm" : "pointer-events-none bg-black/0 backdrop-blur-none",
        ].join(" ")}
      />

      {/* Morph element (button -> sheet) */}
      <div
        ref={(el) => { morphRef.current = el; }}
        onClick={() => void openMorph()}
        className={[
          "pointer-events-auto fixed left-1/2 -translate-x-1/2",
          "bottom-24 w-[120px] h-[50px] rounded-full",
          "bg-black text-white border border-white/15 shadow-lg overflow-hidden",
          "select-none",
        ].join(" ")}
        style={{ zIndex: 100 }}
      >
        {/* Ripple */}
        <div
          ref={(el) => { rippleRef.current = el; }}
          className="absolute inset-0 opacity-0"
          style={{
            background: "radial-gradient(circle at center, rgba(255,255,255,0.2) 0%, transparent 70%)",
            borderRadius: "inherit",
            transform: "scale(0.2)",
            pointerEvents: "none",
          }}
        />

        {/* Button label */}
        <div
          ref={(el) => { btnLabelRef.current = el; }}
          className="absolute inset-0 flex items-center justify-center gap-2 text-white font-bold text-sm"
          style={{ pointerEvents: "none" }}
        >
          <span ref={(el) => { btnIconRef.current = el; }} className="inline-flex">
            <Send size={16} />
          </span>
          <span ref={(el) => { btnTextRef.current = el; }}>Post</span>
        </div>

        {/* Sheet content */}
        <div
          ref={(el) => { sheetRef.current = el; }}
          className="absolute inset-0 opacity-0 pointer-events-none overflow-hidden"
          style={{ padding: "0 18px 24px" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div data-si className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5 mt-3" />
          <div data-si className="mb-4">
            <p className="font-extrabold text-2xl text-black text-left">Post Something</p>

            <div className="mt-3 relative h-[54px] w-full">
              <div
                className="absolute inset-0 rounded-full overflow-hidden border border-gray-200"
                style={{
                  background: "rgba(255, 255, 255, 0.7)",
                  backdropFilter: "blur(20px)",
                  WebkitBackdropFilter: "blur(20px)",
                  boxShadow: "0 4px 24px rgba(0, 0, 0, 0.06)",
                }}
              />

              <div
                className="absolute top-[5px] bottom-[5px] rounded-full bg-black z-20 transition-all duration-300 ease-out"
                style={{
                  left: `calc(${composeTabs.findIndex((t) => t.id === composeMode) * 25}% + 5px)`,
                  width: "calc(25% - 10px)",
                }}
              />

              <div className="relative h-full flex items-center z-30">
                {composeTabs.map((tab) => {
                  const isLit = tab.id === composeMode;
                  const Icon = tab.Icon;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => onComposeModeChange(tab.id)}
                      className="flex-1 relative flex flex-col items-center justify-center gap-0.5 h-full cursor-pointer bg-transparent border-none"
                    >
                      <Icon size={18} className={isLit ? "text-white" : "text-gray-400"} />
                      <span
                        className={`text-[10px] font-semibold transition-colors duration-200 ${
                          isLit ? "text-white" : "text-gray-400"
                        }`}
                      >
                        {tab.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

        {composeMode === "plan" ? (
          <textarea
            value={planTitle}
            onChange={(e) => onPlanTitleChange(e.target.value)}
            placeholder="Bowling Saturday? Who's in 🎳"
            className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-base resize-none h-24 focus:outline-none focus:border-black transition-colors mb-3"
            maxLength={200}
            data-si
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
              data-si
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
              data-si
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
                  data-si
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
                  data-si
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
                  data-si
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
                  data-si
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
                  data-si
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
                  data-si
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
                  data-si
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
                      data-si
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
                    data-si
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
          data-si
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
    </div>
  );
}
