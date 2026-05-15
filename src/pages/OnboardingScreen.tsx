import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import imgLogoDark from "../assets/yuto-logo-dark.png";
import { Send, Users, Star, Check } from "lucide-react";
import { Preferences } from "@capacitor/preferences";

const ONBOARDING_DONE_KEY = "yuto_onboarding_done";

// Ghost positions matching WalletScreen exactly
const ghostCount = 8;
const ghostSlots = Array.from({ length: ghostCount }, (_, i) => {
  const angle = (i * 2 * Math.PI) / ghostCount + Math.PI / 5;
  const r = 100 + (i % 3) * 20;
  return { angle, r };
});

export default function OnboardingScreen() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [step, setStep] = useState(0);
  const [kevinAppeared, setKevinAppeared] = useState(false);
  const [bleTapped, setBleTapped] = useState(false);
  const [bleAmount, setBleAmount] = useState("");
  const [bleSent, setBleSent] = useState(false);
  const [blePaid, setBlePaid] = useState(false);
  const [splitPhase, setSplitPhase] = useState(0); // 0=unpaid, 1=you paid, 2=salah, 3=amina, 4=brian
  const [showPayoutModal, setShowPayoutModal] = useState(false);

  const userName = profile?.display_name || user?.user_metadata?.display_name || "there";

  useEffect(() => {
    if (step === 1 && !kevinAppeared) {
      const t = setTimeout(() => setKevinAppeared(true), 2000);
      return () => clearTimeout(t);
    }
  }, [step, kevinAppeared]);

  const finishOnboarding = async () => {
    await Preferences.set({ key: ONBOARDING_DONE_KEY, value: "true" });
    navigate("/home", { replace: true });
  };

  // Step 0: Greeting
  if (step === 0) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center px-8 text-center">
        <img src={imgLogoDark} alt="Yuto" className="w-20 h-20 object-contain mb-8" />
        <h1 className="text-3xl font-black text-white mb-3">Hey {userName} 👋</h1>
        <p className="text-white/60 text-base mb-10 max-w-[280px]">Welcome to Yuto. Let's show you around — takes 30 seconds.</p>
        <button onClick={() => setStep(1)} className="w-full max-w-xs py-4 bg-white text-black rounded-2xl font-bold text-base active:scale-[0.98] transition-transform border-none">Let's go</button>
      </div>
    );
  }

  // Step 1: BLE Simulation (1:1 with WalletScreen radar)
  if (step === 1) {
    const kevinSlot = ghostSlots[1];

    return (
      <div className="min-h-screen bg-white dark:bg-black flex flex-col px-5 pt-8 pb-8">
        <div className="text-center mb-2">
          <p className="text-xs text-emerald-500 font-bold uppercase tracking-wider mb-1">Step 1 of 3</p>
          <h2 className="text-xl font-black text-black dark:text-white">Send money via Bluetooth</h2>
          <p className="text-sm text-gray-400 mt-1">No WiFi needed. Tap a friend nearby to send.</p>
        </div>

        {/* Radar — scaled up 2x */}
        <div className="relative w-full aspect-square max-w-[380px] mx-auto mb-4">
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 380 380" preserveAspectRatio="xMidYMid meet" style={{ zIndex: 1 }}>
            <circle cx="190" cy="190" r="65" fill="none" stroke="#f0f0f0" strokeWidth="1" className="dark:opacity-20" />
            <circle cx="190" cy="190" r="120" fill="none" stroke="#f0f0f0" strokeWidth="0.5" strokeDasharray="4 6" className="dark:opacity-15" />
            <circle cx="190" cy="190" r="170" fill="none" stroke="#f7f7f7" strokeWidth="0.5" className="dark:opacity-10" />
            {!kevinAppeared && (
              <>
                <circle cx="190" cy="190" r="40" fill="none" stroke="#10b981" strokeWidth="1.5" opacity="0">
                  <animate attributeName="r" from="40" to="120" dur="2.5s" repeatCount="indefinite" />
                  <animate attributeName="opacity" from="0.35" to="0" dur="2.5s" repeatCount="indefinite" />
                </circle>
              </>
            )}
            {ghostSlots.map((ghost, i) => {
              const isKevin = i === 1 && kevinAppeared;
              const endX = 190 + Math.cos(ghost.angle) * (ghost.r * 1.2);
              const endY = 190 + Math.sin(ghost.angle) * (ghost.r * 1.2);
              const cpX = (190 + endX) / 2 + Math.cos(ghost.angle + 0.5) * 25;
              const cpY = (190 + endY) / 2 + 25;
              const pathD = `M 190 190 Q ${cpX} ${cpY} ${endX} ${endY}`;
              const motionD = `M 0 0 Q ${cpX - 190} ${cpY - 190} ${endX - 190} ${endY - 190}`;
              return (
                <g key={i}>
                  <path d={pathD} fill="none" stroke={isKevin && blePaid ? "#22c55e" : "#e0e0e0"} strokeWidth={isKevin && blePaid ? 2.5 : 1} strokeDasharray={isKevin && blePaid ? "none" : "4 6"} strokeLinecap="round" className="dark:opacity-30" />
                  {isKevin && blePaid && <path d={pathD} fill="none" stroke="#22c55e" strokeWidth={8} opacity={0.1} strokeLinecap="round" />}
                  {!isKevin && (
                    <g transform="translate(190,190)">
                      <circle r="3" fill="#5493b3">
                        <animateMotion dur="1.8s" repeatCount="indefinite" begin={`${i * 0.3}s`} path={motionD} rotate="0" />
                        <animate attributeName="opacity" values="0;0.7;0.7;0" dur="1.8s" repeatCount="indefinite" begin={`${i * 0.3}s`} />
                      </circle>
                    </g>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Center — You (big) */}
          <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 10 }}>
            <div className="w-[80px] h-[80px] rounded-full bg-black dark:bg-white border-[3px] border-emerald-500 flex items-center justify-center shadow-xl shadow-emerald-500/20">
              <span className="text-white dark:text-black font-black text-lg">You</span>
            </div>
          </div>

          {/* Salah (appears after 2s, big node) */}
          {kevinAppeared && (() => {
            const sx = Math.cos(kevinSlot.angle) * (kevinSlot.r * 1.2);
            const sy = Math.sin(kevinSlot.angle) * (kevinSlot.r * 1.2);
            return (
              <div className="absolute left-1/2 top-1/2" style={{ transform: `translate(calc(-50% + ${sx}px), calc(-50% + ${sy}px))`, zIndex: 20 }}>
                <button type="button" onClick={() => setBleTapped(true)} disabled={bleTapped} className="flex flex-col items-center bg-transparent border-none node-snap-in">
                  <div className={`w-[72px] h-[72px] rounded-full border-[3px] flex items-center justify-center font-bold text-2xl shadow-xl transition-all duration-700 ${blePaid ? "bg-black dark:bg-white border-emerald-500 text-white dark:text-black" : "bg-gray-200 dark:bg-zinc-700 border-gray-300 dark:border-zinc-600 text-gray-600 dark:text-gray-300"}`}>
                    {blePaid ? <Check size={28} className="text-emerald-500" /> : "S"}
                  </div>
                  <p className={`text-sm font-semibold mt-1.5 ${blePaid ? "text-emerald-500" : "text-black dark:text-white"}`}>Salah</p>
                  {!bleTapped && <p className="text-[11px] text-emerald-500 font-bold mt-0.5 animate-bounce">Tap to send!</p>}
                </button>
              </div>
            );
          })()}

          {/* Ghost nodes (bigger) */}
          {ghostSlots.map((ghost, i) => {
            if (i === 1) return null;
            const x = Math.cos(ghost.angle) * (ghost.r * 1.2);
            const y = Math.sin(ghost.angle) * (ghost.r * 1.2);
            return (
              <div key={i} className="absolute left-1/2 top-1/2" style={{ transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`, zIndex: 5 }}>
                <div className="w-[44px] h-[44px] rounded-full bg-gray-100 dark:bg-zinc-800 border-2 border-gray-200 dark:border-zinc-700" style={{ filter: "blur(2px)", opacity: 0.4 }} />
              </div>
            );
          })}
        </div>

        {/* Send modal — bottom sheet style */}
        {bleTapped && !bleSent && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm">
            <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-t-3xl p-6 animate-in slide-in-from-bottom-4 duration-300">
              <div className="flex flex-col items-center mb-4">
                <div className="w-16 h-16 rounded-full bg-gray-200 dark:bg-zinc-700 border-[3px] border-gray-300 dark:border-zinc-600 flex items-center justify-center font-bold text-2xl text-gray-600 dark:text-gray-300 mb-2">S</div>
                <p className="font-bold text-lg text-black dark:text-white">Salah</p>
                <p className="text-xs text-gray-400">Nearby via Bluetooth</p>
              </div>
              <div className="text-center mb-5">
                <p className="text-sm text-gray-400 font-semibold mb-2">Amount (KSH)</p>
                <input type="text" inputMode="numeric" value={bleAmount} onChange={(e) => setBleAmount(e.target.value.replace(/\D/g, ""))} placeholder="0" className="text-[48px] font-bold text-center text-black dark:text-white bg-transparent border-none outline-none w-full" autoFocus />
              </div>
              <button type="button" onClick={() => { if (!bleAmount || parseInt(bleAmount) <= 0) return; setBleSent(true); setTimeout(() => setBlePaid(true), 800); }} disabled={!bleAmount || parseInt(bleAmount) <= 0} className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-bold text-base disabled:opacity-40 active:scale-[0.98] transition-transform border-none flex items-center justify-center gap-2">
                <Send size={18} /> Send
              </button>
            </div>
          </div>
        )}

        {blePaid && (
          <div className="text-center mt-4 animate-in fade-in duration-500">
            <p className="text-emerald-500 font-bold text-lg mb-1">✓ KSH {bleAmount} sent!</p>
            <p className="text-gray-400 text-xs mb-6">No WiFi. No data. Just Bluetooth.</p>
            <button onClick={() => setStep(2)} className="w-full max-w-xs mx-auto py-4 bg-black dark:bg-white text-white dark:text-black rounded-2xl font-bold text-base active:scale-[0.98] transition-transform border-none">Next →</button>
          </div>
        )}

        {!kevinAppeared && <p className="text-center text-xs text-gray-400 mt-auto">Scanning for nearby friends...</p>}
      </div>
    );
  }

  // Step 2: Split — Full YutoGroupScreen replica with jar
  if (step === 2) {
    const splitMembers = [
      { name: "You", initial: "Y", paid: splitPhase >= 1 },
      { name: "Salah", initial: "S", paid: splitPhase >= 2 },
      { name: "Amina", initial: "A", paid: splitPhase >= 3 },
      { name: "Brian", initial: "B", paid: splitPhase >= 4 },
    ];
    const paidCount2 = splitMembers.filter(m => m.paid).length;
    const fillPct = (paidCount2 / splitMembers.length) * 100;
    const allPaid2 = paidCount2 === splitMembers.length;
    const perPerson = 600;
    const total = 2400;

    return (
      <div className="min-h-screen bg-white dark:bg-black flex flex-col px-5 pt-6 pb-6">
        <div className="text-center mb-2">
          <p className="text-xs text-blue-500 font-bold uppercase tracking-wider mb-1">Step 2 of 3</p>
          <h2 className="text-2xl font-black text-black dark:text-white">Friday Dinner 🍕</h2>
          <p className="text-sm text-gray-400 mt-1">KSH {total.toLocaleString()} total</p>
        </div>

        {/* Jar + Members (simplified YutoGroupScreen layout) */}
        <div className="relative w-full max-w-[340px] mx-auto flex-1 min-h-[320px]">
          {/* SVG rings */}
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 340 380" preserveAspectRatio="xMidYMid meet" style={{ zIndex: 1 }}>
            <circle cx="170" cy="190" r="75" fill="none" stroke="#f0f0f0" strokeWidth="1" className="dark:opacity-20" />
            <circle cx="170" cy="190" r="140" fill="none" stroke="#f0f0f0" strokeWidth="0.5" strokeDasharray="4 6" className="dark:opacity-15" />
            {/* Rope lines to members */}
            {splitMembers.map((m, i) => {
              const angle = (i * 2 * Math.PI) / splitMembers.length + Math.PI / 4;
              const r = 155;
              const endX = 170 + Math.cos(angle) * r;
              const endY = 190 + Math.sin(angle) * r;
              const cpX = (170 + endX) / 2 + Math.cos(angle + 0.5) * 25;
              const cpY = (170 + endY) / 2 + 30;
              const pathD = `M 170 190 Q ${cpX} ${cpY} ${endX} ${endY}`;
              return (
                <g key={i}>
                  <path d={pathD} fill="none" stroke={m.paid ? "#22c55e" : "#d1d5db"} strokeWidth={m.paid ? 3 : 1.5} strokeDasharray={m.paid ? "none" : "6 4"} strokeLinecap="round" />
                  {m.paid && <path d={pathD} fill="none" stroke="#22c55e" strokeWidth={8} opacity={0.1} strokeLinecap="round" />}
                </g>
              );
            })}
          </svg>

          {/* Center jar */}
          <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 10 }}>
            <div className={`bg-white dark:bg-zinc-900 rounded-[24px] shadow-xl border-2 w-[130px] h-[160px] relative overflow-hidden transition-all duration-500 ${allPaid2 ? "border-green-400 shadow-green-300/40" : "border-gray-200 dark:border-zinc-700"}`}>
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-green-500 to-green-400 transition-all duration-1000 ease-out" style={{ height: `${fillPct}%` }} />
              <div className="relative z-10 flex flex-col items-center justify-center h-full">
                {allPaid2 ? (
                  <><p className="text-sm font-bold text-white text-center">All paid! 🎉</p><p className="text-xs text-white/80 mt-1">KSH {total.toLocaleString()}</p></>
                ) : (
                  <><p className={`text-2xl font-bold ${fillPct > 50 ? "text-white" : "text-black dark:text-white"}`}>KSH {perPerson}</p><p className={`text-xs ${fillPct > 50 ? "text-white/80" : "text-gray-400"}`}>per person</p></>
                )}
              </div>
            </div>
          </div>

          {/* Member nodes */}
          {splitMembers.map((m, i) => {
            const angle = (i * 2 * Math.PI) / splitMembers.length + Math.PI / 4;
            const r = 155;
            const x = Math.cos(angle) * r;
            const y = Math.sin(angle) * r;
            return (
              <div key={i} className="absolute left-1/2 top-1/2" style={{ transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`, zIndex: 20 }}>
                <div className="flex flex-col items-center">
                  <div className={`w-[64px] h-[64px] rounded-full border-[3px] flex items-center justify-center font-bold text-xl transition-all duration-500 ${m.paid ? "bg-black dark:bg-white border-green-500 text-white dark:text-black shadow-xl shadow-green-500/25" : "bg-white dark:bg-zinc-900 border-gray-300 dark:border-zinc-700 text-black dark:text-white shadow-lg"}`}>
                    {m.paid ? <Check size={24} className="text-green-500" /> : m.initial}
                  </div>
                  <p className="text-xs font-semibold mt-1.5 text-gray-700 dark:text-gray-300">{m.name}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Status */}
        <p className="text-center text-sm text-gray-400 mb-4">
          {allPaid2 ? "Everyone paid — ready to pay out!" : `${paidCount2}/${splitMembers.length} have paid`}
        </p>

        {/* Action button */}
        {splitPhase === 0 && (
          <button onClick={() => { setSplitPhase(1); setTimeout(() => setSplitPhase(2), 1200); setTimeout(() => setSplitPhase(3), 2400); setTimeout(() => setSplitPhase(4), 3600); }} className="w-full py-4 bg-black dark:bg-white text-white dark:text-black rounded-2xl font-bold text-base active:scale-[0.98] transition-transform border-none">
            Pay KSH {perPerson} from Yuto Balance
          </button>
        )}
        {splitPhase > 0 && !allPaid2 && (
          <button disabled className="w-full py-4 bg-gray-100 dark:bg-zinc-800 text-gray-400 rounded-2xl font-bold text-base border-none">
            Waiting for others to pay...
          </button>
        )}
        {allPaid2 && !showPayoutModal && (
          <button onClick={() => setShowPayoutModal(true)} className="w-full py-4 bg-green-500 text-white rounded-2xl font-bold text-base active:scale-[0.98] transition-transform border-none">
            💸 Pay Out KSH {total.toLocaleString()}
          </button>
        )}

        {/* Payout modal */}
        {showPayoutModal && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-t-3xl p-6 animate-in slide-in-from-bottom-4 duration-300">
              <h3 className="text-xl font-bold text-black dark:text-white mb-2">Pay Out</h3>
              <p className="text-sm text-gray-400 mb-4">Send KSH {total.toLocaleString()} to a till number, account, or anyone.</p>
              <div className="bg-gray-50 dark:bg-zinc-800 rounded-2xl p-4 mb-4">
                <p className="text-xs text-gray-500 font-semibold mb-2">Send to anyone after a split</p>
                <p className="text-sm text-gray-600 dark:text-gray-300">Till number, Paybill, bank account, or another Yuto user — you choose where the money goes.</p>
              </div>
              <button onClick={() => { setShowPayoutModal(false); setStep(3); }} className="w-full py-4 bg-black dark:bg-white text-white dark:text-black rounded-2xl font-bold text-base active:scale-[0.98] transition-transform border-none">
                Continue →
              </button>
            </div>
          </div>
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
        <div className="bg-gradient-to-br from-orange-500 to-pink-500 rounded-3xl p-6 text-white relative overflow-hidden mb-6">
          <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-4"><Star size={20} /><p className="font-bold text-sm uppercase tracking-wider">Refer & Earn</p></div>
            <p className="text-4xl font-black mb-1">KSH 50</p>
            <p className="text-white/80 text-sm font-semibold">per friend who joins & tops up</p>
            <p className="text-white/60 text-xs mt-3">No limit. Invite 10 friends = KSH 500. Invite 100 = KSH 5,000.</p>
          </div>
        </div>
        <div className="space-y-3 mb-8">
          <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 flex items-center justify-center text-xs font-bold">1</div><p className="text-sm text-gray-600 dark:text-gray-300">Share your link on WhatsApp</p></div>
          <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 flex items-center justify-center text-xs font-bold">2</div><p className="text-sm text-gray-600 dark:text-gray-300">Friend signs up & tops up</p></div>
          <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 flex items-center justify-center text-xs font-bold">3</div><p className="text-sm text-gray-600 dark:text-gray-300">You earn KSH 50 instantly</p></div>
        </div>
        <div className="mt-auto">
          <button onClick={finishOnboarding} className="w-full py-4 bg-black dark:bg-white text-white dark:text-black rounded-2xl font-bold text-base active:scale-[0.98] transition-transform border-none">Start using Yuto 🚀</button>
          <p className="text-center text-xs text-gray-400 mt-3">You can find your referral link in the Earnings tab</p>
        </div>
      </div>
    );
  }

  return null;
}

export async function hasCompletedOnboarding(): Promise<boolean> {
  try {
    const { value } = await Preferences.get({ key: ONBOARDING_DONE_KEY });
    return value === "true";
  } catch { return false; }
}
