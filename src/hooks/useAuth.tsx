import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

type UserRole = "admin" | "manager" | "supervisor";

interface AuthUser {
  id: string;
  authId: string;
  email: string;
  name: string;
  role: UserRole | null;
  branchId: string | null;
}

interface AuthContextType {
  session: Session | null;
  user: AuthUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  isAdmin: boolean;
  isManager: boolean;
  isSupervisor: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserProfile = async (authUser: User) => {
    try {
      const { data: userData } = await supabase
        .from("users")
        .select("id, name, email, branch_id, auth_id")
        .eq("auth_id", authUser.id)
        .single();

      if (!userData) return null;

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userData.id)
        .single();

      return {
        id: userData.id,
        authId: authUser.id,
        email: userData.email,
        name: userData.name,
        role: (roleData?.role as UserRole) ?? null,
        branchId: userData.branch_id,
      };
    } catch {
      return null;
    }
  };

  useEffect(() => {
    let mounted = true;

    // First set session synchronously from cache, then fetch profile
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;
      setSession(session);
      if (session?.user) {
        const profile = await fetchUserProfile(session.user);
        if (mounted) setUser(profile);
      }
      if (mounted) setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!mounted) return;
        setSession(session);
        if (session?.user) {
          // Defer profile fetch to avoid deadlock in auth callback
          setTimeout(async () => {
            if (!mounted) return;
            const profile = await fetchUserProfile(session.user);
            if (mounted) setUser(profile);
          }, 0);
        } else {
          setUser(null);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        loading,
        signIn,
        signOut,
        isAdmin: user?.role === "admin",
        isManager: user?.role === "manager",
        isSupervisor: user?.role === "supervisor",
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
