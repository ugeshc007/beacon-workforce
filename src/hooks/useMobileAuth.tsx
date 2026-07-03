import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";
import { clearCachedDataByPrefix } from "@/lib/offline-queue";

interface EmployeeUser {
  id: string;          // employees.id
  authId: string;      // auth.uid
  name: string;
  email: string;
  employeeCode: string;
  skillType: string;
  branchId: string;
  isTeamLeader: boolean;
}

interface MobileAuthContextType {
  session: Session | null;
  employee: EmployeeUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const MobileAuthContext = createContext<MobileAuthContextType | undefined>(undefined);

const EMP_CACHE_KEY = "bb_emp_profile_v1";

function readCachedEmployee(authId: string): EmployeeUser | null {
  try {
    const raw = localStorage.getItem(EMP_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as EmployeeUser;
    return parsed.authId === authId ? parsed : null;
  } catch {
    return null;
  }
}

function writeCachedEmployee(emp: EmployeeUser) {
  try { localStorage.setItem(EMP_CACHE_KEY, JSON.stringify(emp)); } catch { /* ignore */ }
}

function clearCachedEmployee() {
  try { localStorage.removeItem(EMP_CACHE_KEY); } catch { /* ignore */ }
}

async function clearMobileSnapshots() {
  await clearCachedDataByPrefix();
  try {
    Object.keys(localStorage)
      .filter((key) => key.startsWith("pwl_") || key.startsWith("pwl_v2_") || key.startsWith("pws_") || key.startsWith("driver_legs_"))
      .forEach((key) => localStorage.removeItem(key));
  } catch { /* ignore */ }
}

export function MobileAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [employee, setEmployee] = useState<EmployeeUser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchEmployee = useCallback(async (authId: string): Promise<EmployeeUser | null> => {
    // Offline → use cache immediately, no network attempt
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      return readCachedEmployee(authId);
    }

    try {
      const { data, error } = await supabase
        .from("employees")
        .select("id, name, email, employee_code, skill_type, branch_id, auth_id")
        .eq("auth_id", authId)
        .single();

      if (error || !data) {
        // Network/server error → fall back to cache so user isn't locked out
        return readCachedEmployee(authId);
      }

      const emp: EmployeeUser = {
        id: data.id,
        authId,
        name: data.name,
        email: data.email || "",
        employeeCode: data.employee_code,
        skillType: data.skill_type,
        branchId: data.branch_id,
        isTeamLeader: data.skill_type === "team_leader",
      };
      writeCachedEmployee(emp);
      return emp;
    } catch {
      return readCachedEmployee(authId);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;
      setSession(session);
      if (session?.user) {
        const emp = await fetchEmployee(session.user.id);
        if (mounted) setEmployee(emp);
      }
      if (mounted) setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setSession(session);
      if (session?.user) {
        setLoading(true);
        setTimeout(async () => {
          if (!mounted) return;
          const emp = await fetchEmployee(session.user.id);
          if (mounted) {
            setEmployee(emp);
            setLoading(false);
          }
        }, 0);
      } else {
        setEmployee(null);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchEmployee]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    clearCachedEmployee();
    await clearMobileSnapshots().catch(() => {});
    try {
      await supabase.auth.signOut();
    } catch {
      // If the device is offline or the auth server is unreachable, still clear
      // the in-app state so the worker can return to the login screen.
    }
    setEmployee(null);
    setSession(null);
  };

  return (
    <MobileAuthContext.Provider value={{ session, employee, loading, signIn, signOut }}>
      {children}
    </MobileAuthContext.Provider>
  );
}

export function useMobileAuth() {
  const ctx = useContext(MobileAuthContext);
  if (!ctx) throw new Error("useMobileAuth must be used within MobileAuthProvider");
  return ctx;
}
