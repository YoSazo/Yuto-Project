import { useState, useEffect } from "react";
import { X, Gift } from "lucide-react";

/**
 * Subtle "Invite a friend, earn KSH 50" banner that auto-dismisses after 4 seconds.
 * Show this after key actions: joining a function, paying a split, buying something.
 * 
 * Usage: <InviteBanner show={showBanner} username={username} onDismiss={() => setShowBanner(false)} />
 */
export function InviteBanner({
  show,
  username,
  onDismiss,
}: {
  show: boolean;
  username: string;
  onDismiss: () => void;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (show) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        onDismiss();
      }, 4000);
      return () => clearTimeout(timer);
    } else {
      setVisible(false);
    }
  }, [show, onDismiss]);

  if (!visible) return null;

  const referralUrl = `https://yuto.social/r/${username}`;

  const handleTap = () => {
    const text = `${referralUrl}\n\nJoin me on Yuto! I earn KSH 50 when you sign up. You can earn KSH 50 too by inviting your friends. Game on \uD83C\uDFAE`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
    setVisible(false);
    onDismiss();
  };

  return (
    <div className="fixed bottom-20 left-4 right-4 z-40 animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div
        onClick={handleTap}
        className="bg-gradient-to-r from-orange-500 to-pink-500 rounded-2xl px-4 py-3 flex items-center gap-3 shadow-xl cursor-pointer active:scale-[0.98] transition-transform"
      >
        <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center shrink-0">
          <Gift size={18} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-sm">Invite a friend, earn KSH 50</p>
          <p className="text-white/70 text-xs">Tap to share on WhatsApp</p>
        </div>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setVisible(false); onDismiss(); }}
          className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center shrink-0 border-none"
        >
          <X size={14} className="text-white" />
        </button>
      </div>
    </div>
  );
}
