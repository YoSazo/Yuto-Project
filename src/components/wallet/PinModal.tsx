import { useState, useEffect, useRef } from "react";
import { authFetch } from "../../lib/supabase";
import { Preferences } from "@capacitor/preferences";

interface PinModalProps {
  open: boolean;
  mode: "verify" | "setup" | "change";
  onSuccess: () => void;
  onCancel: () => void;
}

const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 3;

export function PinModal({ open, mode, onSuccess, onCancel }: PinModalProps) {
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [currentPin, setCurrentPin] = useState("");
  const [step, setStep] = useState<"current" | "enter" | "confirm">(mode === "change" ? "current" : mode === "setup" ? "enter" : "enter");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [countdown, setCountdown] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setPin("");
      setConfirmPin("");
      setCurrentPin("");
      setError("");
      setStep(mode === "change" ? "current" : mode === "setup" ? "enter" : "enter");
      checkLockout();
    }
  }, [open, mode]);

  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, step]);

  // Countdown timer
  useEffect(() => {
    if (!lockedUntil) { setCountdown(""); return; }
    const tick = () => {
      const remaining = lockedUntil - Date.now();
      if (remaining <= 0) {
        setLockedUntil(null);
        setCountdown("");
        Preferences.remove({ key: "pin_lockout_until" });
        Preferences.remove({ key: "pin_failed_count" });
        return;
      }
      const mins = Math.floor(remaining / 60000);
      const secs = Math.floor((remaining % 60000) / 1000);
      setCountdown(`${mins}:${secs.toString().padStart(2, "0")}`);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [lockedUntil]);

  async function checkLockout() {
    const { value } = await Preferences.get({ key: "pin_lockout_until" });
    if (value) {
      const until = parseInt(value);
      if (until > Date.now()) {
        setLockedUntil(until);
      } else {
        await Preferences.remove({ key: "pin_lockout_until" });
        await Preferences.remove({ key: "pin_failed_count" });
      }
    }
  }

  async function recordFailedAttempt() {
    const { value } = await Preferences.get({ key: "pin_failed_count" });
    const count = parseInt(value || "0") + 1;
    await Preferences.set({ key: "pin_failed_count", value: String(count) });
    if (count >= MAX_ATTEMPTS) {
      const until = Date.now() + LOCKOUT_DURATION_MS;
      await Preferences.set({ key: "pin_lockout_until", value: String(until) });
      setLockedUntil(until);
      authFetch("/api/audit", {
        method: "POST",
        body: JSON.stringify({ event_type: "pin_failed", metadata: { lockout: true } }),
      }).catch(() => {});
    }
  }

  async function resetFailedAttempts() {
    await Preferences.remove({ key: "pin_failed_count" });
  }

  async function handleVerify(pinToVerify: string) {
    setLoading(true);
    setError("");
    try {
      const res = await authFetch("/api/verify-pin", {
        method: "POST",
        body: JSON.stringify({ pin: pinToVerify }),
      });
      if (res.ok) {
        await resetFailedAttempts();
        onSuccess();
      } else {
        await recordFailedAttempt();
        setError("Incorrect PIN");
        setPin("");
        setCurrentPin("");
      }
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSetup(newPin: string) {
    setLoading(true);
    setError("");
    try {
      const res = await authFetch("/api/set-pin", {
        method: "POST",
        body: JSON.stringify({ pin: newPin }),
      });
      if (res.ok) {
        onSuccess();
      } else {
        setError("Failed to set PIN. Try again.");
      }
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleDigit(digit: string) {
    if (lockedUntil) return;

    if (step === "current") {
      const next = currentPin + digit;
      setCurrentPin(next);
      if (next.length === 4) {
        handleVerify(next).then(() => {
          // If verify succeeded, move to enter step for new PIN
          // onSuccess won't be called here for change mode — we override
        });
        // Actually for change mode, we need custom logic
        setLoading(true);
        authFetch("/api/verify-pin", { method: "POST", body: JSON.stringify({ pin: next }) })
          .then(async (res) => {
            if (res.ok) {
              await resetFailedAttempts();
              setStep("enter");
              setError("");
            } else {
              await recordFailedAttempt();
              setError("Incorrect PIN");
              setCurrentPin("");
            }
          })
          .catch(() => setError("Network error"))
          .finally(() => setLoading(false));
      }
    } else if (step === "enter") {
      const next = pin + digit;
      setPin(next);
      if (next.length === 4) {
        if (mode === "verify") {
          handleVerify(next);
        } else {
          // Setup or change — move to confirm
          setStep("confirm");
        }
      }
    } else if (step === "confirm") {
      const next = confirmPin + digit;
      setConfirmPin(next);
      if (next.length === 4) {
        if (next === pin) {
          handleSetup(next);
        } else {
          setError("PINs don't match. Try again.");
          setPin("");
          setConfirmPin("");
          setStep("enter");
        }
      }
    }
  }

  function handleBackspace() {
    if (step === "current") setCurrentPin((p) => p.slice(0, -1));
    else if (step === "enter") setPin((p) => p.slice(0, -1));
    else if (step === "confirm") setConfirmPin((p) => p.slice(0, -1));
  }

  const currentValue = step === "current" ? currentPin : step === "enter" ? pin : confirmPin;
  const title = lockedUntil
    ? "PIN Locked"
    : step === "current"
      ? "Enter Current PIN"
      : step === "confirm"
        ? "Confirm PIN"
        : mode === "setup"
          ? "Create Transaction PIN"
          : mode === "change"
            ? "Enter New PIN"
            : "Enter PIN";

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-xs bg-white dark:bg-zinc-900 rounded-3xl p-6 text-center shadow-2xl">
        <h2 className="text-lg font-bold text-black dark:text-white mb-2">{title}</h2>

        {lockedUntil ? (
          <div className="py-8">
            <p className="text-red-500 font-semibold text-sm mb-2">Too many failed attempts</p>
            <p className="text-3xl font-mono font-bold text-black dark:text-white">{countdown}</p>
            <p className="text-xs text-gray-400 mt-2">Try again later</p>
          </div>
        ) : (
          <>
            {/* PIN dots */}
            <div className="flex justify-center gap-3 my-6">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`w-4 h-4 rounded-full transition-all ${
                    i < currentValue.length
                      ? "bg-black dark:bg-white scale-110"
                      : "bg-gray-200 dark:bg-zinc-700"
                  }`}
                />
              ))}
            </div>

            {error && <p className="text-red-500 text-xs font-semibold mb-3">{error}</p>}

            {/* Numpad */}
            <div className="grid grid-cols-3 gap-2">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map((key) => (
                <button
                  key={key}
                  type="button"
                  disabled={loading || !key}
                  onClick={() => {
                    if (key === "⌫") handleBackspace();
                    else if (key) handleDigit(key);
                  }}
                  className={`h-14 rounded-xl text-xl font-bold transition-all border-none ${
                    !key
                      ? "invisible"
                      : key === "⌫"
                        ? "bg-gray-100 dark:bg-zinc-800 text-gray-500 active:bg-gray-200"
                        : "bg-gray-50 dark:bg-zinc-800 text-black dark:text-white active:bg-gray-200 dark:active:bg-zinc-700"
                  }`}
                >
                  {key}
                </button>
              ))}
            </div>
          </>
        )}

        <button
          type="button"
          onClick={onCancel}
          className="mt-4 w-full py-3 text-gray-400 font-semibold text-sm bg-transparent border-none"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
