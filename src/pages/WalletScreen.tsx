import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { supabase, fetchYutoBalance } from "../lib/supabase";
import { Plus, ArrowDownLeft, Send, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { YutoBalanceTopUpModal } from "../components/wallet/YutoBalanceTopUpModal";

/**
 * Dedicated Wallet page with Bluetooth proximity radar.
 * Design mirrors YutoGroupScreen: scattered ghost circles, animated rope lines
 * with traveling blue balls, snap-in when a friend is discovered nearby.
 */

const GHOST_COUNT = 10;
const ghostSlots = Array.from({ length: GHOST_COUNT }, (_, i) => {
  const angle = (i * 2 * Math.PI) / GHOST_COUNT + Math.PI / 5;
  const r = 110 + (i % 3) * 25;
  return { angle, r, id: `ghost-${i}` };
});

interface NearbyUser {
  id: string;
  name: string;
  avatar_url: string | null;
  slotIndex: number;
}

// Simulated discovery sequence
const SIMULATED_USERS: NearbyUser[] = [
  { id: "d1", name: "Kevin", avatar_url: null, slotIndex: 3 },
  { id: "d2", name: "Amina", avatar_url: null, slotIndex: 8 },
  { id: "d3", name: "Brian", avatar_url: null, slotIndex: 1 },
];

export default function WalletScreen() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [balance, setBalance] = useState(0);
  const [transferCredits, setTransferCredits] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showTopUp, setShowTopUp] = useState(false);
  const [discovered, setDiscovered] = useState<NearbyUser[]>([]);

  useEffect(() => {
    if (!user) return;
    loadWallet();
  }, [user]);

  // Simulate staggered discovery: first at 2s, second at 4s, third at 6s
  useEffect(() => {
    const timers = SIMULATED_USERS.map((u, i) =>
      setTimeout(() => {
        setDiscovered((prev) => [...prev, u]);
      }, 2000 + i * 2000)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  const loadWallet = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const bal = await fetchYutoBalance(user.id);
      setBalance(bal);
      const { data: creditsRow } = await supabase
        .from("transfer_credits")
        .select("balance_kes")
        .eq("user_id", user.id)
        .maybeSingle();
      setTransferCredits(Number(creditsRow?.balance_kes ?? 0));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    navigate("/auth");
    return null;
  }

  const discoveredSlots = new Set(discovered.map((d) => d.slotIndex));

  return (
    <div className="flex flex-col min-h-full bg-white dark:bg-black text-black dark:text-white px-5 pt-8 pb-24 transition-colors overflow-y-auto">
      {/* Balance hero */}
      <div className="bg-black dark:bg-zinc-900 rounded-3xl p-6 relative overflow-hidden mb-4">
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/5 rounded-full blur-3xl" />
        <div className="relative z-10">
          <p className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-1">Your Balance</p>
          <div className="flex items-baseline gap-1 mb-4">
            <span className="text-white/60 text-lg font-medium">KSH</span>
            <span className="text-white text-4xl font-black tracking-tight">
              {loading ? "..." : balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowTopUp(true)} className="flex-1 py-3 bg-white text-black rounded-xl font-bold text-sm flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform border-none">
              <Plus size={16} strokeWidth={3} /> Top Up
            </button>
            <button onClick={() => navigate("/profile")} className="flex-1 py-3 bg-white/10 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform border-none">
              <ArrowDownLeft size={16} /> Cash Out
            </button>
          </div>
        </div>
      </div>

      {/* NO WIFI + Credits badges */}
      <div className="flex items-center justify-center gap-2 mb-2">
        <div className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 px-3 py-1.5 rounded-full">
          <WifiOff size={12} className="text-emerald-600 dark:text-emerald-400" />
          <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">No WiFi needed</span>
        </div>
        <div className="bg-gray-100 dark:bg-zinc-800 px-3 py-1.5 rounded-full">
          <span className="text-[11px] font-bold text-gray-600 dark:text-gray-400">KSH {Math.round(transferCredits)} credits</span>
        </div>
      </div>

      {/* Proximity radar */}
      <div className="relative w-full aspect-square max-w-[340px] mx-auto mb-2">
        {/* SVG: rings + rope lines + traveling balls */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 340 340" preserveAspectRatio="xMidYMid meet" style={{ zIndex: 1 }}>
          {/* Background rings */}
          <circle cx="170" cy="170" r="60" fill="none" stroke="#f0f0f0" strokeWidth="1" className="dark:opacity-20" />
          <circle cx="170" cy="170" r="110" fill="none" stroke="#f0f0f0" strokeWidth="0.5" strokeDasharray="4 6" className="dark:opacity-15" style={{ animation: "orbitSpin 60s linear infinite", transformOrigin: "170px 170px" }} />
          <circle cx="170" cy="170" r="145" fill="none" stroke="#f7f7f7" strokeWidth="0.5" className="dark:opacity-10" />

          {/* Scanning pulse */}
          <circle cx="170" cy="170" r="30" fill="none" stroke="#10b981" strokeWidth="1.5" opacity="0">
            <animate attributeName="r" from="30" to="100" dur="2.5s" repeatCount="indefinite" />
            <animate attributeName="opacity" from="0.35" to="0" dur="2.5s" repeatCount="indefinite" />
          </circle>
          <circle cx="170" cy="170" r="30" fill="none" stroke="#10b981" strokeWidth="1" opacity="0">
            <animate attributeName="r" from="30" to="100" dur="2.5s" begin="1.2s" repeatCount="indefinite" />
            <animate attributeName="opacity" from="0.2" to="0" dur="2.5s" begin="1.2s" repeatCount="indefinite" />
          </circle>

          {/* Rope lines from center to each ghost node */}
          {ghostSlots.map((ghost, i) => {
            const isFound = discoveredSlots.has(i);
            const endX = 170 + Math.cos(ghost.angle) * ghost.r;
            const endY = 170 + Math.sin(ghost.angle) * ghost.r;
            const cpX = (170 + endX) / 2 + Math.cos(ghost.angle + 0.5) * 25;
            const cpY = (170 + endY) / 2 + 25;
            const pathD = `M 170 170 Q ${cpX} ${cpY} ${endX} ${endY}`;
            const motionD = `M 0 0 Q ${cpX - 170} ${cpY - 170} ${endX - 170} ${endY - 170}`;

            return (
              <g key={ghost.id}>
                {/* The rope line */}
                <path
                  d={pathD}
                  fill="none"
                  stroke={isFound ? "#22c55e" : "#e0e0e0"}
                  strokeWidth={isFound ? 2.5 : 1}
                  strokeDasharray={isFound ? "none" : "4 6"}
                  strokeLinecap="round"
                  className={isFound ? "rope-yank" : "dark:opacity-30"}
                  style={isFound ? { transition: "stroke 0.5s, stroke-width 0.5s" } : undefined}
                />
                {/* Green glow on discovered */}
                {isFound && <path d={pathD} fill="none" stroke="#22c55e" strokeWidth={8} opacity={0.1} strokeLinecap="round" />}
                {/* End dot */}
                <circle cx={endX} cy={endY} r={isFound ? 5 : 2} fill={isFound ? "#22c55e" : "#e0e0e0"} className={isFound ? "" : "dark:opacity-40"} />
                {/* Traveling blue ball animation (only on undiscovered lines) */}
                {!isFound && (
                  <g transform="translate(170,170)">
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

        {/* Center — You */}
        <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 10 }}>
          <div className="w-[76px] h-[76px] rounded-full bg-black dark:bg-white border-[3px] border-emerald-500 flex items-center justify-center shadow-xl shadow-emerald-500/20">
            <span className="text-white dark:text-black font-black text-lg">You</span>
          </div>
        </div>

        {/* Ghost + Discovered nodes */}
        {ghostSlots.map((ghost, i) => {
          const isFound = discoveredSlots.has(i);
          const foundUser = discovered.find((d) => d.slotIndex === i);
          const x = Math.cos(ghost.angle) * ghost.r;
          const y = Math.sin(ghost.angle) * ghost.r;

          if (isFound && foundUser) {
            return (
              <div
                key={ghost.id}
                className="absolute left-1/2 top-1/2"
                style={{
                  transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
                  transition: "transform 0.7s cubic-bezier(0.34, 1.56, 0.64, 1)",
                  zIndex: 20,
                }}
              >
                <div className="flex flex-col items-center node-snap-in">
                  <button
                    type="button"
                    onClick={() => toast.success(`Sending to ${foundUser.name}...`)}
                    className="bg-transparent border-none flex flex-col items-center"
                  >
                    <div className="relative node-glow">
                      <div className="w-[60px] h-[60px] rounded-full bg-black dark:bg-white border-[3px] border-emerald-500 flex items-center justify-center font-bold text-xl text-white dark:text-black shadow-xl shadow-emerald-500/25 overflow-hidden">
                        {foundUser.avatar_url ? (
                          <img src={foundUser.avatar_url} alt={foundUser.name} className="w-full h-full object-cover" />
                        ) : (
                          foundUser.name.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="absolute -bottom-0.5 -right-0.5 bg-emerald-500 rounded-full p-0.5">
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                    <p className="text-xs font-semibold mt-1 text-black dark:text-white">{foundUser.name}</p>
                  </button>
                </div>
              </div>
            );
          }

          // Ghost node — blurred, no name
          return (
            <div
              key={ghost.id}
              className="absolute left-1/2 top-1/2"
              style={{
                transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
                zIndex: 5,
              }}
            >
              <div
                className="w-[40px] h-[40px] rounded-full bg-gray-100 dark:bg-zinc-800 border-2 border-gray-200 dark:border-zinc-700"
                style={{ filter: "blur(2px)", opacity: 0.4 }}
              />
            </div>
          );
        })}
      </div>

      {/* Status */}
      <p className="text-center text-xs text-gray-400 mb-4">
        {discovered.length === 0 ? "Scanning for friends nearby..." : `${discovered.length} friend${discovered.length === 1 ? "" : "s"} nearby`}
      </p>

      {/* How it works */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="bg-gray-50 dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-3.5 text-center">
          <p className="text-lg mb-1">📶</p>
          <p className="font-bold text-xs text-black dark:text-white">Close range</p>
          <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold mt-0.5">Bluetooth · Free</p>
        </div>
        <div className="bg-gray-50 dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-3.5 text-center">
          <p className="text-lg mb-1">🌍</p>
          <p className="font-bold text-xs text-black dark:text-white">Long distance</p>
          <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold mt-0.5">No WiFi · Credits</p>
        </div>
      </div>

      {/* Send button */}
      <button
        onClick={() => navigate("/profile")}
        className="w-full py-4 bg-black dark:bg-white text-white dark:text-black rounded-2xl font-bold text-base flex items-center justify-center gap-2 active:scale-[0.98] transition-transform border-none"
      >
        <Send size={18} /> Send to anyone
      </button>

      {showTopUp && (
        <YutoBalanceTopUpModal
          open={showTopUp}
          onClose={() => setShowTopUp(false)}
          onSuccess={() => { setShowTopUp(false); loadWallet(); }}
        />
      )}
    </div>
  );
}
