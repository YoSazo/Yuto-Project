import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { supabase, sendFriendRequest } from "../lib/supabase";
import imgYutoMascot from "figma:asset/28c11cb437762e8469db46974f467144b8299a8c.png";

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
      sessionStorage.setItem("joinAfterAuth", `/invite/${username}`);
      navigate("/auth");
      return;
    }
    setAdding(true);
    try {
      await sendFriendRequest(user.id, profile.id);
      setAdded(true);
    } catch (err: any) {
      setError(err.message || "Failed to send request.");
    } finally {
      setAdding(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-black border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center">
        <img src={imgYutoMascot} className="w-24 h-24 mb-6" alt="Yuto" />
        <h1 className="text-2xl font-bold mb-2">Oops!</h1>
        <p className="text-gray-500 mb-6">{error}</p>
        <button
          onClick={() => navigate("/")}
          className="w-full max-w-xs bg-black text-white rounded-2xl py-4 font-bold"
        >
          Go to Yuto
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center">
      {/* Mascot */}
      <img src={imgYutoMascot} className="w-24 h-24 mb-6" alt="Yuto" />

      {/* Profile */}
      <div className="w-20 h-20 rounded-full bg-black text-white text-3xl font-black flex items-center justify-center mb-4">
        {profile?.display_name?.[0]?.toUpperCase()}
      </div>
      <h1 className="text-2xl font-black mb-1">{profile?.display_name}</h1>
      <p className="text-gray-400 mb-2">@{profile?.username}</p>
      <p className="text-gray-500 mb-8">
        wants to split rides with you on <span className="font-bold text-black">Yuto</span>
      </p>

      {/* CTA */}
      {added ? (
        <div className="w-full max-w-xs">
          <div className="bg-green-50 border border-green-200 rounded-2xl py-4 px-6 mb-4">
            <p className="text-green-700 font-bold">Friend request sent! 🎉</p>
          </div>
          <button
            onClick={() => navigate("/")}
            className="w-full bg-black text-white rounded-2xl py-4 font-bold"
          >
            Open Yuto
          </button>
        </div>
      ) : (
        <div className="w-full max-w-xs space-y-3">
          <button
            onClick={handleAddFriend}
            disabled={adding}
            className="w-full bg-black text-white rounded-2xl py-4 font-bold text-lg disabled:opacity-60"
          >
            {adding ? "Sending..." : user ? `Add ${profile?.display_name}` : "Sign up & Add Friend"}
          </button>
          {!user && (
            <p className="text-xs text-gray-400">You'll need a Yuto account to add friends</p>
          )}
          {error && <p className="text-red-500 text-sm">{error}</p>}
        </div>
      )}
    </div>
  );
}
