import type { DmMessage } from "../../lib/supabase";
import { haptics } from "../../lib/haptics";

function getSmartReplies(lastMessage: DmMessage | null): string[] {
  if (!lastMessage) return [];
  
  // Charge bubble — contextual payment replies
  if (lastMessage.message_type === "charge") {
    const payload = lastMessage.payload as { charge_id?: string } | null;
    if (payload?.charge_id) {
      return ["On my way!", "Just paid!", "Can we negotiate?"];
    }
    return [];
  }
  
  if (lastMessage.message_type === "share") return [];

  const content = lastMessage.content.toLowerCase();

  if (/paid|payment|ksh|sent you/i.test(content)) {
    return ["Thanks!", "Received!", "Got it"];
  }
  if (content.includes("?")) {
    return ["Yes!", "No, sorry", "Let me check"];
  }
  if (/join|coming|event|function|plan/i.test(content)) {
    return ["I'm in!", "Can't make it", "What time?"];
  }
  if (/how much|price|cost|ksh/i.test(content)) {
    return ["That works!", "Can you do less?", "I'll take it"];
  }
  if (/^hey\b|^hi\b|^hello\b|^sup\b|^hii\b/i.test(content.trim())) {
    return ["Hey!", "What's up?", "Heyy"];
  }
  return [];
}

export function SmartReplies({
  lastMessage,
  onSelect,
}: {
  lastMessage: DmMessage | null;
  onSelect: (text: string) => void;
}) {
  const replies = getSmartReplies(lastMessage);
  if (replies.length === 0) return null;

  return (
    <div className="flex gap-2 px-4 pb-2 overflow-x-auto scrollbar-none max-w-full">
      {replies.map((r) => (
        <button
          key={r}
          type="button"
          onClick={() => {
            haptics.light();
            onSelect(r);
          }}
          className="shrink-0 px-4 py-2 bg-white border border-gray-200 rounded-full text-sm font-semibold text-black whitespace-nowrap shadow-sm tap-scale"
        >
          {r}
        </button>
      ))}
    </div>
  );
}
