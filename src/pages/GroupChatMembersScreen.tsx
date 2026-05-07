import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import UserAvatar from "../components/UserAvatar";
import { useAuth } from "../contexts/AuthContext";
import { createGroup, getOrCreateDmConversation, sendDmMessage, sendDmShareMessage, supabase } from "../lib/supabase";

type PersonRow = { id: string; username: string; display_name: string; avatar_url: string | null };

export default function GroupChatMembersScreen() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [title, setTitle] = useState("Members");
  const [loading, setLoading] = useState(true);
  const [people, setPeople] = useState<PersonRow[]>([]);
  const [requesting, setRequesting] = useState<PersonRow | null>(null);
  const [amountKes, setAmountKes] = useState("");
  const [memo, setMemo] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
            <div
              key={p.id}
              className="w-full rounded-2xl border border-gray-100 bg-white shadow-sm px-3 py-3 text-left flex items-center gap-3"
            >
              <button
                type="button"
                onClick={() => navigate(`/user/${p.id}`)}
                className="flex items-center gap-3 min-w-0 flex-1 bg-transparent border-none p-0 text-left hover:opacity-80 transition-opacity"
              >
                <UserAvatar name={p.display_name} avatarUrl={p.avatar_url} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="font-extrabold text-black truncate">{p.display_name}</p>
                  <p className="text-sm text-gray-400 truncate">@{p.username}</p>
                </div>
              </button>
              {user && p.id !== user.id && (
                <button
                  type="button"
                  onClick={() => {
                    setRequesting(p);
                    setAmountKes("");
                    setMemo("");
                  }}
                  className="shrink-0 h-10 px-4 rounded-2xl bg-black hover:bg-gray-800 text-white font-extrabold transition-colors"
                >
                  Request
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {requesting && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center fade-in bg-black/60 backdrop-blur-sm">
          <button
            type="button"
            className="absolute inset-0 z-0 cursor-default border-none bg-transparent"
            aria-label="Dismiss"
            onClick={() => setRequesting(null)}
          />
          <div className="relative z-10 bg-white rounded-t-3xl md:rounded-3xl w-full max-w-md p-5 modal-slide-up">
            <p className="font-extrabold text-black text-lg">Request a split</p>
            <p className="text-sm text-gray-500 mt-1 font-semibold">
              Ask <span className="font-extrabold text-black">{requesting.display_name}</span> to pay you back.
            </p>

            <div className="mt-4">
              <p className="text-xs text-gray-400 mb-1 font-semibold">Amount (KSH)</p>
              <input
                value={amountKes}
                onChange={(e) => setAmountKes(e.target.value.replace(/[^\d]/g, ""))}
                inputMode="numeric"
                placeholder="500"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-xl font-extrabold focus:outline-none focus:border-black transition-colors"
              />
            </div>
            <div className="mt-3">
              <p className="text-xs text-gray-400 mb-1 font-semibold">Memo</p>
              <input
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="Uber, drinks, coffee…"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base font-semibold focus:outline-none focus:border-black transition-colors"
              />
            </div>

            <button
              type="button"
              disabled={submitting || !user || !Number(amountKes)}
              onClick={async () => {
                if (!user) return;
                const target = requesting;
                if (!target) return;
                const total = Number(amountKes) || 0;
                if (total <= 0) return;
                setSubmitting(true);
                try {
                  const memberIds = [user.id, target.id];
                  const perPerson = Math.ceil(total / memberIds.length);
                  const group = await createGroup(memo.trim() || "Split request", total, perPerson, user.id, memberIds, "single");

                  const convo = await getOrCreateDmConversation(user.id, target.id);
                  await sendDmShareMessage(convo.id, user.id, { kind: "group", group_id: group.id, amount_kes: perPerson, memo: memo.trim() } as any);
                  await sendDmMessage(convo.id, user.id, `Split created: KSH ${perPerson.toLocaleString("en-KE")} each${memo.trim() ? ` for ${memo.trim()}` : ""}.`);

                  setRequesting(null);
                  navigate(`/messages/${convo.id}`, { state: { otherUserId: target.id } });
                } catch (e) {
                  console.error(e);
                  alert("Couldn't send request. Try again.");
                } finally {
                  setSubmitting(false);
                }
              }}
              className="mt-5 w-full h-12 rounded-2xl bg-black hover:bg-gray-800 text-white font-extrabold transition-colors disabled:opacity-50"
            >
              {submitting ? "Sending..." : `Request KSH ${Number(amountKes || 0).toLocaleString("en-KE") || ""}`.trim()}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

