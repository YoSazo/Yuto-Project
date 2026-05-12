import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import imgYutoMascot from "../assets/yuto-mascot.webp";
import { Sparkles, Users, Zap, ShoppingBag } from "lucide-react";

/**
 * Referral landing page — /referral/:username
 * Non-users see a playful challenge: "[Name] is about to earn KSH 10 from you joining 😏"
 * Logged-in users get redirected to Profile > Earnings tab.
 */
export default function ReferralLandingScreen() {
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

  // If user is logged in, redirect to earnings tab
  useEffect(() => {
    if (user) {
      navigate("/profile", { replace: true, state: { tab: "earnings" } });
    }
  }, [user, navigate]);

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
      setError("This referral link is invalid.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = () => {
    // Save referral info so signup can attribute it
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
        <img src={imgYutoMascot} className="w-24 h-24 mb-6" alt="Yuto" />
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
    <div className="min-h-screen bg-gradient-to-b from-purple-600 via-pink-500 to-orange-400 flex flex-col transition-colors">
      {/* Top section */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center pt-12 pb-6">
        {/* Mascot */}
        <img src={imgYutoMascot} className="w-20 h-20 mb-6" alt="Yuto" />

        {/* Challenge text */}
        <div className="bg-white/15 backdrop-blur-sm rounded-2xl px-5 py-3 mb-6">
          <p className="text-white/90 text-sm font-bold">😏 Challenge mode</p>
        </div>

        <h1 className="text-3xl font-black text-white mb-3 leading-tight max-w-[320px]">
          {displayName} is about to earn KSH 10 from you joining
        </h1>

        <p className="text-white/80 text-sm mb-8 max-w-[280px] leading-relaxed">
          Sign up — and you can earn KSH 10 too by inviting YOUR friends. It's a game. 🎮
        </p>

        {/* What is Yuto */}
        <div className="w-full max-w-sm space-y-3 mb-8">
          <div className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3">
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <Users size={18} className="text-white" />
            </div>
            <div className="text-left">
              <p className="text-white font-bold text-sm">Split bills</p>
              <p className="text-white/60 text-xs">Collect money from friends instantly</p>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3">
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <Sparkles size={18} className="text-white" />
            </div>
            <div className="text-left">
              <p className="text-white font-bold text-sm">Host events</p>
              <p className="text-white/60 text-xs">Sell tickets to your functions</p>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3">
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <ShoppingBag size={18} className="text-white" />
            </div>
            <div className="text-left">
              <p className="text-white font-bold text-sm">Sell stuff</p>
              <p className="text-white/60 text-xs">Your own storefront with M-PESA payments</p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="px-6 pb-8 space-y-3">
        <button
          onClick={handleSignup}
          className="w-full py-4 bg-white text-black rounded-2xl font-bold text-lg active:scale-[0.98] transition-transform shadow-xl"
        >
          Sign up — earn KSH 10 too 💰
        </button>
        <p className="text-center text-white/60 text-xs">
          All with M-PESA. No app download needed. 🇰🇪
        </p>
      </div>
    </div>
  );
}
