import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import UserAvatar from "../components/UserAvatar";
import { supabase } from "../lib/supabase";

type PersonRow = { id: string; username: string; display_name: string; avatar_url: string | null };

export default function GroupChatMembersScreen() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const [title, setTitle] = useState("Members");
  const [loading, setLoading] = useState(true);
  const [people, setPeople] = useState<PersonRow[]>([]);

  useEffect(() => {
    if (!groupId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [{ data: meta }, { data: rows }] = await Promise.all([
          supabase.from("group_chats").select("title").eq("id", groupId).maybeSingle(),
          supabase
            .from("group_chat_members")
            .select("profiles(id, username, display_name, avatar_url)")
            .eq("group_chat_id", groupId),
        ]);
        if (cancelled) return;
        setTitle((meta?.title || "Members").trim() || "Members");
        const p =
          (rows || [])
            .map((r: any) => r.profiles)
            .filter(Boolean)
            .map((x: any) => ({
              id: String(x.id),
              username: String(x.username || ""),
              display_name: String(x.display_name || x.username || "User"),
              avatar_url: (x.avatar_url as string | null) ?? null,
            })) || [];
        setPeople(p);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [groupId]);

  return (
    <div className="min-h-[100dvh] bg-white px-5 pt-6 pb-8">
      <div className="flex items-center gap-3 mb-6">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center shrink-0"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="min-w-0">
          <p className="font-extrabold text-black truncate">{title}</p>
          <p className="text-xs text-gray-400">Members</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin" />
        </div>
      ) : people.length === 0 ? (
        <div className="py-16 text-center text-gray-400 font-semibold">No members yet</div>
      ) : (
        <div className="flex flex-col gap-2">
          {people.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => navigate(`/user/${p.id}`)}
              className="w-full rounded-2xl border border-gray-100 bg-white shadow-sm px-3 py-3 text-left flex items-center gap-3 hover:bg-gray-50 transition-colors"
            >
              <UserAvatar name={p.display_name} avatarUrl={p.avatar_url} size="md" />
              <div className="min-w-0 flex-1">
                <p className="font-extrabold text-black truncate">{p.display_name}</p>
                <p className="text-sm text-gray-400 truncate">@{p.username}</p>
              </div>
              <span className="text-xs font-bold text-gray-400">View</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

