import { Briefcase, ClipboardList, PartyPopper, Store } from "lucide-react";
import { SegmentedTabsBar } from "../ui/SegmentedTabsBar";

export type ComposeMode = "plan" | "function" | "sell" | "service";

const composeTabs = [
  { id: "plan" as const, label: "Plan", icon: <ClipboardList size={18} /> },
  // Functions, Sell, Services hidden for v1
  // { id: "function" as const, label: "Function", icon: <PartyPopper size={18} /> },
  // { id: "sell" as const, label: "Sell", icon: <Store size={18} /> },
  // { id: "service" as const, label: "Services", icon: <Briefcase size={18} /> },
] as const;

/** Matches the Post Something segmented control — shared with inbox “Send…” picker. */
export function ComposeModeTabsBar({
  composeMode,
  onComposeModeChange,
  className = "",
}: {
  composeMode: ComposeMode;
  onComposeModeChange: (mode: ComposeMode) => void;
  /** e.g. `mt-3` below a title */
  className?: string;
}) {
  return <SegmentedTabsBar value={composeMode} onChange={onComposeModeChange} tabs={composeTabs} className={className} />;
}
