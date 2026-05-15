import { useState } from "react";
import { supabase } from "../../lib/supabase";
import { toast } from "sonner";

interface SupportTicketModalProps {
  open: boolean;
  onClose: () => void;
  transactionId?: string;
}

const CATEGORIES = [
  { value: "payment_issue", label: "Payment issue" },
  { value: "account_access", label: "Can't access my account" },
  { value: "dispute", label: "Dispute with another user" },
  { value: "bug_report", label: "Something isn't working" },
  { value: "feature_request", label: "Feature suggestion" },
  { value: "other", label: "Other" },
];

export function SupportTicketModal({ open, onClose, transactionId }: SupportTicketModalProps) {
  const [category, setCategory] = useState(transactionId ? "payment_issue" : "");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!open) return null;

  const handleSubmit = async () => {
    if (!category || !subject.trim() || !description.trim()) {
      toast.error("Please fill out all fields");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.rpc("create_support_ticket", {
        p_category: category,
        p_subject: subject.trim(),
        p_description: description.trim(),
        p_transaction_id: transactionId || null,
      });

      if (error) throw error;
      setSubmitted(true);
      toast.success("Support ticket submitted!");
    } catch (err: any) {
      toast.error(err.message || "Failed to submit ticket");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setCategory("");
    setSubject("");
    setDescription("");
    setSubmitted(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm">
      <button type="button" className="absolute inset-0 border-none bg-transparent" onClick={handleClose} />
      <div className="relative z-10 w-full max-w-md bg-white dark:bg-zinc-900 rounded-t-3xl md:rounded-3xl p-6 max-h-[85vh] overflow-y-auto">
        {submitted ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-4">✅</div>
            <h2 className="text-xl font-bold text-black dark:text-white mb-2">Ticket Submitted</h2>
            <p className="text-sm text-gray-500 mb-6">
              We'll get back to you within 24 hours at the email associated with your account.
            </p>
            <button
              type="button"
              onClick={handleClose}
              className="w-full py-3 bg-black dark:bg-white text-white dark:text-black rounded-xl font-bold text-sm border-none"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <h2 className="text-xl font-bold text-black dark:text-white mb-1">Get Help</h2>
            <p className="text-sm text-gray-400 mb-5">Describe your issue and we'll respond within 24 hours.</p>

            {/* Category */}
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Category</label>
            <div className="space-y-1.5 mb-4">
              {CATEGORIES.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setCategory(c.value)}
                  className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all border-none ${
                    category === c.value
                      ? "bg-black dark:bg-white text-white dark:text-black"
                      : "bg-gray-50 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>

            {/* Subject */}
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Brief summary of your issue"
              maxLength={100}
              className="w-full bg-gray-50 dark:bg-zinc-800 text-black dark:text-white border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm mb-4"
            />

            {/* Description */}
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tell us what happened, what you expected, and any relevant details..."
              maxLength={1000}
              rows={4}
              className="w-full bg-gray-50 dark:bg-zinc-800 text-black dark:text-white border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm mb-4 resize-none"
            />

            {transactionId && (
              <p className="text-xs text-gray-400 mb-4">
                📎 Transaction ID attached: {transactionId.slice(0, 8)}...
              </p>
            )}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !category || !subject.trim() || !description.trim()}
              className="w-full py-3.5 bg-black dark:bg-white text-white dark:text-black rounded-xl font-bold text-sm disabled:opacity-40 border-none"
            >
              {submitting ? "Submitting..." : "Submit Ticket"}
            </button>

            <button
              type="button"
              onClick={handleClose}
              className="w-full py-3 mt-2 text-gray-400 font-semibold text-sm bg-transparent border-none"
            >
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  );
}
