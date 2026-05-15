import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { YutoLogo } from "../components/YutoLogo";
import { useAuth } from "../contexts/AuthContext";
import {
  attachVerifiedPhoneAfterSignup,
  normalizeMpesaNumber,
  signUp as supaSignUp,
  signIn as supaSignIn,
} from "../lib/supabase";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "../components/ui/input-otp";

type SignupStep = "phone" | "otp" | "profile";

export default function AuthScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const params = new URLSearchParams(location.search);
  const hasSecretKey = params.get("key") === "yuto2026";
  const signupsOpen = hasSecretKey || !!sessionStorage.getItem("yuto_signup_key");

  useEffect(() => {
    if (hasSecretKey) sessionStorage.setItem("yuto_signup_key", "1");
  }, [hasSecretKey]);

  const [mode, setMode] = useState<"login" | "signup">(
    location.state?.defaultMode === "signup" && signupsOpen ? "signup" : "login",
  );
  const [signupStep, setSignupStep] = useState<SignupStep>("phone");
  const [phoneLocal, setPhoneLocal] = useState("");
  const [otp, setOtp] = useState("");
  const [verificationToken, setVerificationToken] = useState<string | null>(null);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    // Sign-up waits for verified phone attach before leaving this screen.
    if (sessionStorage.getItem("signupPhonePending")) return;

    const redirect = sessionStorage.getItem("joinAfterAuth");
    if (redirect) {
      sessionStorage.removeItem("joinAfterAuth");
      navigate(redirect, { replace: true });
      return;
    }
    const showPwaPrompt = sessionStorage.getItem("showPwaPrompt");
    sessionStorage.removeItem("showPwaPrompt");
    const isStandalone =
      (navigator as { standalone?: boolean }).standalone ||
      window.matchMedia("(display-mode: standalone)").matches;
    if (showPwaPrompt === "1" && !isStandalone) {
      navigate("/add-to-home", { replace: true });
    } else {
      navigate("/home", { replace: true });
    }
  }, [user, navigate]);

  const resetSignupWizard = () => {
    setSignupStep("phone");
    setPhoneLocal("");
    setOtp("");
    setVerificationToken(null);
  };

  const fullPhone = phoneLocal.length >= 9 ? normalizeMpesaNumber(`+254${phoneLocal.replace(/\D/g, "")}`) : "";

  const handleSendCode = async () => {
    setError("");
    const digits = phoneLocal.replace(/\D/g, "");
    if (digits.length !== 9) {
      setError("Enter your 9-digit mobile number.");
      return;
    }
    const normalized = normalizeMpesaNumber(`+254${digits}`);
    setIsLoading(true);
    try {
      const res = await fetch("/api/phone-request-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: normalized }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Could not send code.");
      setSignupStep("otp");
      setOtp("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setError("");
    if (otp.replace(/\D/g, "").length !== 6) {
      setError("Enter the 6-digit code.");
      return;
    }
    const digits = phoneLocal.replace(/\D/g, "");
    const normalized = normalizeMpesaNumber(`+254${digits}`);
    setIsLoading(true);
    try {
      const res = await fetch("/api/phone-verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: normalized, code: otp.replace(/\D/g, "") }),
      });
      const data = (await res.json()) as { error?: string; verification_token?: string };
      if (!res.ok) throw new Error(data.error || "Verification failed.");
      if (!data.verification_token) throw new Error("Invalid server response.");
      setVerificationToken(data.verification_token);
      setSignupStep("profile");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    setError("");

    if (mode === "signup" && signupsOpen) {
      if (signupStep !== "profile" || !verificationToken) {
        setError("Verify your phone number first.");
        return;
      }
    }

    if (!username.trim() || !password) {
      setError("Please fill in all fields");
      return;
    }
    if (mode === "signup" && !displayName.trim()) {
      setError("Please enter your name");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setIsLoading(true);
    try {
      if (mode === "signup") {
        if (!signupsOpen) {
          setError("Signups are paused — we're launching soon. Follow us for updates!");
          setIsLoading(false);
          return;
        }
        sessionStorage.setItem("signupPhonePending", "1");
        try {
          await supaSignUp(username, password, displayName);
        } catch (signUpErr: unknown) {
          sessionStorage.removeItem("signupPhonePending");
          throw signUpErr;
        }
        sessionStorage.setItem("showPwaPrompt", "1");
        try {
          await attachVerifiedPhoneAfterSignup(verificationToken!);
        } catch (attachErr: unknown) {
          const msg = attachErr instanceof Error ? attachErr.message : "Could not save verified phone.";
          setError(`Account created, but phone link failed: ${msg} Use "Retry linking phone" below.`);
          setIsLoading(false);
          return;
        }
        sessionStorage.removeItem("signupPhonePending");
      } else {
        await supaSignIn(username, password);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      if (msg.includes("Invalid login")) {
        setError("Wrong username or password");
      } else if (msg.includes("already registered") || msg.includes("already been registered")) {
        setError("Username already taken");
      } else {
        setError(msg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const retryAttachOnly = async () => {
    if (!verificationToken) return;
    setError("");
    setIsLoading(true);
    sessionStorage.setItem("signupPhonePending", "1");
    try {
      await attachVerifiedPhoneAfterSignup(verificationToken);
      sessionStorage.removeItem("signupPhonePending");
      sessionStorage.setItem("showPwaPrompt", "1");
      navigate("/home", { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Retry failed.");
    } finally {
      setIsLoading(false);
    }
  };

  const headline =
    mode === "login"
      ? "Welcome back"
      : signupStep === "phone"
        ? "Verify your phone"
        : signupStep === "otp"
          ? "Enter the code"
          : "Join Yuto";

  const sub =
    mode === "login"
      ? "Log in to your Yuto account"
      : signupStep === "phone"
        ? "We'll text you a code to keep accounts real."
        : signupStep === "otp"
          ? `Sent to +254 ${phoneLocal.replace(/\D/g, "")}`
          : "The social payment app for Kenyan youth";

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black flex items-center justify-center p-4 transition-colors">
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl shadow-xl p-8 flex flex-col items-center">
        <div className="w-28 h-28 mb-4">
          <YutoLogo className="w-full h-full object-contain" />
        </div>

        <h1 className="text-2xl font-bold text-black dark:text-white mb-1">{headline}</h1>
        <p className="text-gray-400 text-sm mb-6 text-center">{sub}</p>

        <div className="w-full space-y-3 mb-5">
          {mode === "signup" && signupsOpen && signupStep === "phone" && (
            <div className="flex items-center gap-3 px-5 py-4 bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-full">
              <span className="text-lg font-medium text-gray-600 dark:text-gray-300">+254</span>
              <input
                type="tel"
                value={phoneLocal}
                onChange={(e) => setPhoneLocal(e.target.value.replace(/\D/g, "").slice(0, 9))}
                placeholder="712 345 678"
                className="flex-1 outline-none bg-transparent text-lg text-black dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                maxLength={9}
              />
            </div>
          )}

          {mode === "signup" && signupsOpen && signupStep === "otp" && (
            <div className="flex flex-col items-center gap-3">
              <InputOTP
                maxLength={6}
                value={otp}
                onChange={(v) => setOtp(v)}
                containerClassName="gap-2 justify-center"
              >
                <InputOTPGroup className="gap-2">
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <InputOTPSlot key={i} index={i} className="w-10 h-12 rounded-xl border border-gray-300 dark:border-zinc-600 text-lg" />
                  ))}
                </InputOTPGroup>
              </InputOTP>
              <button
                type="button"
                onClick={() => {
                  setSignupStep("phone");
                  setOtp("");
                  setError("");
                }}
                className="text-xs text-gray-500 dark:text-gray-400 bg-transparent border-none cursor-pointer underline"
              >
                Wrong number? Change
              </button>
            </div>
          )}

          {mode === "signup" && signupsOpen && signupStep === "profile" && (
            <>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                className="w-full h-12 border border-gray-300 dark:border-zinc-700 rounded-full px-5 text-base outline-none focus:border-black dark:focus:border-white bg-transparent text-black dark:text-white transition-colors"
              />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                placeholder="Username"
                autoCapitalize="none"
                className="w-full h-12 border border-gray-300 dark:border-zinc-700 rounded-full px-5 text-base outline-none focus:border-black dark:focus:border-white bg-transparent text-black dark:text-white transition-colors"
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full h-12 border border-gray-300 dark:border-zinc-700 rounded-full px-5 text-base outline-none focus:border-black dark:focus:border-white bg-transparent text-black dark:text-white transition-colors"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Phone verified: +{fullPhone || "254…"}
              </p>
            </>
          )}

          {mode === "login" && (
            <>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                placeholder="Username"
                autoCapitalize="none"
                className="w-full h-12 border border-gray-300 dark:border-zinc-700 rounded-full px-5 text-base outline-none focus:border-black dark:focus:border-white bg-transparent text-black dark:text-white transition-colors"
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full h-12 border border-gray-300 dark:border-zinc-700 rounded-full px-5 text-base outline-none focus:border-black dark:focus:border-white bg-transparent text-black dark:text-white transition-colors"
              />
            </>
          )}
        </div>

        {error && <p className="text-red-500 text-sm text-center mb-4">{error}</p>}

        {mode === "signup" && signupsOpen && signupStep === "phone" && (
          <button
            type="button"
            onClick={handleSendCode}
            disabled={isLoading || phoneLocal.replace(/\D/g, "").length !== 9}
            className="w-full py-4 bg-black dark:bg-white text-white dark:text-black font-semibold text-lg rounded-full hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isLoading ? "Sending…" : "Send code"}
          </button>
        )}

        {mode === "signup" && signupsOpen && signupStep === "otp" && (
          <div className="w-full space-y-3">
            <button
              type="button"
              onClick={handleVerifyOtp}
              disabled={isLoading || otp.replace(/\D/g, "").length !== 6}
              className="w-full py-4 bg-black dark:bg-white text-white dark:text-black font-semibold text-lg rounded-full hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isLoading ? "Checking…" : "Continue"}
            </button>
            <button
              type="button"
              onClick={handleSendCode}
              disabled={isLoading}
              className="w-full py-2 text-sm text-gray-600 dark:text-gray-400 bg-transparent border-none cursor-pointer"
            >
              Resend code
            </button>
          </div>
        )}

        {mode === "signup" && signupsOpen && signupStep === "profile" && (
          <>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isLoading}
              className="w-full py-4 bg-black dark:bg-white text-white dark:text-black font-semibold text-lg rounded-full hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isLoading ? "Loading..." : "Sign Up"}
            </button>
            {error?.includes("phone link failed") && (
              <button
                type="button"
                onClick={retryAttachOnly}
                disabled={isLoading}
                className="w-full mt-2 py-3 text-sm font-semibold rounded-full border border-gray-300 dark:border-zinc-600 text-black dark:text-white"
              >
                Retry linking phone
              </button>
            )}
          </>
        )}

        {mode === "login" && (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isLoading}
            className="w-full py-4 bg-black dark:bg-white text-white dark:text-black font-semibold text-lg rounded-full hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isLoading ? "Loading..." : "Log In"}
          </button>
        )}

        {mode === "signup" && signupStep === "profile" && (
          <p className="mt-3 text-xs text-gray-400 text-center">
            By signing up, you agree to our{" "}
            <a href="/terms" target="_blank" className="text-black dark:text-white font-semibold underline">
              Terms of Service
            </a>
            {" "}and{" "}
            <a href="/privacy" target="_blank" className="text-black dark:text-white font-semibold underline">
              Privacy Policy
            </a>
          </p>
        )}

        <p className="mt-6 text-sm text-gray-400">
          {mode === "login" ? (
            signupsOpen ? (
              <>
                Don&apos;t have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("signup");
                    setError("");
                    resetSignupWizard();
                  }}
                  className="text-black dark:text-white font-semibold bg-transparent border-none cursor-pointer p-0"
                >
                  Sign Up
                </button>
              </>
            ) : (
              <>Signups opening soon — browse the app to see what&apos;s coming</>
            )
          ) : (
            <>
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setError("");
                  resetSignupWizard();
                }}
                className="text-black dark:text-white font-semibold bg-transparent border-none cursor-pointer p-0"
              >
                Log In
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
