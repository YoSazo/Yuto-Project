import { useEffect, useMemo, useRef, useState, type ChangeEvent, type RefObject } from "react";
import { ImagePlus, X, Send } from "lucide-react";
import { ComposeModeTabsBar, type ComposeMode } from "./ComposeModeTabsBar";
import { DmSharePickerModal } from "../dm/DmSharePickerModal";
import type { PublicPostTagPayload } from "../../lib/supabase";

export type { ComposeMode };

export function HomeComposeSheet({
  open,
  onDismiss,
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
  onSubmitPublicPost,
}: {
  open: boolean;
  onDismiss: () => void;
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
  onSubmitPublicPost: (input: { contentText: string; mediaFile: File | null; tagPayload: PublicPostTagPayload | null }) => Promise<void>;
}) {
  if (!open) return null;

  const canSubmit =
    composeMode === "plan"
      ? planTitle.trim().length > 0
      : functionTitle.trim().length > 0 && functionAmount.trim().length > 0;

  const [topMode, setTopMode] = useState<"create" | "post">("create");

  // "Post" mode state (public posts feed).
  const [postText, setPostText] = useState("");
  const [postMediaFile, setPostMediaFile] = useState<File | null>(null);
  const [postMediaPreview, setPostMediaPreview] = useState<string | null>(null);
  const postMediaInputRef = useRef<HTMLInputElement | null>(null);
  const [postTagPayload, setPostTagPayload] = useState<PublicPostTagPayload | null>(null);
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [isSubmittingPost, setIsSubmittingPost] = useState(false);
  const [postPublicError, setPostPublicError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    // Always default back to the existing "Create" flow when opening the sheet.
    setTopMode("create");

    setPostText("");
    setPostMediaFile(null);
    if (postMediaPreview) URL.revokeObjectURL(postMediaPreview);
    setPostMediaPreview(null);
    setPostTagPayload(null);
    setShowTagPicker(false);
    setIsSubmittingPost(false);
    setPostPublicError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const canSubmitPost = useMemo(() => {
    return postText.trim().length > 0 || !!postTagPayload || !!postMediaFile;
  }, [postText, postTagPayload, postMediaFile]);

  const tagLabel = (tag: PublicPostTagPayload) => {
    switch (tag.kind) {
      case "plan":
        return "Plan";
      case "function":
        return "Function";
      case "listing":
        return tag.listing_kind === "sell" ? "Storefront" : "Services";
      default:
        return "Tag";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm compose-backdrop-in" onClick={onDismiss} />

      <div className="relative w-full bg-white rounded-t-3xl px-5 pt-5 pb-10 z-10 max-h-[90vh] overflow-y-auto compose-sheet-up">
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />

        <div className="mb-4">
          <div className="flex items-center justify-between gap-3">
            <p className="font-extrabold text-2xl text-black text-left">{topMode === "create" ? "Post Something" : "Share a post"}</p>

            <div className="flex items-center bg-gray-100 rounded-full p-1">
              <button
                type="button"
                onClick={() => setTopMode("create")}
                className={`px-4 py-2 rounded-full text-sm font-extrabold transition-colors ${
                  topMode === "create" ? "bg-white text-black shadow-sm" : "text-gray-400"
                }`}
              >
                Create
              </button>
              <button
                type="button"
                onClick={() => setTopMode("post")}
                className={`px-4 py-2 rounded-full text-sm font-extrabold transition-colors ${
                  topMode === "post" ? "bg-white text-black shadow-sm" : "text-gray-400"
                }`}
              >
                Post
              </button>
            </div>
          </div>

          {topMode === "create" && (
            <ComposeModeTabsBar composeMode={composeMode} onComposeModeChange={onComposeModeChange} className="mt-3" />
          )}
        </div>

        {topMode === "create" && (
          <>
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
          </>
        )}

        {topMode === "post" && (
          <>
            <textarea
              value={postText}
              onChange={(e) => setPostText(e.target.value)}
              placeholder="What's going on?"
              className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-base resize-none h-24 focus:outline-none focus:border-black transition-colors mb-3"
              maxLength={800}
            />

            <div className="flex items-center gap-2 mb-3">
              <input
                ref={postMediaInputRef}
                type="file"
                accept="image/*,video/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  if (!file) return;
                  if (postMediaPreview) URL.revokeObjectURL(postMediaPreview);
                  const url = URL.createObjectURL(file);
                  setPostMediaFile(file);
                  setPostMediaPreview(url);
                }}
              />
              <button
                type="button"
                onClick={() => postMediaInputRef.current?.click()}
                className="px-4 py-2 bg-gray-100 border border-gray-200 rounded-full text-sm font-extrabold hover:bg-gray-200 transition-colors"
              >
                Add photo/video
              </button>
              <button
                type="button"
                onClick={() => setShowTagPicker(true)}
                className="px-4 py-2 bg-gray-100 border border-gray-200 rounded-full text-sm font-extrabold hover:bg-gray-200 transition-colors"
              >
                Tag
              </button>
            </div>

            {postTagPayload && (
              <div className="relative p-3 border border-gray-200 rounded-2xl flex items-center gap-3 bg-gray-50 mb-3">
                <div className="w-10 h-10 bg-white shadow-sm border border-gray-100 rounded-xl flex items-center justify-center text-black">
                  <Send size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-extrabold text-sm text-black truncate">{tagLabel(postTagPayload)}</p>
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider truncate">Tagged</p>
                </div>
                <button
                  type="button"
                  onClick={() => setPostTagPayload(null)}
                  className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200 border-none"
                >
                  ✕
                </button>
              </div>
            )}

            {postMediaPreview && (
              <div className="relative rounded-2xl overflow-hidden bg-gray-100 flex items-center justify-center border border-gray-100 mb-3">
                {postMediaFile?.type.startsWith("video/") ? (
                  <video src={postMediaPreview} className="w-full h-64 object-cover" controls={false} muted playsInline />
                ) : (
                  <img src={postMediaPreview} alt="Post media preview" className="w-full h-64 object-cover" />
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (postMediaPreview) URL.revokeObjectURL(postMediaPreview);
                    setPostMediaFile(null);
                    setPostMediaPreview(null);
                  }}
                  className="absolute top-2 right-2 w-8 h-8 bg-black/60 rounded-full flex items-center justify-center text-white border-none"
                >
                  <X size={16} />
                </button>
              </div>
            )}

            <DmSharePickerModal
              open={showTagPicker}
              onClose={() => setShowTagPicker(false)}
              onPickPlan={(p) => {
                setPostTagPayload({ kind: "plan", plan_id: p.id });
                setShowTagPicker(false);
              }}
              onPickFunction={(fn, kind) => {
                if (kind === "function") {
                  setPostTagPayload({ kind: "function", function_id: fn.id });
                } else if (kind === "sell") {
                  setPostTagPayload({ kind: "listing", function_id: fn.id, listing_kind: "sell" });
                } else {
                  setPostTagPayload({ kind: "listing", function_id: fn.id, listing_kind: "service" });
                }
                setShowTagPicker(false);
              }}
            />
          </>
        )}

        {topMode === "create" && (composeMode === "plan" ? (
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

            {/* Sell/Service: no contact field (DM auto-created on purchase). */}

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
        ))}

        {topMode === "create" && (
          <>
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
          </>
        )}

        {topMode === "post" && (
          <>
            {postPublicError && <p className="mb-3 text-sm text-red-600">{postPublicError}</p>}
            <button
              type="button"
              onClick={async () => {
                if (isSubmittingPost) return;
                setPostPublicError(null);
                if (!canSubmitPost) return;
                setIsSubmittingPost(true);
                try {
                  await onSubmitPublicPost({
                    contentText: postText,
                    mediaFile: postMediaFile,
                    tagPayload: postTagPayload,
                  });
                  onDismiss();
                } catch (err) {
                  console.error(err);
                  const msg = err instanceof Error ? err.message : "Failed to post.";
                  setPostPublicError(msg);
                } finally {
                  setIsSubmittingPost(false);
                }
              }}
              disabled={isSubmittingPost || !canSubmitPost}
              className="w-full py-4 bg-black text-white rounded-2xl font-bold text-base disabled:opacity-50 transition-opacity"
            >
              {isSubmittingPost ? "Posting..." : "Post"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

