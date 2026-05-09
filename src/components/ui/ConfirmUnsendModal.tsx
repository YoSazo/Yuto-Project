import { Trash2 } from "lucide-react";

export function ConfirmUnsendModal({
  open,
  title = "Delete this message?",
  confirmLabel = "Unsend",
  onConfirm,
  onClose,
}: {
  open: boolean;
  title?: string;
  confirmLabel?: string;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end md:items-center justify-center fade-in bg-black/60 backdrop-blur-sm">
      <button
        type="button"
        className="absolute inset-0 z-0 cursor-default border-none bg-transparent"
        aria-label="Dismiss"
        onClick={onClose}
      />
      <div className="relative z-10 bg-white dark:bg-zinc-900 rounded-t-3xl md:rounded-3xl w-full max-w-md p-5 modal-slide-up transition-colors">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-2xl bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
            <Trash2 size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-extrabold text-black dark:text-white text-lg">{title}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-semibold">This will remove it for everyone.</p>
          </div>
        </div>

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-12 rounded-2xl bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-black dark:text-white font-extrabold transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void onConfirm()}
            className="flex-1 h-12 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-extrabold transition-colors"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

