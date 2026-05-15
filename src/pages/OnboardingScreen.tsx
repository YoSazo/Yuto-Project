import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { YutoLogo } from "../components/YutoLogo";
import { Send, Users, Star, Check, Plus } from "lucide-react";
import { Preferences } from "@capacitor/preferences";

const ONBOARDING_DONE_KEY = "yuto_onboarding_done";

export default function OnboardingScreen() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [step, setStep] = useState(0);

  // Step 2: BLE simulation state
  const [bleTapped, setBleTapped] = useState(false);
  const [bleAmount, setBleAmount] = useState("");
  const [bleSent, setBleSent] = useState(false);
  const [blePaid, setBlePaid] = useState(false);

  // Step 3: Split simulation state
  const [splitCreated, setSplitCreated] = useState(false);

  const userName = profile?.display_name || user?.user_metadata?.display_name || "there";

  const finishOnboarding = async () => {
    await Preferences.set({ key: ONBOARDING_DONE_KEY, value: "true" });
    navigate("/home", { replace: true });
  };

  // Step 0: Greeting
  if (step === 0) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center px-8 text-center">
        <YutoLogo className="w-20 h-20 object-contain mb-8" />
        <h1 className="text-3xl font-black text-white mb-3">Hey {userName} 👋</h1>
        <p className="text-white/60 text-base mb-10 max-w-[280px]">Welcome to Yuto. Let's show you around — takes 30 seconds.</p>
        <button
          onClick={() => setStep(1)}
          className="w-full max-w-xs py-4 bg-white text-black rounded-2xl font-bold text-base active:scale-[0.98] transition-transform border-none"
        >
          Let's go
        </button>
      </div>
    );
  }

  // Step 1: BLE Simulation
  if (step === 1) {
    return (
      <div className="min-h-screen bg-white dark:bg-black flex flex-col px-5 pt-8 pb-8">
        {/* Header */}
        <div className="text-center mb-4">
          <p className="text-xs text-emerald-500 font-bold uppercase tracking-wider mb-1">Step 1 of 3</p>
          <h2 className="text-xl font-black text-black dark:text-white">Send money via Bluetooth</h2>
          <p className="text-sm text-gray-400 mt-1">No WiFi needed. Tap a friend nearby to send.</p>
        </div>

        {/* Fake radar */}
        <div className="relative w-full aspect-square max-w-[280px] mx-auto my-4">
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 280 280">
            <circle cx="140" cy="140" r="50" fill="none" stroke="#f0f0f0" strokeWidth="1" className="dark:opacity-20" />
            <circle cx="140" cy="140" r="90" fill="none" stroke="#f0f0f0" strokeWidth="0.5" strokeDasharray="4 6" className="dark:opacity-15" />
            <circle cx="140" cy="140" r="125" fill="none" stroke="#f7f7f7" strokeWidth="0.5" className="dark:opacity-10" />
            {/* Scanning pulse */}
            {!bleTapped && (
              <circle cx="140" cy="140" r="30" fill="none" stroke="#10b981" strokeWidth="1.5" opacity="0">
                <animate attributeName="r" from="30" to="90" dur="2.5s" repeatCount="indefinite" />
                <animate attributeName="opacity" from="0.35" to="0" dur="2.5s" repeatCount="indefinite" />
              </circle>
            )}
          </svg>

          {/* Center — You */}
          <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 10 }}>
            <div className="w-[60px] h-[60px] rounded-full bg-black dark:bg-white border-[3px] border-emerald-500 flex items-center justify-center shadow-xl">
              <span className="text-white dark:text-black font-black text-sm">You</span>
            </div>
          </div>

          {/* Fake friend node */}
          <div className="absolute" style={{ left: "65%", top: "25%", zIndex: 20 }}>
            <button
              type="button"
              onClick={() => setBleTapped(true)}
              disabled={bleTapped}
              className={`flex flex-col items-center bg-transparent border-none transition-all duration-500 ${bleTapped ? "scale-100" : "animate-pulse"}`}
            >
              <div className={`w-[52px] h-[52px] rounded-full border-[3px] flex items-center justify-center font-bold text-lg shadow-xl overflow-hidden transition-all duration-700 ${blePaid ? "bg-black dark:bg-white border-emerald-500 text-white dark:text-black" : "bg-gray-200 dark:bg-zinc-700 border-gray-300 dark:border-zinc-600 text-gray-500 dark:text-gray-400"}`}>
                {blePaid ? <Check size={22} className="text-emerald-500" /> : "K"}
              </div>
              <p className={`text-xs font-semibold mt-1 ${blePaid ? "text-emerald-500" : "text-black dark:text-white"}`}>Kevin</p>
              {!bleTapped && <p className="text-[10px] text-emerald-500 font-bold mt-0.5 animate-bounce">Tap me!</p>}
            </button>
          </div>

          {/* Second ghost node */}
          <div className="absolute" style={{ left: "20%", top: "65%", zIndex: 5 }}>
            <div className="w-[36px] h-[36px] rounded-full bg-gray-100 dark:bg-zinc-800 border-2 border-gray-200 dark:border-zinc-700" style={{ filter: "blur(2px)", opacity: 0.4 }} />
          </div>
        </div>

        {/* Send modal (appears after tap) */}
        {bleTapped && !bleSent && (
          <div className="bg-gray-50 dark:bg-zinc-900 rounded-3xl p-5 mx-2 animate-in slide-in-from-bottom-4 duration-300">
            <div className="flex flex-col items-center mb-4">
              <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-zinc-700 border-[3px] border-gray-300 dark:border-zinc-600 flex items-center justify-center font-bold text-lg text-gray-500 mb-2">K</div>
              <p className="font-bold text-black dark:text-white">Kevin</p>
              <p className="text-[10px] text-gray-400">Nearby via Bluetooth</p>
            </div>
            <div className="text-center mb-4">
              <p className="text-xs text-gray-400 font-semibold mb-1">Amount (KSH)</p>
              <input
                type="text"
                inputMode="numeric"
                value={bleAmount}
                onChange={(e) => setBleAmount(e.target.value.replace(/\D/g, ""))}
                placeholder="0"
                className="text-[40px] font-bold text-center text-black dark:text-white bg-transparent border-none outline-none w-full"
                autoFocus
              />
            </div>
            <button
              type="button"
              onClick={() => {
                if (!bleAmount || parseInt(bleAmount) <= 0) return;
                setBleSent(true);
                setTimeout(() => setBlePaid(true), 800);
              }}
              disabled={!bleAmount || parseInt(bleAmount) <= 0}
              className="w-full py-3.5 bg-emerald-500 text-white rounded-2xl font-bold text-sm disabled:opacity-40 active:scale-[0.98] transition-transform border-none flex items-center justify-center gap-2"
            >
              <Send size={16} /> Send
            </button>
          </div>
        )}

        {/* Success state */}
        {blePaid && (
          <div className="text-center mt-4 animate-in fade-in duration-500">
            <p className="text-emerald-500 font-bold text-lg mb-1">✓ KSH {bleAmount} sent!</p>
            <p className="text-gray-400 text-xs mb-6">No WiFi. No data. Just Bluetooth.</p>
            <button
              onClick={() => setStep(2)}
              className="w-full max-w-xs mx-auto py-4 bg-black dark:bg-white text-white dark:text-black rounded-2xl font-bold text-base active:scale-[0.98] transition-transform border-none"
            >
              Next →
            </button>
          </div>
        )}

        {/* Hint if they haven't tapped yet */}
        {!bleTapped && (
          <p className="text-center text-xs text-gray-400 mt-auto">👆 Tap Kevin on the radar to send money</p>
        )}
      </div>
    );
  }

  // Step 2: Split simulation
  if (step === 2) {
    const fakeFriends = [
      { name: "Amina", initial: "A" },
      { name: "Brian", initial: "B" },
      { name: "Grace", initial: "G" },
    ];

    return (
      <div className="min-h-screen bg-white dark:bg-black flex flex-col px-5 pt-8 pb-8">
        <div className="text-center mb-6">
          <p className="text-xs text-blue-500 font-bold uppercase tracking-wider mb-1">Step 2 of 3</p>
          <h2 className="text-xl font-black text-black dark:text-white">Split bills instantly</h2>
          <p className="text-sm text-gray-400 mt-1">Rides, food, rent — split anything with friends.</p>
        </div>

        {/* Fake split card */}
        <div className="bg-gray-50 dark:bg-zinc-900 rounded-3xl p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="font-bold text-black dark:text-white">Friday Dinner 🍕</p>
              <p className="text-xs text-gray-400">KSH 2,400 total · 4 people</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-black text-black dark:text-white">KSH 600</p>
              <p className="text-[10px] text-gray-400">per person</p>
            </div>
          </div>

          <div className="space-y-2 mb-4">
            <div className="flex items-center gap-3 py-2">
              <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-xs font-bold text-emerald-600">You</div>
              <p className="flex-1 text-sm font-medium text-black dark:text-white">You</p>
              <span className="text-xs font-bold text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full">Paid ✓</span>
            </div>
            {fakeFriends.map((f) => (
              <div key={f.name} className="flex items-center gap-3 py-2">
                <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-zinc-700 flex items-center justify-center text-xs font-bold text-gray-500">{f.initial}</div>
                <p className="flex-1 text-sm font-medium text-black dark:text-white">{f.name}</p>
                <span className="text-xs font-semibold text-gray-400 bg-gray-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">Pending</span>
              </div>
            ))}
          </div>

          {!splitCreated ? (
            <button
              type="button"
              onClick={() => setSplitCreated(true)}
              className="w-full py-3.5 bg-black dark:bg-white text-white dark:text-black rounded-2xl font-bold text-sm active:scale-[0.98] transition-transform border-none flex items-center justify-center gap-2"
            >
              <Users size={16} /> Create Split
            </button>
          ) : (
            <div className="text-center py-3 animate-in fade-in duration-300">
              <p className="text-emerald-500 font-bold">✓ Split created!</p>
              <p className="text-xs text-gray-400 mt-1">Friends get notified instantly</p>
            </div>
          )}
        </div>

        {splitCreated && (
          <button
            onClick={() => setStep(3)}
            className="w-full max-w-xs mx-auto py-4 bg-black dark:bg-white text-white dark:text-black rounded-2xl font-bold text-base active:scale-[0.98] transition-transform border-none mt-auto"
          >
            Next →
          </button>
        )}
      </div>
    );
  }

  // Step 3: Earn / Referral
  if (step === 3) {
    return (
      <div className="min-h-screen bg-white dark:bg-black flex flex-col px-5 pt-8 pb-8">
        <div className="text-center mb-6">
          <p className="text-xs text-orange-500 font-bold uppercase tracking-wider mb-1">Step 3 of 3</p>
          <h2 className="text-xl font-black text-black dark:text-white">Earn KSH 50 per friend</h2>
          <p className="text-sm text-gray-400 mt-1">Invite friends. When they top up, you earn.</p>
        </div>

        {/* Referral card */}
        <div className="bg-gradient-to-br from-orange-500 to-pink-500 rounded-3xl p-6 text-white relative overflow-hidden mb-6">
          <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-4"><Star size={20} /><p className="font-bold text-sm uppercase tracking-wider">Refer & Earn</p></div>
            <p className="text-4xl font-black mb-1">KSH 50</p>
            <p className="text-white/80 text-sm font-semibold">per friend who joins & tops up</p>
            <p className="text-white/60 text-xs mt-3">No limit. Invite 10 friends = KSH 500. Invite 100 = KSH 5,000.</p>
          </div>
        </div>

        {/* How it works mini */}
        <div className="space-y-3 mb-8">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 flex items-center justify-center text-xs font-bold">1</div>
            <p className="text-sm text-gray-600 dark:text-gray-300">Share your link on WhatsApp</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 flex items-center justify-center text-xs font-bold">2</div>
            <p className="text-sm text-gray-600 dark:text-gray-300">Friend signs up & tops up</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 flex items-center justify-center text-xs font-bold">3</div>
            <p className="text-sm text-gray-600 dark:text-gray-300">You earn KSH 50 instantly</p>
          </div>
        </div>

        <div className="mt-auto">
          <button
            onClick={finishOnboarding}
            className="w-full py-4 bg-black dark:bg-white text-white dark:text-black rounded-2xl font-bold text-base active:scale-[0.98] transition-transform border-none"
          >
            Start using Yuto 🚀
          </button>
          <p className="text-center text-xs text-gray-400 mt-3">You can find your referral link in the Earnings tab</p>
        </div>
      </div>
    );
  }

  return null;
}

/**
 * Check if onboarding has been completed.
 * Call this from the auth flow to decide whether to show onboarding.
 */
export async function hasCompletedOnboarding(): Promise<boolean> {
  try {
    const { value } = await Preferences.get({ key: ONBOARDING_DONE_KEY });
    return value === "true";
  } catch {
    return false;
  }
}
