import { useState, useEffect } from "react";
import { ComposeModeTabsBar, type ComposeMode } from "./ComposeModeTabsBar";
import { X, Image as ImageIcon, Tag } from "lucide-react";
import { DmSharePickerModal } from "../dm/DmSharePickerModal";
import type { Plan, FunctionListing } from "../../pages/home/types";

type TopMode = "create" | "post";

export function HomeComposeSheet({
  open,
  onClose,
  onSubmitPlan,
  onSubmitFunction,
}: {
  open: boolean;
  onClose: () => void;
  onSubmitPlan?: (data: any) => Promise<void>;
  onSubmitFunction?: (data: any) => Promise<void>;
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

  // --- POST MODE STATE ---
  const [postText, setPostText] = useState("");
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [taggedEntity, setTaggedEntity] = useState<{
    id: string;
    kind: string;
    title: string;
    subtitle: string;
  } | null>(null);

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
    }
  }, [open]);

  if (!open) return null;

  const handlePostSubmit = async () => {
    if (!postText.trim() && !taggedEntity) return;
    setIsSubmitting(true);
    try {
      // TODO: Connect to your future `posts` table
      console.log("Submitting Post:", { text: postText, taggedEntity });
      await new Promise((resolve) => setTimeout(resolve, 800)); // Simulating network
      onClose();
    } catch (e) {
      console.error(e);
      alert("Failed to post.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateSubmit = async () => {
    if (!title.trim() || isSubmitting) return;
    setIsSubmitting(true);
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
      alert("Failed to create.");
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
            {topMode === "create" ? "New…" : "Share…"}
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

              <div className="flex flex-col gap-3">
                <input
                  type="text"
                  placeholder="Title (e.g. Sushi Dinner, Tracksuit, Haircut)"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full h-14 bg-gray-100 rounded-2xl px-4 font-bold text-black outline-none placeholder-gray-400"
                />
                
                <div className="flex gap-3">
                  <div className="flex-1 relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-gray-400">KSH</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="Amount"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value.replace(/\\D/g, ""))}
                      className="w-full h-14 bg-gray-100 rounded-2xl pl-12 pr-4 font-bold text-black outline-none placeholder-gray-400"
                    />
                  </div>
                  {composeMode !== "plan" && (
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="Capacity"
                      value={maxCapacity}
                      onChange={(e) => setMaxCapacity(e.target.value.replace(/\\D/g, ""))}
                      className="w-1/3 h-14 bg-gray-100 rounded-2xl px-4 font-bold text-black outline-none placeholder-gray-400"
                    />
                  )}
                </div>

                {composeMode !== "sell" && composeMode !== "service" && (
                  <div className="flex gap-3">
                    <input
                      type="datetime-local"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="flex-1 h-14 bg-gray-100 rounded-2xl px-4 font-bold text-gray-500 outline-none min-w-0"
                    />
                    {composeMode === "function" && (
                      <input
                        type="text"
                        placeholder="Location"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        className="flex-1 h-14 bg-gray-100 rounded-2xl px-4 font-bold text-black outline-none placeholder-gray-400 min-w-0"
                      />
                    )}
                  </div>
                )}

                {composeMode !== "plan" && (
                  <textarea
                    placeholder="Description or fulfillment details..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full h-24 bg-gray-100 rounded-2xl p-4 font-semibold text-black outline-none placeholder-gray-400 resize-none"
                  />
                )}
              </div>

              <button
                type="button"
                onClick={handleCreateSubmit}
                disabled={!title.trim() || isSubmitting}
                className="w-full h-14 rounded-full bg-black text-white font-bold text-lg disabled:opacity-50 mt-2 tap-scale"
              >
                {isSubmitting ? "Creating..." : "Create"}
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
                <button className="w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center text-black hover:bg-gray-200 transition-colors">
                  <ImageIcon size={20} />
                </button>
                <button 
                  onClick={() => setShowTagPicker(true)} 
                  className="w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center text-black hover:bg-gray-200 transition-colors"
                >
                  <Tag size={20} />
                </button>

                <button 
                  onClick={handlePostSubmit}
                  disabled={(!postText.trim() && !taggedEntity) || isSubmitting}
                  className="ml-auto px-8 py-3 bg-black text-white rounded-full font-bold disabled:opacity-50 tap-scale"
                >
                  {isSubmitting ? "Posting..." : "Post"}
                </button>
              </div>
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
    </div>
  );
}

