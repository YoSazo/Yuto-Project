import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { supabase, sendFriendRequest } from "../lib/supabase";
import imgYutoMascot from "../assets/yuto-mascot.webp";

export default function InviteScreen() {
  const { username } = useParams<{ username: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [added, setAdded] = useState(false);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!username) return;
    fetchProfile();
  }, [username]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, username")
        .eq("username", username)
        .single();
      if (error) throw error;
      setProfile(data);
    } catch {
      setError("This invite link is invalid or the user doesn't exist.");
    } finally {
      setLoading(false);
    }
  };

  const handleAddFriend = async () => {
    if (!user) {
      // Non-logged-in user: save invite destination and redirect to auth signup
      sessionStorage.setItem("joinAfterAuth", `/invite/${username}`);
      navigate("/auth", { state: { defaultMode: "signup" } });
      return;
    }
    if (!profile?.id) return;
    setAdding(true);
    try {
      await sendFriendRequest(user.id, profile.id);

      // Only try to record referral if user is newly registered (account < 5 min old)
      // to avoid double-inserting with the signUp() referral capture
      const accountAge = Date.now() - new Date(user.created_at || 0).getTime();
      const isNewUser = accountAge < 5 * 60 * 1000; // 5 minutes

      if (isNewUser) {
        try {
          const { error } = await supabase.from("referrals").insert({
            referrer_id: profile.id,
            referred_id: user.id,
          });
          // Ignore duplicate key errors — signUp likely already successfully inserted this!
          if (error && !error.message.includes('duplicate') && !error.code?.includes('23505')) {
            console.warn("referral insert:", error);
          }
        } catch (e) {
          console.warn("referral insert:", e);
        }
      }

      setAdded(true);
    } catch (err: any) {
      setError(err.message || "Failed to send request.");
    } finally {
      setAdding(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-black flex items-center justify-center transition-colors">
        <div className="w-8 h-8 border-4 border-black dark:border-white border-t-transparent dark:border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="min-h-screen bg-white dark:bg-black flex flex-col items-center justify-center px-6 text-center transition-colors">
        <img src={imgYutoMascot} className="w-24 h-24 mb-6" alt="Yuto" />
        <h1 className="text-2xl font-bold text-black dark:text-white mb-2">Oops!</h1>
        <p className="text-gray-500 dark:text-gray-400 mb-6">{error}</p>
        <button
          onClick={() => navigate("/")}
          className="w-full max-w-xs bg-black dark:bg-white text-white dark:text-black rounded-2xl py-4 font-bold"
        >
          Go to Yuto
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-black flex flex-col items-center justify-center px-6 text-center transition-colors">
      {/* Mascot */}
      <img src={imgYutoMascot} className="w-24 h-24 mb-6" alt="Yuto" />

      {/* Profile */}
      <div className="w-20 h-20 rounded-full bg-black dark:bg-white text-white dark:text-black text-3xl font-black flex items-center justify-center mb-4">
        {profile?.display_name?.[0]?.toUpperCase()}
      </div>
      <h1 className="text-2xl font-black text-black dark:text-white mb-1">{profile?.display_name}</h1>
      <p className="text-gray-400 mb-2">@{profile?.username}</p>
      <p className="text-gray-500 dark:text-gray-400 mb-8">
        wants to pay together with you on <span className="font-bold text-black dark:text-white">Yuto</span>
      </p>

      {/* CTA */}
      {added ? (
        <div className="w-full max-w-xs">
          <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-2xl py-4 px-6 mb-4">
            <p className="text-green-700 dark:text-green-300 font-bold">Friend request sent! 🎉</p>
          </div>
          <button
            onClick={() => navigate("/")}
            className="w-full bg-black dark:bg-white text-white dark:text-black rounded-2xl py-4 font-bold"
          >
            Open Yuto
          </button>
        </div>
      ) : (
        <div className="w-full max-w-xs space-y-3">
          <button
            onClick={handleAddFriend}
            disabled={adding}
            className="w-full bg-black dark:bg-white text-white dark:text-black rounded-2xl py-4 font-bold text-lg disabled:opacity-60"
          >
            {adding ? "Sending..." : user ? `Add ${profile?.display_name}` : "Sign up & Add Friend"}
          </button>
          {!user && (
            <>
              <p className="text-xs text-gray-400 text-center">
                {profile?.display_name} earns KSH 50 when you top up for the first time.
              </p>
              <p className="text-xs text-gray-400 text-center">You&apos;ll need a Yuto account to add friends.</p>
            </>
          )}
          {error && <p className="text-red-500 text-sm">{error}</p>}
        </div>
      )}
    </div>
  );
}
