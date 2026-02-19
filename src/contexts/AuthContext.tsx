import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { User } from "@supabase/supabase-js";
import {
  supabase,
  signUp as supaSignUp,
  signIn as supaSignIn,
  signOut as supaSignOut,
  getProfile,
} from "../lib/supabase";

export interface Profile {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signUp: (username: string, password: string, displayName: string) => Promise<void>;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

async function fetchProfileWithRetry(userId: string, retries = 3): Promise<Profile | null> {
  try {
    return await getProfile(userId);
  } catch {
    if (retries > 0) {
      await new Promise((r) => setTimeout(r, 500));
      return fetchProfileWithRetry(userId, retries - 1);
    }
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        fetchProfileWithRetry(u.id).then((p) => {
          setProfile(p);
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        fetchProfileWithRetry(u.id).then(setProfile);
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignUp = async (username: string, password: string, displayName: string) => {
    await supaSignUp(username, password, displayName);
  };

  const handleSignIn = async (username: string, password: string) => {
    await supaSignIn(username, password);
  };

  const handleSignOut = async () => {
    await supaSignOut();
    setProfile(null);
  };

  const refreshProfile = async () => {
    if (user) {
      const p = await fetchProfileWithRetry(user.id);
      setProfile(p);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        signUp: handleSignUp,
        signIn: handleSignIn,
        signOut: handleSignOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
