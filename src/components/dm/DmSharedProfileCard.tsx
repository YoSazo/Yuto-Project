import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Clock, MessageCircle, UserPlus } from "lucide-react";
import UserAvatar from "../UserAvatar";
import { getProfile, getOrCreateDmConversation, sendFriendRequest, supabase } from "../../lib/supabase";

type Friendship = "none" | "pending" | "friends";

export function DmSharedProfileCard({ viewerUserId, sharedUserId }: { viewerUserId: string; sharedUserId: string }) {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<{
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
  } | null>(null);
  const [friendship, setFriendship] = useState<Friendship>("none");
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState(false);
  /** After sending a request in this session, primary CTA becomes Message (opens DM) like the full profile screen. */
  const [sentRequestThisSession, setSentRequestThisSession] = useState(false);

  const loadProfileAndFriendship = useCallback(async () => {
    if (!viewerUserId || !sharedUserId) return;
    setLoading(true);
    try {
      const row = await getProfile(sharedUserId);
      setProfile({
        id: row.id as string,
        username: String((row as { username?: string }).username ?? ""),
        display_name: String((row as { display_name?: string }).display_name ?? ""),
        avatar_url: (row as { avatar_url?: string | null }).avatar_url ?? null,
      });

      const { data: link } = await supabase
        .from("friendships")
        .select("status")
        .or(`and(requester_id.eq.${viewerUserId},addressee_id.eq.${sharedUserId}),and(requester_id.eq.${sharedUserId},addressee_id.eq.${viewerUserId})`)
        .maybeSingle();
      setFriendship(!link?.status ? "none" : link.status === "accepted" ? "friends" : "pending");
    } catch (e) {
      console.error(e);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [viewerUserId, sharedUserId]);

  useEffect(() => {
    void loadProfileAndFriendship();
  }, [loadProfileAndFriendship]);

  useEffect(() => {
    setSentRequestThisSession(false);
  }, [sharedUserId, viewerUserId]);

  const openDmWithSharedPerson = async () => {
    setActionBusy(true);
    try {
      const convo = await getOrCreateDmConversation(viewerUserId, sharedUserId);
      navigate(`/messages/${convo.id}`, { state: { otherUserId: sharedUserId } });
    } catch (e) {
      console.error(e);
      alert("Couldn't open messages. Try again.");
    }
    setActionBusy(false);
  };

  const onAddFriend = async () => {
    setActionBusy(true);
    try {
      await sendFriendRequest(viewerUserId, sharedUserId);
      setFriendship("pending");
      setSentRequestThisSession(true);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Couldn't send request.";
      alert(msg.includes("already") ? "You've already interacted with this person." : msg);
    }
    setActionBusy(false);
  };

  if (viewerUserId === sharedUserId) return null;

  if (loading) {
    return (
      <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm w-full max-w-[15rem] mx-auto text-center text-gray-400 text-sm font-semibold">
        Loading…
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm w-full max-w-[15rem] mx-auto text-center text-gray-400 text-sm font-semibold">
        Profile unavailable
      </div>
    );
  }

  const name = profile.display_name?.trim() || "User";
  const handle = profile.username ? `@${profile.username}` : "";
  const showMessagePrimary = friendship === "friends" || sentRequestThisSession;
  const showPendingLock = friendship === "pending" && !sentRequestThisSession;

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm w-full max-w-[min(100%,17rem)] mx-auto overflow-hidden">
      <div className="flex flex-col items-center text-center gap-1.5 mb-4">
        <div className="w-14 h-14 rounded-full overflow-hidden ring-2 ring-black/5 shrink-0">
          <UserAvatar name={name} avatarUrl={profile.avatar_url} size="lg" className="!w-full !h-full" />
        </div>
        <p className="font-bold text-base text-black leading-tight">{name}</p>
        {handle && <p className="text-xs text-gray-400">{handle}</p>}
      </div>

      <div className="flex items-stretch gap-2">
        {showMessagePrimary ? (
          <>
            <button
              type="button"
              disabled={actionBusy}
              onClick={() => void openDmWithSharedPerson()}
              className="flex-1 py-2.5 px-3 rounded-xl text-sm font-bold bg-black text-white shadow-md shadow-black/10 flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <MessageCircle size={16} />
              Message
            </button>
            <button
              type="button"
              onClick={() => navigate(`/user/${sharedUserId}`)}
              className="flex-1 py-2.5 px-3 rounded-xl text-sm font-bold bg-gray-100 text-black flex items-center justify-center gap-2"
            >
              View profile
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              disabled={actionBusy || showPendingLock}
              onClick={() => void onAddFriend()}
              className={`flex-1 py-2.5 px-3 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 shadow-md shadow-black/10 ${
                showPendingLock ? "bg-gray-100 text-gray-400 shadow-none cursor-not-allowed" : "bg-black text-white"
              }`}
            >
              {showPendingLock ? (
                <>
                  <Clock size={16} /> Pending
                </>
              ) : (
                <>
                  <UserPlus size={16} /> Add friend
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => navigate(`/user/${sharedUserId}`)}
              className="flex-1 py-2.5 px-3 rounded-xl text-sm font-bold bg-gray-100 text-black flex items-center justify-center"
            >
              View profile
            </button>
          </>
        )}
      </div>
    </div>
  );
}
