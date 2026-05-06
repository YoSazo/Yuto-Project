import type { GroupChatRow } from "./supabase";

const GENERIC_TITLE = /^group\s*chat$/i;

/** Whether the stored title counts as “unnamed” (default / generic label). */
export function isGenericGroupChatTitle(raw: string | null | undefined): boolean {
  const t = (raw ?? "").trim();
  return !t || GENERIC_TITLE.test(t);
}

/** Labels for picker / inbox lists: custom titles as-is; multiple unnamed → “Group chat”, “Group chat 1”, … */
export function buildGroupChatPickerLabels(groupsInOrder: GroupChatRow[]): Record<string, string> {
  const out: Record<string, string> = {};
  let genericIndex = 0;
  for (const g of groupsInOrder) {
    if (!isGenericGroupChatTitle(g.title)) {
      out[g.id] = (g.title ?? "").trim();
      continue;
    }
    out[g.id] = genericIndex === 0 ? "Group chat" : `Group chat ${genericIndex}`;
    genericIndex++;
  }
  return out;
}
