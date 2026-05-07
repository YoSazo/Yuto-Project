import { Skeleton } from "../ui/skeleton";

export function FunctionCardSkeleton() {
  return (
    <div className="w-full rounded-3xl p-4 bg-black">
      <div className="flex items-center gap-2 mb-3">
        <Skeleton className="w-9 h-9 rounded-full bg-white/10" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-3 w-2/3 rounded-full bg-white/10" />
          <Skeleton className="h-2.5 w-1/3 rounded-full bg-white/10" />
        </div>
      </div>
      <Skeleton className="h-6 w-3/4 rounded-full bg-white/10 mb-2" />
      <Skeleton className="aspect-[4/5] w-full rounded-xl bg-white/10 mb-3" />
      <div className="flex gap-2 mb-4">
        <Skeleton className="h-8 w-24 rounded-full bg-white/10" />
        <Skeleton className="h-8 w-20 rounded-full bg-white/10" />
      </div>
      <div className="flex items-center justify-between pt-3 border-t border-white/10">
        <Skeleton className="h-3 w-24 rounded-full bg-white/10" />
        <Skeleton className="h-10 w-28 rounded-xl bg-white/15" />
      </div>
    </div>
  );
}
