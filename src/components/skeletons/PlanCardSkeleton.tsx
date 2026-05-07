import { Skeleton } from "../ui/skeleton";

export function PlanCardSkeleton() {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <Skeleton className="w-9 h-9 rounded-full" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-3 w-1/2 rounded-full" />
          <Skeleton className="h-2.5 w-1/4 rounded-full" />
        </div>
      </div>
      <Skeleton className="h-5 w-3/4 rounded-full mb-3" />
      <div className="flex gap-2 mb-3">
        <Skeleton className="h-7 w-20 rounded-full" />
        <Skeleton className="h-7 w-16 rounded-full" />
      </div>
      <Skeleton className="h-10 w-full rounded-xl" />
    </div>
  );
}
