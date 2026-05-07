import { useEffect, useState } from "react";
import type { StorefrontListingItem } from "../../lib/supabase";
import {
  getOrCreateDmConversation,
  sendDmMessage,
  sendDmShareMessage,
  upsertDmBusinessContext,
} from "../../lib/supabase";
import { MessageCircle } from "lucide-react";

/** Same shell as ShareRecipientsSheet: backdrop, rounded sheet, textarea + Send — but DM is fixed to seller. Listing card first in chat, then optional message text. */
export function ListingInquiryToSellerModal({
  open,
  onClose,
  buyerUserId,
  sellerUserId,
  listing,
  onSent,
}: {
  open: boolean;
  onClose: () => void;
  buyerUserId: string;
  sellerUserId: string;
  listing: StorefrontListingItem | null;
  onSent?: (conversationId: string) => void;
}) {
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!open) return;
    setNote("");
    setErr("");
    setSending(false);
  }, [open, listing?.id]);

  if (!open || !listing) return null;

  const isSell = listing.kind === "sell";
  const kindLabel = isSell ? "Sell" : "Service";

  const onSend = async () => {
    setSending(true);
    setErr("");
    try {
      const convo = await getOrCreateDmConversation(buyerUserId, sellerUserId);
      const trimmed = note.trim();

      await sendDmShareMessage(convo.id, buyerUserId, {
        kind: "listing",
        function_id: listing.id,
        listing_kind: listing.kind,
      } as any);

      if (trimmed) {
        await sendDmMessage(convo.id, buyerUserId, trimmed);
      }

      await upsertDmBusinessContext({
        conversation_id: convo.id,
        provider_id: sellerUserId,
        buyer_id: buyerUserId,
        function_id: listing.id,
        listing_kind: listing.kind,
        listing_title: listing.title,
      }).catch(() => {});

      onSent?.(convo.id);
      onClose();
    } catch (e) {
      console.error(e);
      setErr(e instanceof Error ? e.message : "Couldn't send. Try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-end md:items-center justify-center z-[60] fade-in"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div className="bg-white rounded-t-3xl md:rounded-3xl w-full max-w-md max-h-[min(92vh,720px)] flex flex-col modal-slide-up shadow-xl">
        <div className="flex justify-between items-start gap-3 p-6 pb-2 shrink-0 border-b border-gray-100">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gray-100 text-black flex items-center justify-center shrink-0">
              <MessageCircle size={20} strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-xl text-black truncate">Message about this listing</h2>
              <p className="text-xs text-gray-400 font-semibold truncate">{kindLabel}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-2xl text-gray-400 hover:text-black bg-transparent border-none shrink-0 leading-none" aria-label="Close">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
          <div className="rounded-3xl border border-gray-100 bg-white shadow-sm overflow-hidden">
            <div className="aspect-[4/3] bg-gray-100 relative">
              {listing.image_url ? (
                <img src={listing.image_url} alt="" className="absolute inset-0 w-full h-full object-cover" draggable={false} />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-gray-300 text-sm font-semibold">No image</div>
              )}
              <span className="absolute top-2 left-2 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-black/80 text-white">{kindLabel}</span>
            </div>
            <div className="p-4 border-t border-gray-100">
              <p className="font-extrabold text-black text-base leading-snug">{listing.title}</p>
              <p className="text-sm font-extrabold text-black mt-2">KSH {listing.amount_per_person.toLocaleString("en-KE")}</p>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-3 font-semibold px-0.5">They’ll see this listing card in chat, then your message below.</p>
        </div>

        <div className="shrink-0 border-t border-gray-100 px-6 py-4 space-y-3 bg-white">
          <label className="sr-only" htmlFor="listing-inquiry-note">
            Your message
          </label>
          <textarea
            id="listing-inquiry-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ask a question or say hi…"
            rows={4}
            maxLength={1200}
            disabled={sending}
            className="w-full min-h-[5.25rem] resize-none rounded-[1.75rem] bg-gray-100 px-4 py-3.5 font-semibold text-sm text-black placeholder:text-gray-400 outline-none ring-2 ring-transparent focus:ring-black/15 disabled:opacity-50"
          />
          {err && <p className="text-sm text-red-500 font-semibold text-center">{err}</p>}
          <button
            type="button"
            onClick={() => void onSend()}
            disabled={sending}
            className={`w-full py-4 rounded-full font-bold text-lg transition-all tap-scale ${
              !sending ? "bg-black text-white active:scale-[0.98]" : "bg-gray-100 text-gray-400 cursor-not-allowed"
            }`}
          >
            {sending ? "Sending…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
