import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { supabase, joinFunction } from "../lib/supabase";
import imgYutoMascot from "../assets/yuto-mascot.webp";
import UserAvatar from "../components/UserAvatar";
import { Flame, MapPin, Users, CalendarDays, BadgeDollarSign, Sparkles } from "lucide-react";

/**
 * Public landing page for shared Function links.
 * Non-users see the event details + social proof and are funneled to signup.
 * Logged-in users are redirected to the home feed with the function focused.
 */
export default function FunctionLandingScreen() {
  const { functionId } = useParams<{ functionId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [fn, setFn] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!functionId) return;
    fetchFunction();
  }, [functionId]);

  // If user is logged in, redirect to home with focus on this function
  useEffect(() => {
    if (user && fn) {
      navigate("/home", {
        replace: true,
        state: { focus: { kind: "function", id: functionId }, forcePublicTab: true },
      });
    }
  }, [user, fn, functionId, navigate]);

  const fetchFunction = async () => {
    try {
      const { data, error: fetchErr } = await supabase
        .from("functions")
        .select(
          `id, title, description, date, location, amount_per_person, max_capacity, image_url, status,
           host:profiles!functions_host_id_fkey(id, display_name, username, avatar_url),
           function_members(id, user_id, has_paid, profiles(id, display_name, avatar_url)),
           media:function_media(id, media_url, media_type, sort_index)`
        )
        .eq("id", functionId)
        .single();
      if (fetchErr) throw fetchErr;
      setFn(data);
    } catch {
      setError("This function doesn't exist or has been removed.");
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = () => {
    // Save destination and redirect to auth
    sessionStorage.setItem("joinAfterAuth", `/function/${functionId}`);
    navigate("/auth", { state: { defaultMode: "signup" } });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-black flex items-center justify-center transition-colors">
        <div className="w-8 h-8 border-4 border-black dark:border-white border-t-transparent dark:border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !fn) {
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

  const isSell = fn.location === "__SELL__";
  const isService = fn.location === "__SERVICE__";
  const isEvent = !isSell && !isService;
  const members = fn.function_members ?? [];
  const paidCount = members.filter((m: any) => m.has_paid).length;
  const joinedCount = members.length;
  const spotsLeft = fn.max_capacity ? Math.max(0, fn.max_capacity - joinedCount) : null;
  const isFull = spotsLeft === 0;
  const hostName = fn.host?.display_name || fn.host?.username || "Someone";
  const media = ((fn.media || []) as any[]).sort((a: any, b: any) => (a.sort_index ?? 0) - (b.sort_index ?? 0));
  const heroImage = media[0]?.media_url || fn.image_url;

  const formatDate = (d: string | null) => {
    if (!d) return "Anytime";
    return new Date(d).toLocaleDateString("en-KE", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  };

  return (
    <div className="min-h-screen bg-white dark:bg-black flex flex-col transition-colors">
      {/* Hero image */}
      {heroImage && (
        <div className="w-full aspect-[16/9] max-h-[280px] overflow-hidden relative">
          <img src={heroImage} alt={fn.title} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          {spotsLeft != null && spotsLeft <= 5 && spotsLeft > 0 && (
            <div className="absolute top-4 right-4 bg-red-500 text-white px-3 py-1.5 rounded-full text-sm font-bold flex items-center gap-1.5 animate-pulse">
              <Flame size={14} /> {spotsLeft} spot{spotsLeft === 1 ? "" : "s"} left!
            </div>
          )}
          {isFull && (
            <div className="absolute top-4 right-4 bg-black/80 text-white px-3 py-1.5 rounded-full text-sm font-bold">
              Sold out
            </div>
          )}
        </div>
      )}

      <div className="flex-1 px-6 pt-6 pb-8 flex flex-col">
        {/* Host */}
        <div className="flex items-center gap-3 mb-4">
          <UserAvatar name={hostName} avatarUrl={fn.host?.avatar_url} size="md" />
          <div>
            <p className="font-bold text-black dark:text-white">{hostName}</p>
            <p className="text-xs text-gray-400">
              {isSell ? "Selling" : isService ? "Offering" : "Hosting"}
            </p>
          </div>
        </div>

        {/* Title */}
        <h1 className="text-2xl font-black text-black dark:text-white mb-2">{fn.title}</h1>

        {/* Description */}
        {fn.description && (
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 leading-relaxed">{fn.description}</p>
        )}

        {/* Info chips */}
        <div className="flex flex-wrap gap-2 mb-5">
          <span className="bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 font-bold text-sm px-3 py-1.5 rounded-full flex items-center gap-1.5">
            <BadgeDollarSign size={14} /> KSH {fn.amount_per_person?.toLocaleString()}
          </span>
          {isEvent && fn.date && (
            <span className="bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 font-bold text-sm px-3 py-1.5 rounded-full flex items-center gap-1.5">
              <CalendarDays size={14} /> {formatDate(fn.date)}
            </span>
          )}
          {isEvent && fn.location && (
            <span className="bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 font-bold text-sm px-3 py-1.5 rounded-full flex items-center gap-1.5">
              <MapPin size={14} /> {fn.location}
            </span>
          )}
          {joinedCount > 0 && (
            <span className="bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 font-bold text-sm px-3 py-1.5 rounded-full flex items-center gap-1.5">
              <Users size={14} /> {paidCount} {isEvent ? "going" : "bought"}
            </span>
          )}
        </div>

        {/* Social proof: attendee avatars */}
        {paidCount > 0 && (
          <div className="flex items-center gap-3 mb-6 px-1">
            <div className="flex -space-x-2">
              {members.filter((m: any) => m.has_paid).slice(0, 5).map((m: any) => (
                <UserAvatar
                  key={m.user_id}
                  name={m.profiles?.display_name || "?"}
                  avatarUrl={m.profiles?.avatar_url}
                  size="sm"
                  className="ring-2 ring-white dark:ring-black w-8 h-8"
                />
              ))}
            </div>
            <span className="text-sm text-gray-500 dark:text-gray-400 font-semibold">
              {members.filter((m: any) => m.has_paid).slice(0, 2).map((m: any) => m.profiles?.display_name?.split(' ')[0]).join(', ')}
              {paidCount > 2 && ` and ${paidCount - 2} others`}
              {isEvent ? " are going" : " bought this"}
            </span>
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* CTA */}
        <div className="space-y-3">
          <button
            onClick={handleJoin}
            disabled={isFull && isEvent}
            className="w-full py-4 bg-black dark:bg-white text-white dark:text-black rounded-2xl font-bold text-lg disabled:opacity-50 active:scale-[0.98] transition-transform"
          >
            {isFull ? "Sold out" : "Sign up & join"}
          </button>
          <button
            type="button"
            onClick={() => {
              const text = `${hostName} is hosting ${fn.title} on Yuto 🎉\n\nKSH ${fn.amount_per_person?.toLocaleString()} · ${isEvent && fn.date ? new Date(fn.date).toLocaleDateString("en-KE", { weekday: "short", month: "short", day: "numeric" }) : "Available now"}\n\n${window.location.href}`;
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
