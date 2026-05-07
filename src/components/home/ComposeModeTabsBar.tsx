import { Briefcase, ClipboardList, PartyPopper, Store } from "lucide-react";

export type ComposeMode = "plan" | "function" | "sell" | "service";

const composeTabs = [
  { id: "plan" as const, label: "Plan", Icon: ClipboardList },
  { id: "function" as const, label: "Function", Icon: PartyPopper },
  { id: "sell" as const, label: "Sell", Icon: Store },
  { id: "service" as const, label: "Services", Icon: Briefcase },
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
  return (
    <div className={`relative h-[54px] w-full ${className}`}>
      <div
        className="absolute inset-0 rounded-full overflow-hidden border border-gray-200"
        style={{
          background: "rgba(255, 255, 255, 0.7)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          boxShadow: "0 4px 24px rgba(0, 0, 0, 0.06)",
        }}
      />

      <div
        className="absolute top-[5px] bottom-[5px] rounded-full bg-black z-20 transition-all duration-300 ease-out"
        style={{
          left: `calc(${composeTabs.findIndex((t) => t.id === composeMode) * 25}% + 5px)`,
          width: "calc(25% - 10px)",
        }}
      />

      <div className="relative h-full flex items-center z-30">
        {composeTabs.map((tab) => {
          const isLit = tab.id === composeMode;
          const Icon = tab.Icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onComposeModeChange(tab.id)}
              className="flex-1 relative flex flex-col items-center justify-center gap-0.5 h-full cursor-pointer bg-transparent border-none"
            >
              <Icon size={18} className={isLit ? "text-white" : "text-gray-400"} />
              <span className={`text-[10px] font-semibold transition-colors duration-200 ${isLit ? "text-white" : "text-gray-400"}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
