import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { YutoLogo } from "../components/YutoLogo";
import UserAvatar from "../components/UserAvatar";
import { Users, BadgeDollarSign } from "lucide-react";

/**
 * Public landing page for shared Plan links.
 * Friend-oriented: "Kevin is planning X — join the crew"
 */
export default function PlanLandingScreen() {
  const { planId } = useParams<{ planId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [plan, setPlan] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!planId) return;
    fetchPlan();
  }, [planId]);

  useEffect(() => {
    if (user && plan) {
      navigate("/home", {
        replace: true,
        state: { focus: { kind: "plan", id: planId }, forcePublicTab: true },
      });
    }
  }, [user, plan, planId, navigate]);

  const fetchPlan = async () => {
    try {
      const { data, error: fetchErr } = await supabase
        .from("plans")
        .select(`
          id, title, amount, slots, image_url, created_at,
          creator:profiles!plans_creator_id_fkey(id, display_name, username, avatar_url),
          plan_members(id, user_id, profiles(id, display_name, avatar_url))
        `)
        .eq("id", planId)
        .single();
      if (fetchErr) throw fetchErr;
      setPlan(data);
    } catch {
      setError("This plan doesn't exist or has been removed.");
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = () => {
    sessionStorage.setItem("joinAfterAuth", `/plan/${planId}`);
    navigate("/auth", { state: { defaultMode: "signup" } });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-black flex items-center justify-center transition-colors">
        <div className="w-8 h-8 border-4 border-black dark:border-white border-t-transparent dark:border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className="min-h-screen bg-white dark:bg-black flex flex-col items-center justify-center px-6 text-center transition-colors">
        <YutoLogo className="w-24 h-24 mb-6 object-contain" />
        <h1 className="text-2xl font-bold text-black dark:text-white mb-2">Oops!</h1>
        <p className="text-gray-500 dark:text-gray-400 mb-6">{error}</p>
        <button onClick={() => navigate("/auth")} className="w-full max-w-xs bg-black dark:bg-white text-white dark:text-black rounded-2xl py-4 font-bold">
          Join Yuto
        </button>
      </div>
    );
  }

  const creatorName = plan.creator?.display_name || plan.creator?.username || "Someone";
  const members = plan.plan_members || [];
  const memberCount = members.length;
  const slotsLeft = plan.slots ? Math.max(0, plan.slots - memberCount) : null;

  return (
    <div className="min-h-screen bg-white dark:bg-black flex flex-col transition-colors">
      {/* Header illustration */}
      <div className="w-full pt-12 pb-6 flex flex-col items-center px-6">
        <YutoLogo className="w-20 h-20 mb-4 object-contain" />
        <p className="text-sm text-gray-400 dark:text-gray-500 font-semibold mb-1">You're invited</p>
        <h1 className="text-2xl font-black text-black dark:text-white text-center mb-2">{plan.title}</h1>
        <p className="text-gray-500 dark:text-gray-400 text-center text-sm">
          <span className="font-bold text-black dark:text-white">{creatorName}</span> is putting this together
        </p>
      </div>

      <div className="flex-1 px-6 pb-8 flex flex-col">
        {/* Info chips */}
        <div className="flex flex-wrap gap-2 justify-center mb-6">
          {plan.amount && (
            <span className="bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 font-bold text-sm px-3 py-1.5 rounded-full flex items-center gap-1.5">
              <BadgeDollarSign size={14} /> KSH {plan.amount.toLocaleString()}
            </span>
          )}
          <span className="bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 font-bold text-sm px-3 py-1.5 rounded-full flex items-center gap-1.5">
            <Users size={14} /> {memberCount} {memberCount === 1 ? "person" : "people"} in
          </span>
          {slotsLeft !== null && slotsLeft > 0 && (
            <span className="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-bold text-sm px-3 py-1.5 rounded-full">
              {slotsLeft} spot{slotsLeft === 1 ? "" : "s"} left
            </span>
          )}
        </div>

        {/* Members */}
        {memberCount > 0 && (
          <div className="flex flex-col items-center mb-6">
            <div className="flex -space-x-2 mb-2">
              {members.slice(0, 6).map((m: any) => (
                <UserAvatar
                  key={m.user_id}
                  name={m.profiles?.display_name || "?"}
                  avatarUrl={m.profiles?.avatar_url}
                  size="sm"
                  className="ring-2 ring-white dark:ring-black w-9 h-9"
                />
              ))}
              {memberCount > 6 && (
                <div className="w-9 h-9 rounded-full bg-gray-200 dark:bg-zinc-700 ring-2 ring-white dark:ring-black flex items-center justify-center text-xs font-bold text-gray-600 dark:text-gray-300">
                  +{memberCount - 6}
                </div>
              )}
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 font-semibold">
              {members.slice(0, 3).map((m: any) => m.profiles?.display_name?.split(" ")[0]).filter(Boolean).join(", ")}
              {memberCount > 3 ? ` and ${memberCount - 3} more` : ""} joined
            </p>
          </div>
        )}

        {/* Creator card */}
        <div className="bg-gray-50 dark:bg-zinc-900 rounded-2xl p-4 flex items-center gap-3 mb-6">
          <UserAvatar name={creatorName} avatarUrl={plan.creator?.avatar_url} size="md" />
          <div>
            <p className="font-bold text-black dark:text-white">{creatorName}</p>
            <p className="text-xs text-gray-400">Organizer</p>
          </div>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* CTA */}
        <div className="space-y-3">
          <button
            onClick={handleJoin}
            className="w-full py-4 bg-black dark:bg-white text-white dark:text-black rounded-2xl font-bold text-lg active:scale-[0.98] transition-transform"
          >
            Sign up & join the crew
          </button>
          <button
            type="button"
            onClick={() => {
              const text = `${creatorName} is planning "${plan.title}" on Yuto 🎉\n\nJoin the crew:\n${window.location.href}`;
              const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
              window.open(waUrl, "_blank");
            }}
            className="w-full py-3.5 bg-green-600 text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492l4.625-1.476A11.929 11.929 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818c-2.168 0-4.19-.587-5.932-1.61l-.425-.253-2.744.877.876-2.688-.278-.442A9.776 9.776 0 012.182 12c0-5.418 4.4-9.818 9.818-9.818 5.418 0 9.818 4.4 9.818 9.818 0 5.418-4.4 9.818-9.818 9.818z"/></svg>
            Share on WhatsApp
          </button>
          <p className="text-center text-xs text-gray-400">
            Join Yuto — the social payment app for Kenyan youth 🇰🇪
          </p>
        </div>
      </div>
    </div>
  );
}
