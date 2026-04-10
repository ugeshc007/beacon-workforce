import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";

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

export function MobileAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [employee, setEmployee] = useState<EmployeeUser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchEmployee = useCallback(async (authId: string) => {
    try {
      const { data } = await supabase
        .from("employees")
        .select("id, name, email, employee_code, skill_type, branch_id, auth_id")
        .eq("auth_id", authId)
        .single();

      if (!data) return null;

      return {
        id: data.id,
        authId,
        name: data.name,
        email: data.email || "",
        employeeCode: data.employee_code,
        skillType: data.skill_type,
        branchId: data.branch_id,
        isTeamLeader: data.skill_type === "team_leader",
      };
    } catch {
      return null;
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
        setTimeout(async () => {
          if (!mounted) return;
          const emp = await fetchEmployee(session.user.id);
          if (mounted) setEmployee(emp);
        }, 0);
      } else {
        setEmployee(null);
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
    await supabase.auth.signOut();
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
