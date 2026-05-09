import { useEffect, useMemo, useState } from "react";
import UserAvatar from "../UserAvatar";

type Person = { id: string; username: string; display_name: string; avatar_url: string | null };

export function PostPeoplePickerModal({
  open,
  onClose,
  currentUserId,
  selectedIds,
  onChangeSelected,
}: {
  open: boolean;
  onClose: () => void;
  currentUserId: string | null;
  selectedIds: string[];
  onChangeSelected: (people: Person[]) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [friends, setFriends] = useState<Person[]>([]);

  useEffect(() => {
    if (!open) return;
    if (!currentUserId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { getFriends } = await import("../../lib/supabase");
        const data = await getFriends(currentUserId);
        if (cancelled) return;
        const list = (data as any[])
          .map((f) => (f.requester_id === currentUserId ? f.addressee : f.requester))
          .filter(Boolean)
          .map((p) => ({
            id: p.id,
            username: p.username,
            display_name: p.display_name,
            avatar_url: p.avatar_url ?? null,
          })) as Person[];
        setFriends(list);
      } catch (e) {
        console.error(e);
        if (!cancelled) setFriends([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, currentUserId]);

  const selectedPeople = useMemo(() => {
    const map = new Map(friends.map((p) => [p.id, p]));
    return selectedIds.map((id) => map.get(id)).filter(Boolean) as Person[];
  }, [friends, selectedIds]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center fade-in bg-black/60 backdrop-blur-sm">
      <button
        type="button"
        className="absolute inset-0 z-0 cursor-default border-none bg-transparent"
        aria-label="Dismiss"
        onClick={onClose}
      />

      <div className="relative z-10 bg-white dark:bg-zinc-900 rounded-t-3xl md:rounded-3xl w-full max-w-md p-5 modal-slide-up transition-colors">
        <div className="flex items-center justify-between mb-4">
          <p className="font-extrabold text-black dark:text-white text-lg">Tag people</p>
          <button onClick={onClose} className="text-2xl text-gray-400 hover:text-black dark:hover:text-white bg-transparent border-none">
            ✕
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-black dark:border-white border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="max-h-[55vh] overflow-y-auto -mx-1 px-1">
            {friends.map((p) => {
              const picked = selectedIds.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    const nextIds = picked ? selectedIds.filter((x) => x !== p.id) : [...selectedIds, p.id];
                    const nextPeople = nextIds
                      .map((id) => friends.find((x) => x.id === id))
                      .filter(Boolean) as Person[];
                    onChangeSelected(nextPeople);
                  }}
                  className={`w-full flex items-center gap-3 py-3 px-2 rounded-2xl hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors text-left bg-transparent border-none ${
                    picked ? "bg-gray-50 dark:bg-zinc-800" : ""
                  }`}
                >
                  <UserAvatar name={p.display_name || p.username} avatarUrl={p.avatar_url} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-black dark:text-white truncate">{p.display_name || p.username}</p>
                    <p className="text-sm text-gray-400 dark:text-gray-500 truncate">@{p.username}</p>
                  </div>
                  <div
                    className={`w-5 h-5 rounded-full border-2 ${picked ? "bg-black border-black dark:bg-white dark:border-white" : "border-gray-300 dark:border-zinc-600"}`}
                  />
                </button>
              );
            })}
            {friends.length === 0 && <div className="py-10 text-center text-gray-400 font-semibold">No friends yet</div>}
          </div>
        )}

        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => onChangeSelected([])}
            className="flex-1 h-12 rounded-full bg-gray-100 dark:bg-zinc-800 text-black dark:text-white font-extrabold hover:bg-gray-200 dark:hover:bg-zinc-700"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-12 rounded-full bg-black dark:bg-white text-white dark:text-black font-extrabold"
          >
            Done{selectedPeople.length > 0 ? ` (${selectedPeople.length})` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}

