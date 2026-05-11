// Template: New Bottom Sheet Modal
// Copy to src/components/MyNewModal.tsx

import { X } from "lucide-react";

export function MyNewModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end md:items-center justify-center z-50 fade-in">
      <button type="button" className="absolute inset-0 border-none bg-transparent" onClick={onClose} />
      <div className="relative bg-white dark:bg-zinc-900 rounded-t-3xl md:rounded-3xl w-full max-w-md p-6 modal-slide-up max-h-[85vh] flex flex-col transition-colors">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-bold text-xl text-black dark:text-white">Title</h2>
          <button type="button" onClick={onClose} className="text-2xl text-gray-400 hover:text-black dark:hover:text-white bg-transparent border-none">
            <X size={22} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Content here */}
        </div>
      </div>
    </div>
  );
}
