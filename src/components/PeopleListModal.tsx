import UserAvatar from "./UserAvatar";

type Person = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
};

export function PeopleListModal({
  open,
  title,
  people,
  onClose,
  onNavigateToUser,
}: {
  open: boolean;
  title: string;
  people: Person[];
  onClose: () => void;
  onNavigateToUser: (userId: string) => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center fade-in bg-black/60 backdrop-blur-sm">
      <button
        type="button"
        className="absolute inset-0 z-0 cursor-default border-none bg-transparent"
        aria-label="Dismiss"
        onClick={onClose}
      />

      <div className="relative z-10 bg-white rounded-t-3xl md:rounded-3xl w-full max-w-md p-5 modal-slide-up">
        <div className="flex items-center justify-between mb-4">
          <p className="font-extrabold text-black text-lg">{title}</p>
          <button onClick={onClose} className="text-2xl text-gray-400 hover:text-black bg-transparent border-none">
            ✕
          </button>
        </div>

        {people.length === 0 ? (
          <div className="py-10 text-center text-gray-400 font-semibold">No one yet</div>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto -mx-1 px-1">
            <div className="flex flex-col gap-1">
              {people.map((p) => (
                <div key={p.id} className="flex items-center gap-2 py-2.5 px-1">
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onNavigateToUser(p.id);
                    }}
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl py-1 pr-2 text-left transition-colors hover:bg-gray-50 bg-transparent border-none"
                  >
                    <UserAvatar name={p.display_name} avatarUrl={p.avatar_url} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-black truncate">{p.display_name}</p>
                      <p className="text-sm text-gray-400 truncate">@{p.username}</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onNavigateToUser(p.id);
                    }}
                    className="shrink-0 rounded-xl bg-gray-100 px-3 py-2.5 text-sm font-bold text-black transition-colors hover:bg-gray-200"
                  >
                    View profile
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

