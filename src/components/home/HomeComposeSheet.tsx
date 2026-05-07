import { useMemo, useRef, useState, useEffect } from "react";
import { ComposeModeTabsBar, type ComposeMode } from "./ComposeModeTabsBar";
import { X, Image as ImageIcon, Tag, Users, Send } from "lucide-react";
import { DmSharePickerModal } from "../dm/DmSharePickerModal";
import type { Plan, FunctionListing } from "../../pages/home/types";
import { PostPeoplePickerModal } from "./PostPeoplePickerModal";

type TopMode = "create" | "post";

export function HomeComposeSheet({
  open,
  onClose,
  onSubmitPlan,
  onSubmitFunction,
  onSubmitPost,
  currentUserId,
}: {
  open: boolean;
  onClose: () => void;
  onSubmitPlan?: (data: any) => Promise<void>;
  onSubmitFunction?: (data: any) => Promise<void>;
  onSubmitPost?: (data: {
    text: string;
    taggedEntity: { id: string; kind: string } | null;
    taggedUserIds: string[];
    mediaFile: File | null;
  }) => Promise<void>;
  currentUserId?: string;
}) {
  // Master Toggle State
  const [topMode, setTopMode] = useState<TopMode>("create");

  // --- CREATE MODE STATE ---
  const [composeMode, setComposeMode] = useState<ComposeMode>("plan");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [location, setLocation] = useState("");
  const [maxCapacity, setMaxCapacity] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // --- POST MODE STATE ---
  const [postText, setPostText] = useState("");
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [taggedEntity, setTaggedEntity] = useState<{
    id: string;
    kind: string;
    title: string;
    subtitle: string;
  } | null>(null);
  const [showPeoplePicker, setShowPeoplePicker] = useState(false);
  const [taggedPeople, setTaggedPeople] = useState<
    { id: string; username: string; display_name: string; avatar_url: string | null }[]
  >([]);
  const [postError, setPostError] = useState<string | null>(null);
  const postMediaInputRef = useRef<HTMLInputElement | null>(null);
  const [postMediaFile, setPostMediaFile] = useState<File | null>(null);
  const [postMediaPreview, setPostMediaPreview] = useState<string | null>(null);

  // Reset state when opened
  useEffect(() => {
    if (open) {
      setTopMode("create");
      setComposeMode("plan");
      setTitle("");
      setAmount("");
      setDescription("");
      setDate("");
      setLocation("");
      setMaxCapacity("");
      setPostText("");
      setTaggedEntity(null);
      setCreateError(null);
      setShowTagPicker(false);
      setShowPeoplePicker(false);
      setTaggedPeople([]);
      setPostError(null);
      setPostMediaFile(null);
      if (postMediaPreview) URL.revokeObjectURL(postMediaPreview);
      setPostMediaPreview(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const canCreateSubmit = useMemo(() => {
    if (!title.trim()) return false;
    if (composeMode === "plan") return true;
    return (parseInt(amount) || 0) > 0;
  }, [title, amount, composeMode]);

  const canPostSubmit = useMemo(() => {
    return !!postText.trim() || !!taggedEntity || taggedPeople.length > 0 || !!postMediaFile;
  }, [postText, taggedEntity, taggedPeople.length, postMediaFile]);

  const handlePostSubmit = async () => {
    if (!canPostSubmit) return;
    setIsSubmitting(true);
    setPostError(null);
    try {
      if (onSubmitPost) {
        await onSubmitPost({
          text: postText,
          taggedEntity: taggedEntity ? { id: taggedEntity.id, kind: taggedEntity.kind } : null,
          taggedUserIds: taggedPeople.map((p) => p.id),
          mediaFile: postMediaFile,
        });
      }
      onClose();
    } catch (e) {
      console.error(e);
      setPostError(e instanceof Error ? e.message : "Failed to post.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateSubmit = async () => {
    if (!title.trim() || isSubmitting) return;
    setIsSubmitting(true);
    setCreateError(null);
    try {
      if (composeMode === "plan") {
        await onSubmitPlan?.({ title: title.trim(), amount: parseInt(amount) || 0, date });
      } else {
        const isSell = composeMode === "sell";
        const isService = composeMode === "service";
        await onSubmitFunction?.({
          title: title.trim(),
          amount_per_person: parseInt(amount) || 0,
          description: description.trim() || null,
          date: date || null,
          location: isSell ? "__SELL__" : isService ? "__SERVICE__" : location.trim() || null,
          max_capacity: parseInt(maxCapacity) || null,
        });
      }
      onClose();
    } catch (err) {
      console.error(err);
      setCreateError(err instanceof Error ? err.message : "Failed to create.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // The sliding segmented control for "Create" vs "Post"
  const renderTopToggle = () => (
    <div className="flex justify-center mb-4">
      <div className="relative flex w-[240px] bg-gray-100 rounded-full p-1">
        {/* Sliding Background Pill */}
        <div
          className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white rounded-full shadow-sm transition-transform duration-300 cubic-bezier(0.4, 0, 0.2, 1) ${
            topMode === "create" ? "translate-x-0" : "translate-x-[calc(100%+8px)]"
          }`}
        />
        <button
          type="button"
          onClick={() => setTopMode("create")}
          className={`relative z-10 flex-1 py-2 text-sm font-bold rounded-full transition-colors duration-300 ${
            topMode === "create" ? "text-black" : "text-gray-400"
          }`}
        >
          Create
        </button>
        <button
          type="button"
          onClick={() => setTopMode("post")}
          className={`relative z-10 flex-1 py-2 text-sm font-bold rounded-full transition-colors duration-300 ${
            topMode === "post" ? "text-black" : "text-gray-400"
          }`}
        >
          Post
        </button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm fade-in">
      <button type="button" className="absolute inset-0 border-none bg-transparent" aria-label="Dismiss" onClick={onClose} />

      <div className="relative w-full max-w-md bg-white rounded-t-3xl md:rounded-3xl p-5 modal-slide-up flex flex-col max-h-[90vh]">
        
        {/* Header & Toggle */}
        <div className="flex items-center justify-between mb-2">
          <p className="font-extrabold text-black text-lg">
            {topMode === "create" ? "Post Something" : "Share…"}
          </p>
          <button onClick={onClose} className="text-2xl text-gray-400 hover:text-black bg-transparent border-none">
            <X size={24} />
          </button>
        </div>

        {renderTopToggle()}

        <div className="flex-1 overflow-y-auto overscroll-contain pb-safe">
          {topMode === "create" ? (
            /* --- CREATE MODE UI --- */
            <div className="flex flex-col gap-4 fade-in">
              <ComposeModeTabsBar composeMode={composeMode} onComposeModeChange={setComposeMode} />

              {/* Old design-ish create fields */}
              {composeMode === "plan" ? (
                <textarea
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Bowling Saturday? Who's in 🎳"
                  className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-base resize-none h-24 focus:outline-none focus:border-black transition-colors"
                  maxLength={200}
                />
              ) : (
                <div className="flex flex-col gap-3">
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
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
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
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

              <div className="flex gap-3">
                <div className="flex-1">
                  <p className="text-xs text-gray-400 mb-1 font-semibold">
                    {composeMode === "plan" ? "Amount (KSH)" : composeMode === "sell" || composeMode === "service" ? "Price (KSH)" : "Amount per person (KSH)"}
                  </p>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="e.g. 500"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-black transition-colors"
                  />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-400 mb-1 font-semibold">
                    {composeMode === "plan" ? "Slots" : composeMode === "sell" || composeMode === "service" ? "Stock / Available" : "Capacity"}
                  </p>
                  <input
                    type="number"
                    value={maxCapacity}
                    onChange={(e) => setMaxCapacity(e.target.value)}
                    placeholder={composeMode === "plan" ? "e.g. 5" : "e.g. 25"}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-black transition-colors"
                  />
                </div>
              </div>

              {composeMode !== "sell" && composeMode !== "service" && composeMode !== "plan" && (
                <>
                  <div>
                    <p className="text-xs text-gray-400 mb-1 font-semibold">Date &amp; time</p>
                    <input
                      type="datetime-local"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-black transition-colors"
                    />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-1 font-semibold">Location</p>
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="Westlands, Nairobi"
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-black transition-colors"
                    />
                  </div>
                </>
              )}

              {createError && <p className="text-sm text-red-600">{createError}</p>}

              <button
                type="button"
                onClick={handleCreateSubmit}
                disabled={!canCreateSubmit || isSubmitting}
                className="w-full py-4 bg-black text-white rounded-2xl font-bold text-base disabled:opacity-40 transition-opacity"
              >
                <span className="flex items-center justify-center gap-2">
                  <Send size={16} /> {isSubmitting ? "Posting..." : "Post"}
                </span>
              </button>
            </div>
          ) : (
            /* --- POST MODE UI --- */
            <div className="flex flex-col h-full min-h-[350px] fade-in">
              <textarea
                className="w-full flex-1 text-xl font-medium text-black outline-none resize-none placeholder-gray-300 py-2"
                placeholder="What's going on?"
                value={postText}
                onChange={(e) => setPostText(e.target.value)}
                autoFocus
              />

              {taggedEntity && (
                <div className="relative mt-auto mb-4 p-3 border border-gray-200 rounded-2xl flex items-center gap-3 bg-gray-50/50">
                  <div className="w-10 h-10 bg-white shadow-sm border border-gray-100 rounded-xl flex items-center justify-center text-black">
                    <Tag size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-black truncate">{taggedEntity.title}</p>
                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">{taggedEntity.kind}</p>
                  </div>
                  <button 
                    onClick={() => setTaggedEntity(null)} 
                    className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}

              <div className="flex items-center gap-2 mt-auto pt-4 border-t border-gray-100 pb-2">
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
                  className="w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center text-black hover:bg-gray-200 transition-colors"
                >
                  <ImageIcon size={20} />
                </button>
                <button 
                  type="button"
                  onClick={() => setShowTagPicker(true)} 
                  className="w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center text-black hover:bg-gray-200 transition-colors"
                >
                  <Tag size={20} />
                </button>
                <button
                  type="button"
                  onClick={() => setShowPeoplePicker(true)}
                  className="w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center text-black hover:bg-gray-200 transition-colors"
                >
                  <Users size={20} />
                </button>

                <button
                  type="button"
                  onClick={handlePostSubmit}
                  disabled={!canPostSubmit || isSubmitting}
                  className="ml-auto px-8 py-3 bg-black text-white rounded-full font-bold disabled:opacity-50 tap-scale"
                >
                  {isSubmitting ? "Posting..." : "Post"}
                </button>
              </div>

              {postMediaPreview && (
                <div className="mt-3 rounded-2xl overflow-hidden border border-gray-100 bg-gray-50">
                  {postMediaFile?.type.startsWith("video/") ? (
                    <video src={postMediaPreview} className="w-full h-64 object-cover" controls muted playsInline />
                  ) : (
                    <img src={postMediaPreview} alt="" className="w-full h-64 object-cover" />
                  )}
                </div>
              )}

              {taggedPeople.length > 0 && (
                <div className="mt-3 text-xs text-gray-500 font-semibold">
                  Tagged:{" "}
                  {taggedPeople
                    .map((p) => (p.display_name?.trim() ? p.display_name : p.username))
                    .slice(0, 3)
                    .join(", ")}
                  {taggedPeople.length > 3 ? ` +${taggedPeople.length - 3}` : ""}
                </div>
              )}

              {postError && <p className="mt-2 text-sm text-red-600">{postError}</p>}
            </div>
          )}
        </div>
      </div>

      {/* Reuse your existing DmSharePickerModal to pick something to tag! */}
      <DmSharePickerModal
        open={showTagPicker}
        onClose={() => setShowTagPicker(false)}
        onPickPlan={(p: Plan) => {
          setTaggedEntity({ id: p.id, kind: "plan", title: p.title, subtitle: p.creator.display_name });
          setShowTagPicker(false);
        }}
        onPickFunction={(fn: FunctionListing, kind) => {
          setTaggedEntity({ id: fn.id, kind, title: fn.title, subtitle: fn.host.display_name });
          setShowTagPicker(false);
        }}
      />

      <PostPeoplePickerModal
        open={showPeoplePicker}
        onClose={() => setShowPeoplePicker(false)}
        currentUserId={currentUserId || null}
        selectedIds={taggedPeople.map((p) => p.id)}
        onChangeSelected={(people) => setTaggedPeople(people)}
      />
    </div>
  );
}

