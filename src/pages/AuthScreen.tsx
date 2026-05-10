import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import imgYutoMascot from "../assets/yuto-mascot.webp";
import { useAuth } from "../contexts/AuthContext";

export default function AuthScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signUp, signIn } = useAuth();

  // Secret bypass: ?key=yuto2026 allows signups
  const params = new URLSearchParams(location.search);
  const hasSecretKey = params.get("key") === "yuto2026";
  const signupsOpen = hasSecretKey || !!sessionStorage.getItem("yuto_signup_key");

  // Persist the key in session so navigating away doesn't lose it
  useEffect(() => {
    if (hasSecretKey) sessionStorage.setItem("yuto_signup_key", "1");
  }, [hasSecretKey]);
  
  const [mode, setMode] = useState<"login" | "signup">(
    location.state?.defaultMode === "signup" && signupsOpen ? "signup" : "login"
  );
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
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

  const handleSubmit = async () => {
    setError("");

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
        await signUp(username, password, displayName);
        sessionStorage.setItem("showPwaPrompt", "1");
      } else {
        await signIn(username, password);
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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black flex items-center justify-center p-4 transition-colors">
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl shadow-xl p-8 flex flex-col items-center">
        <div className="w-28 h-28 mb-4">
          <img alt="Yuto" className="w-full h-full object-contain" src={imgYutoMascot} />
        </div>

        <h1 className="text-2xl font-bold text-black dark:text-white mb-1">
          {mode === "login" ? "Welcome back" : "Join Yuto"}
        </h1>
        <p className="text-gray-400 text-sm mb-6">
          {mode === "login"
            ? "Log in to your Yuto account"
            : "The social payment app for Kenyan youth"}
        </p>

        <div className="w-full space-y-3 mb-5">
          {mode === "signup" && (
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              className="w-full h-12 border border-gray-300 dark:border-zinc-700 rounded-full px-5 text-base outline-none focus:border-black dark:focus:border-white bg-transparent text-black dark:text-white transition-colors"
            />
          )}
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
        </div>

        {error && <p className="text-red-500 text-sm text-center mb-4">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={isLoading}
          className="w-full py-4 bg-black dark:bg-white text-white dark:text-black font-semibold text-lg rounded-full hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {isLoading ? "Loading..." : mode === "login" ? "Log In" : "Sign Up"}
        </button>

        <p className="mt-6 text-sm text-gray-400">
          {mode === "login" ? (
            signupsOpen ? (
              <>Don't have an account?{" "}
                <button onClick={() => { setMode("signup"); setError(""); }} className="text-black dark:text-white font-semibold bg-transparent border-none cursor-pointer p-0">
                  Sign Up
                </button>
              </>
            ) : (
              <>Signups opening soon — browse the app to see what's coming</>
            )
          ) : (
            <>Already have an account?{" "}
              <button onClick={() => { setMode("login"); setError(""); }} className="text-black dark:text-white font-semibold bg-transparent border-none cursor-pointer p-0">
                Log In
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
