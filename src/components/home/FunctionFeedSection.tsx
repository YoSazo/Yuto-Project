import type { FunctionListing } from "../../pages/home/types";
import type { DmSharePayload } from "../../lib/supabase";
import { PeopleListModal } from "../PeopleListModal";
import { useMemo, useState } from "react";
import { FunctionCard } from "../cards/FunctionCard";
import { FunctionCardSkeleton } from "../skeletons/FunctionCardSkeleton";

export function FunctionFeedSection({
  functionsFeed,
  loading = false,
  currentUserId,
  functionUnreadCounts,
  onNavigateToHost,
  onOpenFunctionThread,
  onOpenFunctionAttendeeChat,
  onJoinFunction,
  onOpenTicket,
  onShareInMessages,
  onDuplicateFunction,
}: {
  functionsFeed: FunctionListing[];
  loading?: boolean;
  currentUserId?: string;
  functionUnreadCounts: Record<string, number>;
  onNavigateToHost: (hostUserId: string) => void;
  onOpenFunctionThread: (f: FunctionListing) => void;
  onOpenFunctionAttendeeChat?: (f: FunctionListing) => void;
  onJoinFunction: (f: FunctionListing) => void;
  onOpenTicket: (f: FunctionListing) => void;
  onShareInMessages?: (payload: DmSharePayload) => void;
  onDuplicateFunction?: (f: FunctionListing) => void;
}) {
  const [peopleModal, setPeopleModal] = useState<{ functionId: string; title: string } | null>(null);

  const events = useMemo(
    () => functionsFeed.filter((f) => f.location !== "__SELL__" && f.location !== "__SERVICE__"),
    [functionsFeed],
  );
  const marketplace = useMemo(
    () => functionsFeed.filter((f) => f.location === "__SELL__" || f.location === "__SERVICE__"),
    [functionsFeed],
  );

  const functionPeople = useMemo(() => {
    if (!peopleModal) return [];
    const f = functionsFeed.find((x) => x.id === peopleModal.functionId);
    const fm = f?.function_members ?? [];
    const unique = new Map<string, (typeof fm)[number]["profiles"]>();
    fm.forEach((m) => unique.set(m.profiles.id, m.profiles));
    return Array.from(unique.values());
  }, [peopleModal, functionsFeed]);

  if (loading && functionsFeed.length === 0) {
    return (
      <div className="mb-6 flex flex-col gap-4">
        <FunctionCardSkeleton />
        <FunctionCardSkeleton />
      </div>
    );
  }
  if (functionsFeed.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="flex flex-col gap-4 mb-6">
        {marketplace.length > 0 && (
          <>
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Marketplace</p>
              <span className="text-xs text-gray-400">Buy &amp; book</span>
            </div>
            {marketplace.map((eventFunction) => (
              <FunctionCard
                key={eventFunction.id}
                eventFunction={eventFunction}
                currentUserId={currentUserId}
                unreadCount={functionUnreadCounts[eventFunction.id] || 0}
                onNavigateToHost={onNavigateToHost}
                onOpenFunctionThread={onOpenFunctionThread}
                onOpenFunctionAttendeeChat={onOpenFunctionAttendeeChat}
                onJoinFunction={onJoinFunction}
                onOpenTicket={onOpenTicket}
                onOpenPeople={(functionId, title) => setPeopleModal({ functionId, title })}
                onShareInMessages={onShareInMessages}
                onDuplicate={onDuplicateFunction}
              />
            ))}
          </>
        )}

        {events.length > 0 && (
          <>
            <div className="flex items-center justify-between mt-2 mb-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Functions</p>
              <span className="text-xs text-gray-400">Hosted now</span>
            </div>
            {events.map((eventFunction) => (
              <FunctionCard
                key={eventFunction.id}
                eventFunction={eventFunction}
                currentUserId={currentUserId}
                unreadCount={functionUnreadCounts[eventFunction.id] || 0}
                onNavigateToHost={onNavigateToHost}
                onOpenFunctionThread={onOpenFunctionThread}
                onOpenFunctionAttendeeChat={onOpenFunctionAttendeeChat}
                onJoinFunction={onJoinFunction}
                onOpenTicket={onOpenTicket}
                onOpenPeople={(functionId, title) => setPeopleModal({ functionId, title })}
                onShareInMessages={onShareInMessages}
                onDuplicate={onDuplicateFunction}
              />
            ))}
          </>
        )}
      </div>

      <PeopleListModal
        open={!!peopleModal}
        title={peopleModal?.title ?? "Going"}
        people={functionPeople}
        onClose={() => setPeopleModal(null)}
        onNavigateToUser={(userId) => onNavigateToHost(userId)}
      />
    </div>
  );
}
