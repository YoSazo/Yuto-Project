import { useMemo, useRef, useState, useEffect } from "react";
import { ComposeModeTabsBar, type ComposeMode } from "./ComposeModeTabsBar";
import { X, Image as ImageIcon, Tag, Users, Send } from "lucide-react";
import { DmSharePickerModal } from "../dm/DmSharePickerModal";
import type { Plan, FunctionListing } from "../../pages/home/types";
import { PostPeoplePickerModal } from "./PostPeoplePickerModal";

type TopMode = "create" | "post";

const pad2 = (n: number) => n.toString().padStart(2, "0");

function parseLocalDateTime(value: string) {
  if (!value) return null;
  const [datePart, timePart = ""] = value.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour = 18, minute = 0] = timePart.split(":").map(Number);
  if (!year || !month || !day) return null;
  return { year, month, day, hour, minute };
}

function formatLocalDateTime(parts: { year: number; month: number; day: number; hour: number; minute: number }) {
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}T${pad2(parts.hour)}:${pad2(parts.minute)}`;
}

function describeDateTime(value: string) {
  const parsed = parseLocalDateTime(value);
  if (!parsed) return "Pick date & time";
  const dt = new Date(parsed.year, parsed.month - 1, parsed.day, parsed.hour, parsed.minute);
  return dt.toLocaleString("en-KE", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function DateTimePickerModal({
  open,
  value,
  onClose,
  onApply,
}: {
  open: boolean;
  value: string;
  onClose: () => void;
  onApply: (value: string) => void;
}) {
  const now = new Date();
  const initial = parseLocalDateTime(value) ?? {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
    hour: 18,
    minute: 0,
  };
  const [viewYear, setViewYear] = useState(initial.year);
  const [viewMonth, setViewMonth] = useState(initial.month);
  const [selectedDay, setSelectedDay] = useState(initial.day);
  const [hour, setHour] = useState(initial.hour);
  const [minute, setMinute] = useState(initial.minute);

  useEffect(() => {
    if (!open) return;
    const next = parseLocalDateTime(value) ?? {
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      day: now.getDate(),
      hour: 18,
      minute: 0,
    };
    setViewYear(next.year);
    setViewMonth(next.month);
    setSelectedDay(next.day);
    setHour(next.hour);
    setMinute(next.minute);
  }, [open, value]);

  if (!open) return null;

  const monthDate = new Date(viewYear, viewMonth - 1, 1);
  const monthLabel = monthDate.toLocaleDateString("en-KE", { month: "long", year: "numeric" });
  const daysInMonth = new Date(viewYear, viewMonth, 0).getDate();
  const firstWeekday = monthDate.getDay();
  const cells = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const moveMonth = (delta: number) => {
    const next = new Date(viewYear, viewMonth - 1 + delta, 1);
    const nextYear = next.getFullYear();
    const nextMonth = next.getMonth() + 1;
    setViewYear(nextYear);
    setViewMonth(nextMonth);
    setSelectedDay((day) => Math.min(day, new Date(nextYear, nextMonth, 0).getDate()));
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm fade-in">
      <button type="button" className="absolute inset-0 border-none bg-transparent" aria-label="Dismiss" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-t-3xl md:rounded-3xl bg-white dark:bg-zinc-900 p-5 modal-slide-up shadow-xl transition-colors">
        <div className="flex items-center justify-between mb-4">
          <p className="font-extrabold text-lg text-black dark:text-white">Date & time</p>
          <button type="button" onClick={onClose} className="text-2xl text-gray-400 hover:text-black dark:hover:text-white bg-transparent border-none">
            <X size={22} />
          </button>
        </div>

        <div className="flex items-center justify-between mb-3">
          <button type="button" onClick={() => moveMonth(-1)} className="w-10 h-10 rounded-2xl bg-gray-100 dark:bg-zinc-800 text-black dark:text-white font-black">
            {"<"}
          </button>
          <p className="font-extrabold text-black dark:text-white">{monthLabel}</p>
          <button type="button" onClick={() => moveMonth(1)} className="w-10 h-10 rounded-2xl bg-gray-100 dark:bg-zinc-800 text-black dark:text-white font-black">
            {">"}
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center mb-4">
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
            <span key={`${d}-${i}`} className="text-[11px] font-extrabold text-gray-400 dark:text-gray-500 py-1">
              {d}
            </span>
          ))}
          {cells.map((day, i) =>
            day ? (
              <button
                key={`${viewMonth}-${day}`}
                type="button"
                onClick={() => setSelectedDay(day)}
                className={`aspect-square rounded-2xl text-sm font-extrabold transition-colors ${
                  selectedDay === day
                    ? "bg-black dark:bg-white text-white dark:text-black"
                    : "bg-gray-50 dark:bg-zinc-800 text-black dark:text-white hover:bg-gray-100 dark:hover:bg-zinc-700"
                }`}
              >
                {day}
              </button>
            ) : (
              <span key={`blank-${i}`} />
            ),
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 mb-5">
          <label className="block">
            <span className="text-xs text-gray-400 font-semibold mb-1 block">Hour</span>
            <select value={hour} onChange={(e) => setHour(Number(e.target.value))} className="w-full h-12 rounded-2xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-black dark:text-white px-3 font-bold outline-none">
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={i}>{pad2(i)}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs text-gray-400 font-semibold mb-1 block">Minute</span>
            <select value={minute} onChange={(e) => setMinute(Number(e.target.value))} className="w-full h-12 rounded-2xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-black dark:text-white px-3 font-bold outline-none">
              {[0, 15, 30, 45].map((m) => (
                <option key={m} value={m}>{pad2(m)}</option>
              ))}
            </select>
          </label>
        </div>

        <button
          type="button"
          onClick={() => {
            onApply(formatLocalDateTime({ year: viewYear, month: viewMonth, day: selectedDay, hour, minute }));
            onClose();
          }}
          className="w-full h-12 rounded-2xl bg-black dark:bg-white text-white dark:text-black font-extrabold"
        >
          Set date
        </button>
      </div>
    </div>
  );
}

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
    mediaFiles: File[];
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
  const [showDatePicker, setShowDatePicker] = useState(false);
  const createMediaInputRef = useRef<HTMLInputElement | null>(null);
  const [createMediaFiles, setCreateMediaFiles] = useState<File[]>([]);
  const [createMediaPreviews, setCreateMediaPreviews] = useState<string[]>([]);

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
  const [postMediaFiles, setPostMediaFiles] = useState<File[]>([]);
  const [postMediaPreviews, setPostMediaPreviews] = useState<string[]>([]);

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
      setPostMediaFiles([]);
      postMediaPreviews.forEach((u) => URL.revokeObjectURL(u));
      setPostMediaPreviews([]);
      setCreateMediaFiles([]);
      createMediaPreviews.forEach((u) => URL.revokeObjectURL(u));
      setCreateMediaPreviews([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const canCreateSubmit = useMemo(() => {
    if (!title.trim()) return false;
    if (composeMode === "plan") return true;

    // Photos required for all non-plan types
    if (createMediaFiles.length === 0) return false;

    return (parseInt(amount) || 0) > 0;
  }, [title, amount, composeMode, createMediaFiles.length]);

  const canPostSubmit = useMemo(() => {
    return !!postText.trim() || !!taggedEntity || taggedPeople.length > 0 || postMediaFiles.length > 0;
  }, [postText, taggedEntity, taggedPeople.length, postMediaFiles.length]);

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
          mediaFiles: postMediaFiles,
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
        await onSubmitPlan?.({
          title: title.trim(),
          amount: parseInt(amount) || 0,
          date,
          mediaFiles: createMediaFiles,
        });
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
          mediaFiles: createMediaFiles,
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
      <div className="relative flex w-[240px] bg-gray-100 dark:bg-zinc-800 rounded-full p-1">
        {/* Sliding Background Pill */}
        <div
          className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white dark:bg-zinc-700 rounded-full shadow-sm transition-transform duration-300 cubic-bezier(0.4, 0, 0.2, 1) ${topMode === "create" ? "translate-x-0" : "translate-x-[calc(100%+8px)]"
            }`}
        />
        <button
          type="button"
          onClick={() => setTopMode("create")}
          className={`relative z-10 flex-1 py-2 text-sm font-bold rounded-full transition-colors duration-300 border-none bg-transparent ${topMode === "create" ? "text-black dark:text-white" : "text-gray-400 dark:text-gray-500"
            }`}
        >
          Create
        </button>
        <button
          type="button"
          onClick={() => setTopMode("post")}
          className={`relative z-10 flex-1 py-2 text-sm font-bold rounded-full transition-colors duration-300 border-none bg-transparent ${topMode === "post" ? "text-black dark:text-white" : "text-gray-400 dark:text-gray-500"
            }`}
        >
          Post
        </button>
      </div>
    </div>
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm fade-in">
      <button type="button" className="absolute inset-0 border-none bg-transparent" aria-label="Dismiss" onClick={onClose} />

      <div className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-t-3xl md:rounded-3xl p-5 modal-slide-up flex flex-col max-h-[90vh]">

        {/* Header & Toggle */}
        <div className="flex items-center justify-between mb-2">
          <p className="font-extrabold text-black dark:text-white text-lg">
            {topMode === "create" ? "Post Something" : "Share…"}
          </p>
          <button onClick={onClose} className="text-2xl text-gray-400 hover:text-black dark:hover:text-white bg-transparent border-none">
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
                  className="w-full bg-transparent text-black dark:text-white border border-gray-200 dark:border-zinc-800 rounded-2xl px-4 py-3 text-base resize-none h-24 focus:outline-none focus:border-black dark:focus:border-white transition-colors"
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
                    className="w-full bg-transparent text-black dark:text-white border border-gray-200 dark:border-zinc-800 rounded-2xl px-4 py-3 text-base focus:outline-none focus:border-black dark:focus:border-white transition-colors"
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
                    className="w-full bg-transparent text-black dark:text-white border border-gray-200 dark:border-zinc-800 rounded-2xl px-4 py-3 text-base resize-none h-24 focus:outline-none focus:border-black dark:focus:border-white transition-colors"
                    maxLength={240}
                  />
                </div>
              )}

              {/* Create mode media (up to 3) */}
              <div className="mb-1">
                {createMediaPreviews.length > 0 ? (
                  <ComposeMediaPreview
                    files={createMediaFiles}
                    previews={createMediaPreviews}
                    onRemoveAt={(i) => {
                      const removed = createMediaPreviews[i];
                      if (removed) URL.revokeObjectURL(removed);
                      setCreateMediaFiles((prev) => prev.filter((_, idx) => idx !== i));
                      setCreateMediaPreviews((prev) => prev.filter((_, idx) => idx !== i));
                    }}
                    onAddMore={() => createMediaInputRef.current?.click()}
                    maxItems={3}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => createMediaInputRef.current?.click()}
                    className="w-full bg-transparent py-4 border-2 border-dashed border-gray-200 dark:border-zinc-800 rounded-2xl flex items-center justify-center gap-2 text-gray-400 hover:border-gray-300 dark:hover:border-zinc-700 hover:text-gray-500 dark:hover:text-gray-300 transition-colors"
                  >
                    <ImageIcon size={20} />
                    <span className="text-sm font-medium">Add up to 3 photos / videos</span>
                  </button>
                )}
                <input
                  ref={createMediaInputRef}
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const incoming = Array.from(e.target.files || []);
                    if (incoming.length === 0) return;
                    const combined = [...createMediaFiles, ...incoming].slice(0, 3);
                    // Revoke any previews we're about to discard.
                    createMediaPreviews.forEach((u) => URL.revokeObjectURL(u));
                    setCreateMediaFiles(combined);
                    setCreateMediaPreviews(combined.map((f) => URL.createObjectURL(f)));
                    e.currentTarget.value = "";
                  }}
                />
              </div>

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
                    className="w-full bg-transparent text-black dark:text-white border border-gray-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-black dark:focus:border-white transition-colors"
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
                    className="w-full bg-transparent text-black dark:text-white border border-gray-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-black dark:focus:border-white transition-colors"
                  />
                </div>
              </div>

              {composeMode !== "sell" && composeMode !== "service" && composeMode !== "plan" && (
                <>
                  <div>
                    <p className="text-xs text-gray-400 mb-1 font-semibold">Date &amp; time</p>
                    <button
                      type="button"
                      onClick={() => setShowDatePicker(true)}
                      className="w-full bg-transparent text-black dark:text-white border border-gray-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-base font-semibold text-left focus:outline-none focus:border-black dark:focus:border-white transition-colors"
                    >
                      {describeDateTime(date)}
                    </button>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-1 font-semibold">Location</p>
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="Westlands, Nairobi"
                      className="w-full bg-transparent text-black dark:text-white border border-gray-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-black dark:focus:border-white transition-colors"
                    />
                  </div>
                </>
              )}

              {createError && <p className="text-sm text-red-600">{createError}</p>}

              {createMediaFiles.length === 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-sm text-amber-800 font-semibold flex items-start gap-2">
                  <span className="text-amber-500 mt-0.5">⚠️</span>
                  {composeMode === "sell" || composeMode === "service"
                    ? "At least 1 photo is required for listings."
                    : "At least 1 photo is required for functions."}
                </div>
              )}

              <button
                type="button"
                onClick={handleCreateSubmit}
                disabled={!canCreateSubmit || isSubmitting}
                className="w-full border-none py-4 bg-black dark:bg-white text-white dark:text-black rounded-2xl font-bold text-base disabled:opacity-40 transition-opacity"
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
                className="w-full bg-transparent flex-1 text-xl font-medium text-black dark:text-white outline-none resize-none placeholder-gray-300 dark:placeholder-gray-600 py-2"
                placeholder="What's going on?"
                value={postText}
                onChange={(e) => setPostText(e.target.value)}
              />

              {taggedEntity && (
                <div className="relative mt-auto mb-4 p-3 border border-gray-200 dark:border-zinc-800 rounded-2xl flex items-center gap-3 bg-gray-50/50 dark:bg-zinc-800/50">
                  <div className="w-10 h-10 bg-white dark:bg-zinc-800 shadow-sm border border-gray-100 dark:border-zinc-700 rounded-xl flex items-center justify-center text-black dark:text-white">
                    <Tag size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-black dark:text-white truncate">{taggedEntity.title}</p>
                    <p className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{taggedEntity.kind}</p>
                  </div>
                  <button
                    onClick={() => setTaggedEntity(null)}
                    className="w-8 h-8 border-none rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center text-gray-500 hover:bg-gray-200 dark:hover:bg-zinc-700"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}

              <div className="flex items-center gap-2 mt-auto pt-4 border-t border-gray-100 dark:border-zinc-800 pb-2">
                <input
                  ref={postMediaInputRef}
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    if (files.length === 0) return;
                    // Combine with existing, cap at 3.
                    const combined = [...postMediaFiles, ...files].slice(0, 3);
                    postMediaPreviews.forEach((u) => URL.revokeObjectURL(u));
                    const previews = combined.map((f) => URL.createObjectURL(f));
                    setPostMediaFiles(combined);
                    setPostMediaPreviews(previews);
                    e.currentTarget.value = "";
                  }}
                />
                <button
                  type="button"
                  onClick={() => postMediaInputRef.current?.click()}
                  className="w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center text-black hover:bg-gray-200 transition-colors"
                  aria-label="Add photo or video"
                  title="Add photo or video"
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
                  className="ml-auto border-none px-8 py-3 bg-black dark:bg-white text-white dark:text-black rounded-full font-bold disabled:opacity-50 tap-scale"
                >
                  {isSubmitting ? "Posting..." : "Post"}
                </button>
              </div>

              {postMediaPreviews.length > 0 && (
                <div className="mt-3 flex gap-2 overflow-x-auto">
                  {postMediaPreviews.map((u, idx) => (
                    <div key={u} className="relative w-20 h-20 rounded-2xl overflow-hidden border border-gray-100 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900 flex-shrink-0">
                      {postMediaFiles[idx]?.type.startsWith("video/") ? (
                        <video src={u} className="w-full h-full object-cover" muted playsInline />
                      ) : (
                        <img src={u} alt="" className="w-full h-full object-cover" draggable={false} />
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          const nextFiles = postMediaFiles.filter((_, i) => i !== idx);
                          const nextPreviews = postMediaPreviews.filter((_, i) => i !== idx);
                          URL.revokeObjectURL(u);
                          setPostMediaFiles(nextFiles);
                          setPostMediaPreviews(nextPreviews);
                        }}
                        className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-black/70 text-white flex items-center justify-center"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
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
      <DateTimePickerModal
        open={showDatePicker}
        value={date}
        onClose={() => setShowDatePicker(false)}
        onApply={setDate}
      />
    </div>
  );
}

/**
 * Swipeable preview for the up-to-3 media slots in Create mode.
 * Mirrors the storefront/feed carousel UX (drag, dots) so what you see
 * while composing matches what people see on your profile.
 */
function ComposeMediaPreview({
  files,
  previews,
  onRemoveAt,
  onAddMore,
  maxItems,
}: {
  files: File[];
  previews: string[];
  onRemoveAt: (i: number) => void;
  onAddMore: () => void;
  maxItems: number;
}) {
  const [idx, setIdx] = useState(0);
  const dragX = useRef<number | null>(null);
  const total = previews.length;

  // Keep idx in range when items are removed.
  useEffect(() => {
    if (idx > total - 1) setIdx(Math.max(0, total - 1));
  }, [idx, total]);

  const go = (next: number) => {
    setIdx(Math.max(0, Math.min(total - 1, next)));
  };

  const active = previews[idx];
  const activeFile = files[idx];
  if (!active || !activeFile) return null;
  const isVid = activeFile.type.startsWith("video/");
  const canAddMore = total < maxItems;

  return (
    <div
      className="relative rounded-2xl overflow-hidden bg-gray-100 dark:bg-zinc-800"
      onPointerDown={(e) => {
        dragX.current = e.clientX;
      }}
      onPointerUp={(e) => {
        if (dragX.current == null) return;
        const dx = e.clientX - dragX.current;
        dragX.current = null;
        if (Math.abs(dx) < 40) return;
        if (dx < 0) go(idx + 1);
        else go(idx - 1);
      }}
    >
      <div className="relative w-full aspect-[4/5] bg-black select-none">
        {isVid ? (
          <video
            key={active}
            src={active}
            className="absolute inset-0 w-full h-full object-cover"
            muted
            playsInline
            autoPlay
            loop
          />
        ) : (
          <img
            src={active}
            alt=""
            draggable={false}
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}

        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRemoveAt(idx);
          }}
          className="absolute top-2 right-2 w-8 h-8 bg-black/60 rounded-full flex items-center justify-center text-white border-none"
          aria-label="Remove this media"
        >
          <X size={16} />
        </button>

        <div className="absolute top-2 left-2 px-2 py-1 rounded-full bg-black/60 text-white text-[11px] font-bold">
          {idx + 1}/{total}
        </div>

        {canAddMore && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onAddMore();
            }}
            className="absolute bottom-2 right-2 px-3 h-8 rounded-full bg-white/95 text-black text-xs font-extrabold flex items-center gap-1 border-none shadow"
          >
            <ImageIcon size={14} /> Add
          </button>
        )}
      </div>

      {total > 1 && (
        <div className="absolute bottom-2 left-0 right-0 flex items-center justify-center gap-1.5 pointer-events-none">
          {previews.map((_, i) => (
            <span
              key={i}
              className={[
                "w-1.5 h-1.5 rounded-full transition-colors",
                i === idx ? "bg-white" : "bg-white/40",
              ].join(" ")}
            />
          ))}
        </div>
      )}
    </div>
  );
}

