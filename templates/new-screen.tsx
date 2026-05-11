// Template: New Page Screen
// Copy to src/pages/MyNewScreen.tsx
// Add route in src/router.tsx (lazy loaded)

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function MyNewScreen() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    // Load data here
    setLoading(false);
  }, [user]);

  if (loading) {
    return (
      <div className="flex flex-col min-h-full items-center justify-center">
        <div className="w-8 h-8 border-2 border-black dark:border-white border-t-transparent dark:border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full px-5 pt-10 pb-6 bg-white dark:bg-black text-black dark:text-white transition-colors">
      <h1 className="text-2xl font-bold mb-6">My New Screen</h1>
      {/* Content here */}
    </div>
  );
}
