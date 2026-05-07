import type { ReactNode } from "react";

export type SegmentedTab<Id extends string> = {
  id: Id;
  label: string;
  icon: ReactNode;
};

/**
 * Frosted segmented control matching Post Something tabs.
 * - Icon above label
 * - Sliding black thumb
 */
export function SegmentedTabsBar<Id extends string>({
  value,
  onChange,
  tabs,
  className = "",
}: {
  value: Id;
  onChange: (id: Id) => void;
  tabs: readonly SegmentedTab<Id>[];
  className?: string;
}) {
  const idx = Math.max(0, tabs.findIndex((t) => t.id === value));
  const n = Math.max(1, tabs.length);

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
          left: `calc(${idx * (100 / n)}% + 5px)`,
          width: `calc(${100 / n}% - 10px)`,
        }}
      />

      <div className="relative h-full flex items-center z-30">
        {tabs.map((tab) => {
          const isLit = tab.id === value;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className="flex-1 relative flex flex-col items-center justify-center gap-0.5 h-full cursor-pointer bg-transparent border-none"
            >
              <span className={isLit ? "text-white" : "text-gray-400"}>{tab.icon}</span>
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

