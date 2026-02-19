import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import imgYutoMascot from "figma:asset/28c11cb437762e8469db46974f467144b8299a8c.png";
import { useAuth } from "../contexts/AuthContext";

export default function AuthScreen() {
  const navigate = useNavigate();
  const { user, signUp, signIn } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (user) {
      const redirect = sessionStorage.getItem("joinAfterAuth");
      if (redirect) {
        sessionStorage.removeItem("joinAfterAuth");
        navigate(redirect, { replace: true });
      } else {
        navigate("/split", { replace: true });
      }
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
        await signUp(username, password, displayName);
      } else {
        await signIn(username, password);
      }
      navigate("/split");
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
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8 flex flex-col items-center">
        <div className="w-28 h-28 mb-4">
          <img alt="Yuto" className="w-full h-full object-contain" src={imgYutoMascot} />
        </div>

        <h1 className="text-2xl font-bold text-black mb-1">
          {mode === "login" ? "Welcome back" : "Create account"}
        </h1>
        <p className="text-gray-400 text-sm mb-6">
          {mode === "login"
            ? "Log in to your Yuto account"
            : "Join Yuto and start splitting fares"}
        </p>

        <div className="w-full space-y-3 mb-5">
          {mode === "signup" && (
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              className="w-full h-12 border border-gray-300 rounded-full px-5 text-base outline-none focus:border-black transition-colors"
            />
          )}
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
            placeholder="Username"
            autoCapitalize="none"
            className="w-full h-12 border border-gray-300 rounded-full px-5 text-base outline-none focus:border-black transition-colors"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full h-12 border border-gray-300 rounded-full px-5 text-base outline-none focus:border-black transition-colors"
          />
        </div>

        {error && <p className="text-red-500 text-sm text-center mb-4">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={isLoading}
          className="w-full py-4 bg-black text-white font-semibold text-lg rounded-full hover:bg-gray-800 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {isLoading ? "Loading..." : mode === "login" ? "Log In" : "Sign Up"}
        </button>

        <p className="mt-6 text-sm text-gray-400">
          {mode === "login" ? "Don't have an account? " : "Already have an account? "}
          <button
            onClick={() => {
              setMode(mode === "login" ? "signup" : "login");
              setError("");
            }}
            className="text-black font-semibold bg-transparent border-none cursor-pointer p-0"
          >
            {mode === "login" ? "Sign Up" : "Log In"}
          </button>
        </p>
      </div>
    </div>
  );
}
