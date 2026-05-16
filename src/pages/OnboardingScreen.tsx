import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import imgLogoDark from "../assets/yuto-logo-dark.png";
import { Send, Users, Star, Check } from "lucide-react";
import { Preferences } from "@capacitor/preferences";
import { YutoLogo } from "../components/YutoLogo";

const ONBOARDING_DONE_KEY = "yuto_onboarding_done";

// Ghost positions matching WalletScreen exactly
const ghostCount = 8;
const ghostSlots = Array.from({ length: ghostCount }, (_, i) => {
  const angle = (i * 2 * Math.PI) / ghostCount + Math.PI / 5;
  const r = 100 + (i % 3) * 20;
  return { angle, r };
});

// Demo friends for the split step (hardcoded, no API calls)
const DEMO_FRIENDS = [
  { id: "salah", name: "Salah", initial: "S" },
  { id: "amina", name: "Amina", initial: "A" },
  { id: "brian", name: "Brian", initial: "B" },
] as const;

function OnboardingConfetti() {
  const colors = ["#5493b3", "#FFD700", "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4"];
  const pieces = Array.from({ length: 24 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 0.5,
    duration: 1 + Math.random() * 1,
    color: colors[Math.floor(Math.random() * colors.length)],
  }));
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-50">
      {pieces.map((p) => (
        <div
          key={p.id}
          className="absolute w-2 h-2 rounded-sm"
          style={{
            left: `${p.left}%`,
            top: "-10px",
            backgroundColor: p.color,
            animation: `confettiFall ${p.duration}s ease-in-out ${p.delay}s forwards`,
          }}
        />
      ))}
    </div>
  );
}

export default function OnboardingScreen() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [step, setStep] = useState(0);
  const [kevinAppeared, setKevinAppeared] = useState(false);
  const [bleTapped, setBleTapped] = useState(false);
  const [bleAmount, setBleAmount] = useState("");
  const [bleSent, setBleSent] = useState(false);
  const [blePaid, setBlePaid] = useState(false);
  // Split step state (step 2)
  const [splitSubPhase, setSplitSubPhase] = useState<"picker" | "jar">("picker");
  const [splitAmount, setSplitAmount] = useState("2400");
  const [splitDescription, setSplitDescription] = useState("Friday Dinner 🍕");
  const [selectedDemoFriends, setSelectedDemoFriends] = useState<string[]>([]);
  const [joinedMembers, setJoinedMembers] = useState<Set<string>>(new Set(["you"])); // "You" always joined
  const [paidMembers, setPaidMembers] = useState<Set<string>>(new Set());
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [payoutTab, setPayoutTab] = useState<"phone" | "buygoods" | "paybill">("phone");

  // Computed values for split step
  const totalPeople = selectedDemoFriends.length + 1; // +1 for "You"
  const totalAmount = parseInt(splitAmount) || 0;
  const perPerson = totalAmount > 0 && totalPeople > 0 ? Math.ceil(totalAmount / totalPeople) : 0;
  const allMembers = [{ id: "you", name: "You", initial: "Y" }, ...DEMO_FRIENDS.filter(f => selectedDemoFriends.includes(f.id))];

  const userName = profile?.display_name || user?.user_metadata?.display_name || "there";

  useEffect(() => {
    if (step === 1 && !kevinAppeared) {
      const t = setTimeout(() => setKevinAppeared(true), 2000);
      return () => clearTimeout(t);
    }
  }, [step, kevinAppeared]);

  // Join simulation: after entering jar phase, friends join one by one with delay
  useEffect(() => {
    if (step !== 2 || splitSubPhase !== "jar") return;

    const timers: ReturnType<typeof setTimeout>[] = [];

    // Friends join one by one at ~1.5s intervals (starting after 1.2s)
    selectedDemoFriends.forEach((friendId, index) => {
      timers.push(
        setTimeout(() => {
          setJoinedMembers(prev => new Set([...prev, friendId]));
        }, 1200 + index * 1500)
      );
    });

    return () => {
      timers.forEach(t => clearTimeout(t));
    };
  }, [step, splitSubPhase, selectedDemoFriends]);

  // Payment simulation: after user pays, others pay one by one
  const youPaidGlobal = paidMembers.has("you");
  useEffect(() => {
    if (step !== 2 || splitSubPhase !== "jar") return;
    if (!youPaidGlobal) return; // only start after user pays

    const timers: ReturnType<typeof setTimeout>[] = [];

    // After user pays, others pay at ~1.2s intervals
    selectedDemoFriends.forEach((friendId, index) => {
      timers.push(
        setTimeout(() => {
          setPaidMembers(prev => new Set([...prev, friendId]));
        }, (index + 1) * 1200)
      );
    });

    return () => {
      timers.forEach(t => clearTimeout(t));
    };
  }, [step, splitSubPhase, youPaidGlobal, selectedDemoFriends]);

  // Confetti when all paid
  useEffect(() => {
    if (step !== 2 || splitSubPhase !== "jar") return;
    const allPaidCheck = allMembers.length > 0 && paidMembers.size === allMembers.length;
    if (allPaidCheck && !showConfetti) {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 2500);
    }
  }, [step, splitSubPhase, paidMembers, allMembers.length, showConfetti]);

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

  // Step 2: Split — Two-phase: Friend Picker → Jar Visualization
  if (step === 2) {
    const toggleDemoFriend = (id: string) => {
      setSelectedDemoFriends((prev) =>
        prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
      );
    };

    const isValidSplit = totalAmount > 0 && selectedDemoFriends.length > 0;

    // Phase 1: Friend Picker (SplitScreen-style layout)
    if (splitSubPhase === "picker") {
      return (
        <div className="min-h-screen bg-white dark:bg-black flex flex-col px-6 pt-8 pb-6">
          {/* Step header */}
          <div className="text-center mb-6">
            <p className="text-xs text-blue-500 font-bold uppercase tracking-wider mb-1">Step 2 of 3</p>
            <h2 className="text-xl font-black text-black dark:text-white">Split with friends</h2>
            <p className="text-sm text-gray-400 mt-1">Pick some friends you'd like to split with.</p>
          </div>

          {/* Amount input */}
          <div className="flex flex-col items-center py-4">
            <span className="text-sm font-medium text-gray-400 tracking-wider uppercase mb-2">KSH</span>
            <input
              type="text"
              inputMode="numeric"
              value={splitAmount}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, "");
                if (val.length <= 7) setSplitAmount(val);
              }}
              placeholder="0"
              className="text-[56px] font-bold text-center text-black dark:text-white bg-transparent border-none outline-none w-full placeholder-gray-200 dark:placeholder-gray-700"
              style={{ caretColor: "#5493b3" }}
            />
            <div className="w-16 h-0.5 bg-gray-200 dark:bg-zinc-800 rounded-full mt-1" />
          </div>

          {/* Description */}
          <div className="mt-4 mb-6">
            <input
              type="text"
              value={splitDescription}
              onChange={(e) => setSplitDescription(e.target.value)}
              placeholder="What's this for? (chipo, lunch, drinks...)"
              maxLength={40}
              className="w-full text-sm text-center text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-zinc-900 border-none outline-none rounded-full px-4 py-3 placeholder-gray-300 dark:placeholder-zinc-600"
            />
          </div>

          {/* Friends */}
          <div className="mt-2">
            <p className="font-semibold text-sm text-gray-500 mb-3">Split with</p>
            <div className="flex flex-wrap gap-3">
              {DEMO_FRIENDS.map((friend) => {
                const selected = selectedDemoFriends.includes(friend.id);
                return (
                  <button
                    key={friend.id}
                    onClick={() => toggleDemoFriend(friend.id)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-full border-2 transition-all active:scale-[0.97] ${
                      selected
                        ? "bg-black dark:bg-white border-black dark:border-white text-white dark:text-black"
                        : "bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800 text-black dark:text-white"
                    }`}
                  >
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                      selected ? "bg-white/20 text-white dark:bg-black/20 dark:text-black" : "bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300"
                    }`}>
                      {friend.initial}
                    </div>
                    <span className="font-medium text-sm">{friend.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Per person summary */}
          {isValidSplit && (
            <div className="mt-6 text-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-50 dark:bg-zinc-900 rounded-full">
                <span className="text-sm text-gray-500 dark:text-gray-400">Each person pays</span>
                <span className="font-bold text-lg text-black dark:text-white">KSH {perPerson.toLocaleString()}</span>
              </div>
            </div>
          )}

          {/* CTA Button */}
          <div className="mt-auto pb-6 pt-8">
            <button
              onClick={() => setSplitSubPhase("jar")}
              disabled={!isValidSplit}
              className={`w-full py-4 rounded-full font-bold text-lg transition-all active:scale-[0.98] ${
                isValidSplit
                  ? "bg-black dark:bg-white text-white dark:text-black"
                  : "bg-gray-100 dark:bg-zinc-800 text-gray-400 dark:text-gray-500 cursor-not-allowed"
              }`}
            >
              {isValidSplit
                ? `Split KSH ${totalAmount.toLocaleString()}`
                : "Enter amount & select friends"}
            </button>
          </div>
        </div>
      );
    }

    // Phase 2: Jar Visualization (pixel-perfect YutoGroupScreen replica)
    if (splitSubPhase === "jar") {
      const allJoined = allMembers.every(m => joinedMembers.has(m.id));
      const allPaid = paidMembers.size === allMembers.length && allMembers.length > 0;
      const fillPercentage = allMembers.length > 0 ? (paidMembers.size / allMembers.length) * 100 : 0;
      const youPaid = paidMembers.has("you");

      // Position calculation matching YutoGroupScreen exactly
      const getMemberPosition = (index: number, total: number) => {
        const angle = (index * 2 * Math.PI) / total + Math.PI / 4;
        const x = 190 + Math.cos(angle) * 185;
        const y = 210 + Math.sin(angle) * 185;
        return { x, y, angle };
      };

      return (
        <div className="min-h-screen bg-white dark:bg-black flex flex-col px-5 pt-6 pb-6 relative">
          {showConfetti && <OnboardingConfetti />}
          <div className="text-center mb-2">
            <p className="text-xs text-blue-500 font-bold uppercase tracking-wider mb-1">Step 2 of 3</p>
            <h2 className="text-2xl font-black text-black dark:text-white">{splitDescription}</h2>
            <p className="text-sm text-gray-400 mt-1">KSH {totalAmount.toLocaleString()} total</p>
          </div>

          {/* SVG Graph Container */}
          <div className="relative w-full max-w-[380px] min-h-[380px] mx-auto flex-1 flex items-center justify-center overflow-visible">
            <svg
              className="absolute inset-0 w-full h-full"
              viewBox="0 0 380 420"
              preserveAspectRatio="xMidYMid meet"
              style={{ zIndex: 1 }}
            >
              {/* Three concentric reference circles */}
              <circle cx="190" cy="210" r="85" fill="none" stroke="#f0f0f0" strokeWidth="1" />
              <circle
                cx="190"
                cy="210"
                r="155"
                fill="none"
                stroke="#f0f0f0"
                strokeWidth="1"
                strokeDasharray="4 6"
                style={{ animation: "orbitSpin 60s linear infinite", transformOrigin: "190px 210px" }}
              />
              <circle cx="190" cy="210" r="120" fill="none" stroke="#f7f7f7" strokeWidth="0.5" />

              {/* Pulse rings — shown when not all paid */}
              {!allPaid && (
                <>
                  <circle cx="190" cy="210" r="40" fill="none" stroke="#5493b3" strokeWidth="1.5" opacity="0">
                    <animate attributeName="r" from="40" to="85" dur="2s" repeatCount="indefinite" />
                    <animate attributeName="opacity" from="0.3" to="0" dur="2s" repeatCount="indefinite" />
                  </circle>
                  <circle cx="190" cy="210" r="40" fill="none" stroke="#5493b3" strokeWidth="1" opacity="0">
                    <animate attributeName="r" from="40" to="85" dur="2s" begin="1s" repeatCount="indefinite" />
                    <animate attributeName="opacity" from="0.2" to="0" dur="2s" begin="1s" repeatCount="indefinite" />
                  </circle>
                </>
              )}

              {/* Rope lines */}
              {allMembers.map((member, i) => {
                const JAR_CORNERS = [{x:230,y:162},{x:150,y:258},{x:150,y:162},{x:230,y:258}];
                const { x: endX, y: endY, angle } = getMemberPosition(i, allMembers.length);
                const corner = JAR_CORNERS[i % 4];
                const joined = joinedMembers.has(member.id);
                const paid = paidMembers.has(member.id);
                const hangOffset = joined ? 0 : 35;
                const finalEndY = endY + hangOffset;
                const cpX = (corner.x + endX) / 2 + Math.cos(angle) * 30;
                const cpY = (corner.y + finalEndY) / 2 + (joined ? 40 : 60);
                const pathD = `M ${corner.x} ${corner.y} Q ${cpX} ${cpY} ${endX} ${finalEndY}`;
                const motionD = `M 0 0 Q ${cpX - corner.x} ${cpY - corner.y} ${endX - corner.x} ${finalEndY - corner.y}`;
                return (
                  <g key={`rope-${i}`}>
                    <path d={pathD} fill="none" stroke={paid ? "#22c55e" : joined ? "#d1d5db" : "#e0e0e0"} strokeWidth={paid ? 3 : joined ? 2 : 1} strokeDasharray={paid ? "none" : joined ? "7 5" : "4 6"} strokeLinecap="round" />
                    {paid && <path d={pathD} fill="none" stroke="#22c55e" strokeWidth={8} opacity={0.12} strokeLinecap="round" />}
                    {joined && !paid && (
                      <g transform={`translate(${corner.x},${corner.y})`}>
                        <circle r="3.5" fill="#5493b3">
                          <animateMotion dur="1.5s" repeatCount="indefinite" begin={`${i * 0.4}s`} path={motionD} rotate="0" />
                          <animate attributeName="opacity" values="0;0.8;0.8;0" dur="1.5s" repeatCount="indefinite" begin={`${i * 0.4}s`} />
                        </circle>
                      </g>
                    )}
                  </g>
                );
              })}
            </svg>

            {/* Center jar */}
            <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 10 }}>
              <div className={`bg-white dark:bg-zinc-900 rounded-[28px] shadow-xl border-2 w-[160px] h-[195px] relative overflow-hidden transition-all duration-500 ${allPaid ? "border-green-400 shadow-green-300/40" : "border-gray-200 dark:border-zinc-700"}`}>
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-green-500 to-green-400 transition-all duration-1000 ease-out" style={{ height: `${fillPercentage}%` }} />
                <div className="relative z-10 flex flex-col items-center justify-center h-full px-2">
                  <YutoLogo className="w-[72px] h-[72px] object-contain mb-2" />
                  {allPaid ? (
                    <>
                      <p className="text-sm font-bold text-white text-center leading-tight">All paid! 🎉</p>
                      <p className="text-xs text-white/80 mt-1">KSH {totalAmount.toLocaleString()}</p>
                    </>
                  ) : (
                    <>
                      <p className={`text-2xl font-bold transition-colors duration-300 ${fillPercentage > 50 ? "text-white" : "text-black dark:text-white"}`}>KSH {perPerson.toLocaleString()}</p>
                      <p className={`text-sm transition-colors duration-300 ${fillPercentage > 50 ? "text-white/80" : "text-gray-400 dark:text-gray-500"}`}>per person</p>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Member nodes */}
            {allMembers.map((member, i) => {
              const { x, y } = getMemberPosition(i, allMembers.length);
              const joined = joinedMembers.has(member.id);
              const paid = paidMembers.has(member.id);
              const hangOffset = joined ? 0 : 35;
              return (
                <div
                  key={member.id}
                  className="absolute left-1/2 top-1/2"
                  style={{ transform: `translate(calc(-50% + ${x - 190}px), calc(-50% + ${y - 210 + hangOffset}px))`, transition: "transform 0.7s cubic-bezier(0.34, 1.56, 0.64, 1)", zIndex: 20 }}
                >
                  <div className={`flex flex-col items-center ${joined && !paid ? "node-snap-in" : ""}`} style={!joined ? { filter: "blur(3px)", opacity: 0.5 } : undefined}>
                    <div className={`relative ${paid ? "node-glow" : ""}`}>
                      <div
                        className={`w-[76px] h-[76px] rounded-full flex items-center justify-center font-bold text-2xl border-[3px] transition-colors duration-500 overflow-hidden ${
                          paid
                            ? "bg-black dark:bg-white border-green-500 text-white dark:text-black shadow-xl shadow-green-500/25"
                            : joined
                            ? "bg-white dark:bg-zinc-900 border-gray-300 dark:border-zinc-700 text-black dark:text-white shadow-lg"
                            : "bg-gray-100 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 text-gray-300 dark:text-gray-600 shadow-sm"
                        }`}
                      >
                        {member.initial}
                      </div>
                      {paid && (
                        <div className="absolute -bottom-0.5 -right-0.5 bg-green-500 rounded-full p-1">
                          <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                    </div>
                    {joined ? (
                      <p className="text-sm font-semibold mt-2 text-gray-700 dark:text-gray-300">{member.name}</p>
                    ) : (
                      <p className="text-xs mt-2 text-gray-400 italic whitespace-nowrap">Waiting for {member.name}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Status text */}
          <div className="text-center mt-4 mb-4">
            {allPaid ? (
              <p className="text-green-500 font-bold text-base">Everyone paid — ready to pay out! 🎉</p>
            ) : !allJoined ? (
              <p className="text-gray-400 text-sm font-medium">{joinedMembers.size}/{allMembers.length} joined</p>
            ) : (
              <p className="text-gray-400 text-sm font-medium">{paidMembers.size}/{allMembers.length} have paid</p>
            )}
          </div>

          {/* Action buttons */}
          {allPaid && !showPayoutModal ? (
            <button
              onClick={() => setShowPayoutModal(true)}
              className="w-full max-w-xs mx-auto py-4 bg-green-500 text-white rounded-2xl font-bold text-base active:scale-[0.98] transition-transform border-none"
            >
              💸 Pay Out KSH {totalAmount.toLocaleString()}
            </button>
          ) : !allJoined ? (
            <button
              disabled
              className="w-full max-w-xs mx-auto py-4 bg-gray-100 dark:bg-zinc-800 text-gray-400 dark:text-gray-500 rounded-2xl font-bold text-base cursor-not-allowed border-none"
            >
              Waiting for group to join...
            </button>
          ) : !youPaid ? (
            <button
              onClick={() => setPaidMembers(prev => new Set([...prev, "you"]))}
              className="w-full max-w-xs mx-auto py-4 bg-black dark:bg-white text-white dark:text-black rounded-2xl font-bold text-base active:scale-[0.98] transition-transform border-none"
            >
              Pay KSH {perPerson.toLocaleString()} from Yuto Balance
            </button>
          ) : !allPaid ? (
            <button
              disabled
              className="w-full max-w-xs mx-auto py-4 bg-gray-100 dark:bg-zinc-800 text-gray-400 dark:text-gray-500 rounded-2xl font-bold text-base cursor-not-allowed border-none"
            >
              Waiting for others to pay...
            </button>
          ) : null}

          {/* Payout Modal — 3 tabs matching YutoGroupScreen exactly */}
          {showPayoutModal && (
            <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
              <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-t-3xl p-6 animate-in slide-in-from-bottom-4 duration-300">
                <div className="flex justify-between items-center mb-1">
                  <h2 className="font-bold text-xl text-black dark:text-white">Pay Out</h2>
                  <button onClick={() => setShowPayoutModal(false)} className="text-2xl text-gray-400 hover:text-black dark:hover:text-white bg-transparent border-none cursor-pointer">✕</button>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
                  Send <span className="font-bold text-black dark:text-white">KSH {totalAmount.toLocaleString()}</span> from your Yuto Balance
                </p>

                {/* Tab switcher */}
                <div className="flex gap-2 mb-5">
                  {(["phone", "buygoods", "paybill"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setPayoutTab(t)}
                      className={`flex-1 py-2.5 rounded-full text-sm font-semibold border transition-all cursor-pointer ${
                        payoutTab === t
                          ? "bg-black text-white border-black dark:bg-white dark:text-black dark:border-white"
                          : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50 dark:bg-zinc-800 dark:text-gray-300 dark:border-zinc-700 dark:hover:bg-zinc-700"
                      }`}
                    >
                      {t === "phone" ? "Phone" : t === "buygoods" ? "Buy Goods" : "PayBill"}
                    </button>
                  ))}
                </div>

                {/* Tab content — disabled inputs */}
                {payoutTab === "phone" && (
                  <div className="mb-5">
                    <label className="text-xs text-gray-500 dark:text-gray-400 mb-1.5 block">Recipient M-PESA number</label>
                    <input
                      type="tel"
                      disabled
                      placeholder="254712345678"
                      className="w-full h-12 border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-400 dark:text-gray-500 placeholder:text-gray-300 dark:placeholder:text-gray-600 rounded-full px-5 text-base outline-none cursor-not-allowed"
                    />
                  </div>
                )}

                {payoutTab === "buygoods" && (
                  <div className="mb-5">
                    <label className="text-xs text-gray-500 dark:text-gray-400 mb-1.5 block">Till Number</label>
                    <input
                      type="tel"
                      disabled
                      placeholder="e.g. 123456"
                      className="w-full h-12 border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-400 dark:text-gray-500 placeholder:text-gray-300 dark:placeholder:text-gray-600 rounded-full px-5 text-base outline-none cursor-not-allowed"
                    />
                  </div>
                )}

                {payoutTab === "paybill" && (
                  <div className="mb-5 flex flex-col gap-3">
                    <div>
                      <label className="text-xs text-gray-500 dark:text-gray-400 mb-1.5 block">Business Number</label>
                      <input
                        type="tel"
                        disabled
                        placeholder="e.g. 247247"
                        className="w-full h-12 border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-400 dark:text-gray-500 placeholder:text-gray-300 dark:placeholder:text-gray-600 rounded-full px-5 text-base outline-none cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 dark:text-gray-400 mb-1.5 block">Account Number</label>
                      <input
                        type="text"
                        disabled
                        placeholder="e.g. 0712345678"
                        className="w-full h-12 border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-400 dark:text-gray-500 placeholder:text-gray-300 dark:placeholder:text-gray-600 rounded-full px-5 text-base outline-none cursor-not-allowed"
                      />
                    </div>
                  </div>
                )}

                <div className="bg-gray-50 dark:bg-zinc-800 rounded-2xl p-4 mb-5">
                  <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                    You can pay out to a <span className="font-semibold">till number</span>, <span className="font-semibold">Paybill</span>, <span className="font-semibold">bank account</span>, or another <span className="font-semibold">Yuto user</span> — you choose where the money goes.
                  </p>
                </div>

                <button
                  onClick={() => { setShowPayoutModal(false); setStep(3); }}
                  className="w-full py-4 bg-black dark:bg-white text-white dark:text-black rounded-2xl font-bold text-base active:scale-[0.98] transition-transform border-none"
                >
                  Continue →
                </button>

                <p className="text-xs text-gray-400 dark:text-gray-500 text-center mt-3">
                  Funds are sent instantly from your Yuto Balance — no PIN prompt
                </p>
              </div>
            </div>
          )}
        </div>
      );
    }
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
