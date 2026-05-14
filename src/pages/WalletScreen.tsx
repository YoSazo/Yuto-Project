import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { supabase, fetchYutoBalance, authFetch } from "../lib/supabase";
import { Plus, ArrowDownLeft, Send } from "lucide-react";
import { toast } from "sonner";
import UserAvatar from "../components/UserAvatar";
import { YutoBalanceTopUpModal } from "../components/wallet/YutoBalanceTopUpModal";
import { initBluetooth, startScanning, stopBluetooth, sendViaBluetooth, syncOfflineTransactions, isBleAvailable, cacheBalanceLocally, getCachedBalance, getCachedUser, type NearbyYutoUser } from "../lib/bluetooth";

/**
 * Wallet page with real Bluetooth proximity P2P.
 * Scans for nearby Yuto users via BLE, shows them on the radar,
 * tap to open send modal.
 */

export default function WalletScreen() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showTopUp, setShowTopUp] = useState(false);
  const [nearbyUsers, setNearbyUsers] = useState<NearbyYutoUser[]>([]);
  const [bleReady, setBleReady] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [sendTarget, setSendTarget] = useState<NearbyYutoUser | null>(null);
  const [sendAmount, setSendAmount] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    loadWallet();
    if (user) setupBle();
    return () => { stopBluetooth(); };
  }, [user]);

  // Also reload wallet when navigating back to this screen
  useEffect(() => {
    loadWallet();
  }, []);

  // Sync offline transactions — needs user to be authenticated
  useEffect(() => {
    if (!user) return;
    const doSync = async () => {
      try {
        const synced = await syncOfflineTransactions();
        if (synced > 0) {
          toast.success(`${synced} offline transfer${synced > 1 ? "s" : ""} settled!`);
        }
        // Refresh balance — only trust positive values from server
        const bal = await fetchYutoBalance(user.id);
        if (bal > 0) {
          setBalance(bal);
          cacheBalanceLocally(user.id, bal, user.user_metadata?.display_name || "You");
        }
      } catch {
        // Offline — that's fine
      }
    };
    doSync();
    window.addEventListener("online", doSync);
    return () => window.removeEventListener("online", doSync);
  }, [user]);

  // Listen for incoming BLE transactions
  useEffect(() => {
    const handler = (e: Event) => {
      const tx = (e as CustomEvent).detail;
      toast.success(`Received KSH ${tx.amount} via Bluetooth!`);
      // Immediately update balance (animate up)
      setBalance((prev) => prev + tx.amount);
    };
    window.addEventListener("yuto:ble-received", handler);
    return () => window.removeEventListener("yuto:ble-received", handler);
  }, []);

  // Realtime: listen for wallet balance changes (incoming transfers while online)
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("wallet-balance")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "wallets", filter: `user_id=eq.${user.id}` }, (payload) => {
        const newBalance = Number(payload.new?.balance ?? 0);
        setBalance(newBalance);
        // Update cache too
        cacheBalanceLocally(user.id, newBalance, user.user_metadata?.display_name || "You");
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const loadWallet = async () => {
    setLoading(true);
    
    // Read cached balance directly from native storage — works even without auth
    try {
      const { Preferences } = await import("@capacitor/preferences");
      const { value } = await Preferences.get({ key: "yuto_cached_balance" });
      if (value) {
        const cached = JSON.parse(value);
        if (cached.balance > 0) {
          setBalance(cached.balance);
        }
      }
    } catch {}

    // Try network fetch — update balance if successful
    if (user) {
      try {
        const bal = await Promise.race([
          fetchYutoBalance(user.id),
          new Promise<number>((_, reject) => setTimeout(() => reject(new Error("timeout")), 2500))
        ]);
        // fetchYutoBalance returns 0 on failure too, so only trust it if:
        // - bal > 0 (definitely real), OR
        // - we can verify we're actually online (make a quick check)
        if (bal > 0) {
          setBalance(bal);
          cacheBalanceLocally(user.id, bal, user.user_metadata?.display_name || "You");
        } else {
          // bal is 0 — could be real or could be offline failure
          // Only cache 0 if we had a positive cached value AND the fetch genuinely succeeded
          // For now: don't overwrite positive cache with 0 from potentially failed fetch
          const cached = getCachedBalance();
          if (!cached || cached.balance === 0) {
            setBalance(0);
            cacheBalanceLocally(user.id, 0, user.user_metadata?.display_name || "You");
          }
          // If cached > 0, keep showing cached (safer assumption)
        }
      } catch (e) {
        // Timeout or network error — keep cached value
        console.warn("[Wallet] Network unavailable, using cache");
      }
    }

    setLoading(false);
  };

  const setupBle = async () => {
    if (!isBleAvailable()) {
      console.log("[Wallet] Not a native app, BLE unavailable");
      return;
    }
    if (!user) return;
    const initialized = await initBluetooth(user.id);
    if (!initialized) return;
    setBleReady(true);
    setScanning(true);
    startScanning(user.id, (discovered) => {
      setNearbyUsers((prev) => {
        const exists = prev.find((u) => u.userId === discovered.userId);
        if (exists) {
          return prev.map((u) => u.userId === discovered.userId ? { ...u, rssi: discovered.rssi } : u);
        }
        return [...prev, discovered];
      });
    });
  };

  const handleSend = async () => {
    if (!user || !sendTarget || !sendAmount) return;
    const amount = parseInt(sendAmount);
    if (!amount || amount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (amount > balance) {
      toast.error("Insufficient balance");
      return;
    }
    setSending(true);

    // Timeout: if send takes more than 8 seconds, show error
    const timeout = setTimeout(() => {
      setSending(false);
      toast.error("Taking too long — friend may be out of range or not on wallet page");
    }, 8000);

    try {
      const result = await sendViaBluetooth(user.id, sendTarget, amount);
      clearTimeout(timeout);
      if (result.success) {
        toast.success(result.message);
        // Immediately update balance (animate down)
        setBalance((prev) => Math.max(0, prev - amount));
        setSendTarget(null);
        setSendAmount("");
        setSending(false);
      } else {
        toast.error(result.message);
        setSending(false);
      }
    } catch (e: any) {
      clearTimeout(timeout);
      toast.error(e?.message || "Send failed");
      setSending(false);
    }
  };

  if (!user) {
    navigate("/auth");
    return null;
  }

  // Ghost positions for the radar
  const ghostCount = 8;
  const ghostSlots = Array.from({ length: ghostCount }, (_, i) => {
    const angle = (i * 2 * Math.PI) / ghostCount + Math.PI / 5;
    const r = 100 + (i % 3) * 20;
    return { angle, r };
  });

  return (
    <div className="flex flex-col min-h-full bg-white dark:bg-black text-black dark:text-white px-5 pt-8 pb-24 transition-colors overflow-y-auto">
      {/* Balance hero */}
      <div className="bg-black dark:bg-zinc-900 rounded-3xl p-6 relative overflow-hidden mb-6">
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

      {/* Proximity radar */}
      <div className="relative w-full aspect-square max-w-[320px] mx-auto mb-4">
        {/* SVG rings + lines */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 320 320" preserveAspectRatio="xMidYMid meet" style={{ zIndex: 1 }}>
          <circle cx="160" cy="160" r="55" fill="none" stroke="#f0f0f0" strokeWidth="1" className="dark:opacity-20" />
          <circle cx="160" cy="160" r="100" fill="none" stroke="#f0f0f0" strokeWidth="0.5" strokeDasharray="4 6" className="dark:opacity-15" />
          <circle cx="160" cy="160" r="140" fill="none" stroke="#f7f7f7" strokeWidth="0.5" className="dark:opacity-10" />

          {/* Scanning pulse */}
          {scanning && (
            <>
              <circle cx="160" cy="160" r="30" fill="none" stroke="#10b981" strokeWidth="1.5" opacity="0">
                <animate attributeName="r" from="30" to="100" dur="2.5s" repeatCount="indefinite" />
                <animate attributeName="opacity" from="0.35" to="0" dur="2.5s" repeatCount="indefinite" />
              </circle>
              <circle cx="160" cy="160" r="30" fill="none" stroke="#10b981" strokeWidth="1" opacity="0">
                <animate attributeName="r" from="30" to="100" dur="2.5s" begin="1.2s" repeatCount="indefinite" />
                <animate attributeName="opacity" from="0.2" to="0" dur="2.5s" begin="1.2s" repeatCount="indefinite" />
              </circle>
            </>
          )}

          {/* Rope lines to ghost/discovered nodes */}
          {ghostSlots.map((ghost, i) => {
            const discovered = nearbyUsers[i];
            const endX = 160 + Math.cos(ghost.angle) * ghost.r;
            const endY = 160 + Math.sin(ghost.angle) * ghost.r;
            const cpX = (160 + endX) / 2 + Math.cos(ghost.angle + 0.5) * 20;
            const cpY = (160 + endY) / 2 + 20;
            const pathD = `M 160 160 Q ${cpX} ${cpY} ${endX} ${endY}`;
            const motionD = `M 0 0 Q ${cpX - 160} ${cpY - 160} ${endX - 160} ${endY - 160}`;
            const isFound = !!discovered;

            return (
              <g key={i}>
                <path d={pathD} fill="none" stroke={isFound ? "#22c55e" : "#e0e0e0"} strokeWidth={isFound ? 2.5 : 1} strokeDasharray={isFound ? "none" : "4 6"} strokeLinecap="round" className={isFound ? "rope-yank" : "dark:opacity-30"} />
                {isFound && <path d={pathD} fill="none" stroke="#22c55e" strokeWidth={8} opacity={0.1} strokeLinecap="round" />}
                <circle cx={endX} cy={endY} r={isFound ? 5 : 2} fill={isFound ? "#22c55e" : "#e0e0e0"} className={isFound ? "" : "dark:opacity-40"} />
                {!isFound && (
                  <g transform="translate(160,160)">
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
          <div className="w-[70px] h-[70px] rounded-full bg-black dark:bg-white border-[3px] border-emerald-500 flex items-center justify-center shadow-xl shadow-emerald-500/20">
            <span className="text-white dark:text-black font-black text-base">You</span>
          </div>
        </div>

        {/* Discovered users + ghost nodes */}
        {ghostSlots.map((ghost, i) => {
          const discovered = nearbyUsers[i];
          const x = Math.cos(ghost.angle) * ghost.r;
          const y = Math.sin(ghost.angle) * ghost.r;

          if (discovered) {
            return (
              <div key={i} className="absolute left-1/2 top-1/2" style={{ transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`, transition: "transform 0.7s cubic-bezier(0.34, 1.56, 0.64, 1)", zIndex: 20 }}>
                <button type="button" onClick={() => setSendTarget(discovered)} className="flex flex-col items-center node-snap-in bg-transparent border-none">
                  <div className="relative node-glow">
                    <div className="w-[56px] h-[56px] rounded-full bg-black dark:bg-white border-[3px] border-emerald-500 flex items-center justify-center font-bold text-lg text-white dark:text-black shadow-xl shadow-emerald-500/25 overflow-hidden">
                      {discovered.avatarUrl ? <img src={discovered.avatarUrl} alt={discovered.name} className="w-full h-full object-cover" /> : discovered.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 bg-emerald-500 rounded-full p-0.5">
                      <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                    </div>
                  </div>
                  <p className="text-xs font-semibold mt-1 text-black dark:text-white">{discovered.name.split(" ")[0]}</p>
                </button>
              </div>
            );
          }

          // Ghost node
          return (
            <div key={i} className="absolute left-1/2 top-1/2" style={{ transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`, zIndex: 5 }}>
              <div className="w-[36px] h-[36px] rounded-full bg-gray-100 dark:bg-zinc-800 border-2 border-gray-200 dark:border-zinc-700" style={{ filter: "blur(2px)", opacity: 0.4 }} />
            </div>
          );
        })}
      </div>

      {/* Bottom message */}
      <div className="bg-black dark:bg-zinc-900 rounded-2xl p-4 text-center">
        <p className="text-white text-sm font-semibold">
          {nearbyUsers.length > 0
            ? `${nearbyUsers.length} friend${nearbyUsers.length === 1 ? "" : "s"} nearby — tap to send`
            : bleReady
              ? "Get your friend in range to send money"
              : "Enable Bluetooth to find friends nearby"
          }
        </p>
        {!bleReady && (
          <button type="button" onClick={setupBle} className="mt-2 text-xs text-emerald-400 font-bold bg-transparent border-none">
            Enable Bluetooth
          </button>
        )}
      </div>

      {/* Send modal — opens when you tap a nearby user */}
      {sendTarget && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm fade-in">
          <button type="button" className="absolute inset-0 border-none bg-transparent" onClick={() => setSendTarget(null)} />
          <div className="relative z-10 w-full max-w-md bg-white dark:bg-zinc-900 rounded-t-3xl md:rounded-3xl p-6 modal-slide-up">
            <div className="flex flex-col items-center mb-6">
              <div className="w-16 h-16 rounded-full bg-black dark:bg-white border-[3px] border-emerald-500 flex items-center justify-center font-bold text-2xl text-white dark:text-black overflow-hidden mb-3">
                {sendTarget.avatarUrl ? <img src={sendTarget.avatarUrl} alt={sendTarget.name} className="w-full h-full object-cover" /> : sendTarget.name.charAt(0).toUpperCase()}
              </div>
              <p className="font-bold text-lg text-black dark:text-white">{sendTarget.name}</p>
              <p className="text-xs text-gray-400">Nearby via Bluetooth</p>
            </div>

            <div className="mb-6 text-center">
              <p className="text-sm text-gray-400 font-semibold mb-2">Amount (KSH)</p>
              <input
                type="text"
                inputMode="numeric"
                value={sendAmount}
                onChange={(e) => setSendAmount(e.target.value.replace(/\D/g, ""))}
                placeholder="0"
                className="text-[48px] font-bold text-center text-black dark:text-white bg-transparent border-none outline-none w-full"
                autoFocus
              />
              <p className="text-xs text-gray-400 mt-1">Balance: KSH {balance.toLocaleString()}</p>
            </div>

            <button
              type="button"
              onClick={handleSend}
              disabled={!sendAmount || parseInt(sendAmount) <= 0 || sending}
              className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-bold text-base disabled:opacity-40 active:scale-[0.98] transition-transform border-none flex items-center justify-center gap-2"
            >
              <Send size={18} /> {sending ? "Sending..." : "Send"}
            </button>

            <button type="button" onClick={() => { setSendTarget(null); setSending(false); setSendAmount(""); }} className="w-full py-3 mt-2 text-gray-400 font-semibold text-sm bg-transparent border-none">
              Cancel
            </button>
          </div>
        </div>
      )}

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
