import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { YutoLogo } from "../components/YutoLogo";
import { Crown } from "lucide-react";

/**
 * Creator recruitment landing page — /creator-invite/:username
 * Shows the economics of the Creator program and an "Apply now" CTA.
 * Separate from the regular referral page.
 */
export default function CreatorLandingScreen() {
  const { username } = useParams<{ username: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!username) return;
    fetchProfile();
  }, [username]);

  const fetchProfile = async () => {
    try {
      const { data, error: fetchErr } = await supabase
        .from("profiles")
        .select("id, display_name, username")
        .eq("username", username)
        .single();
      if (fetchErr) throw fetchErr;
      setProfile(data);
    } catch {
      setError("This creator invite link is invalid.");
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    const text = `Hey! I want to become a Yuto Creator 🚀\n\nI was invited by @${username}. I have an audience and want to promote Yuto.`;
    const waUrl = `https://wa.me/16124713785?text=${encodeURIComponent(text)}`;
    window.open(waUrl, "_blank");
  };

  const handleSignupFirst = () => {
    sessionStorage.setItem("referrer_username", username || "");
    sessionStorage.setItem("joinAfterAuth", "/profile?tab=earnings");
    navigate("/auth", { state: { defaultMode: "signup" } });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-black flex items-center justify-center transition-colors">
        <div className="w-8 h-8 border-4 border-black dark:border-white border-t-transparent dark:border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-white dark:bg-black flex flex-col items-center justify-center px-6 text-center transition-colors">
        <YutoLogo className="w-24 h-24 mb-6 object-contain" />
        <h1 className="text-2xl font-bold text-black dark:text-white mb-2">Oops!</h1>
        <p className="text-gray-500 dark:text-gray-400 mb-6">{error}</p>
        <button
          onClick={() => navigate("/auth")}
          className="w-full max-w-xs bg-black dark:bg-white text-white dark:text-black rounded-2xl py-4 font-bold"
        >
          Join Yuto
        </button>
      </div>
    );
  }

  const displayName = profile.display_name || profile.username;

  return (
    <div className="min-h-screen bg-black flex flex-col transition-colors">
      {/* Hero — thesis immediately clear */}
      <div className="relative px-6 pt-14 pb-8">
        <div className="absolute inset-0 bg-gradient-to-b from-yellow-500/10 via-transparent to-transparent" />
        <div className="relative z-10 text-center">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 mx-auto flex items-center justify-center mb-5">
            <Crown size={28} className="text-white" />
          </div>
          <h1 className="text-3xl font-black text-white mb-3 leading-tight">
            Every user you bring<br />earns you money
          </h1>
          <p className="text-gray-400 text-sm max-w-[300px] mx-auto leading-relaxed">
            When your users put money in or take money out of Yuto, you earn a percentage. Every time. Forever.
          </p>
          {displayName && (
            <p className="text-yellow-400/80 text-xs mt-4 font-semibold">Invited by {displayName}</p>
          )}
        </div>
      </div>

      {/* The math — most prominent */}
      <div className="px-6 space-y-4 flex-1">
        <div className="bg-gradient-to-r from-yellow-900/40 to-orange-900/40 border border-yellow-700/50 rounded-2xl p-6">
          <p className="font-bold text-yellow-400 text-xs uppercase tracking-wider mb-3">Example earnings</p>
          <div className="space-y-4">
            <div className="flex items-baseline justify-between">
              <p className="text-gray-300 text-sm">50 users, each moving KSH 2,000/month</p>
            </div>
            <p className="text-4xl font-black text-white">KSH 5,600<span className="text-lg text-gray-400">/month</span></p>
            <p className="text-gray-400 text-xs">More users = more money. No ceiling. No expiry.</p>
          </div>
        </div>

        {/* How it works — simple */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-3">
          <p className="font-bold text-white text-sm mb-2">How it works</p>
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full bg-yellow-500/20 text-yellow-400 flex items-center justify-center shrink-0 text-xs font-bold">1</div>
            <p className="text-sm text-gray-300">You get a personal link. Post it anywhere.</p>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full bg-yellow-500/20 text-yellow-400 flex items-center justify-center shrink-0 text-xs font-bold">2</div>
            <p className="text-sm text-gray-300">Anyone who signs up through your link is your user.</p>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full bg-yellow-500/20 text-yellow-400 flex items-center justify-center shrink-0 text-xs font-bold">3</div>
            <p className="text-sm text-gray-300">Every time they top up or withdraw, you earn a cut.</p>
          </div>
        </div>

        {/* Revenue details */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
          <p className="font-bold text-white text-sm mb-3">Your cut</p>
          <div className="bg-zinc-800 rounded-xl p-4 mb-3">
            <p className="text-2xl font-black text-yellow-400 mb-1">70% of net margin</p>
            <p className="text-xs text-gray-400">From every transaction your users make</p>
          </div>
          <p className="text-xs text-gray-400">Plus: recruit other creators and earn <span className="text-purple-400 font-bold">30% of their earnings</span> passively. The more creators you recruit, the more you earn without lifting a finger.</p>
        </div>
      </div>

      {/* CTA */}
      <div className="px-6 py-8 space-y-3">
        <button
          onClick={handleApply}
          className="w-full py-4 bg-gradient-to-r from-yellow-400 to-orange-500 text-black rounded-2xl font-bold text-lg active:scale-[0.98] transition-transform"
        >
          Apply Now — DM us on WhatsApp
        </button>
        {!user && (
          <button
            onClick={handleSignupFirst}
            className="w-full py-3.5 bg-zinc-800 text-white rounded-2xl font-bold text-sm active:scale-[0.98] transition-transform"
          >
            Sign up on Yuto first
          </button>
        )}
        <p className="text-center text-gray-500 text-xs">
          Creator status is granted to promoters with an audience.
        </p>
      </div>
    </div>
  );
}
