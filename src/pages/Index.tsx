import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { isNativeApp } from "@/lib/capacitor";

export default function Index() {
  const [status, setStatus] = useState<"loading" | "authed" | "anon">("loading");
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setStatus("anon"); return; }
      // Look up super_admin role
      const { data: u } = await supabase.from("users").select("id").eq("auth_id", session.user.id).maybeSingle();
      if (u?.id) {
        const { data: r } = await supabase.from("user_roles").select("role").eq("user_id", u.id).eq("role", "super_admin").maybeSingle();
        if (r) setIsSuperAdmin(true);
      }
      setStatus("authed");
    })();
  }, []);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <img src="/splash-butterfly.png" alt="BeBright" className="w-24 h-auto animate-bounce" />
        <p className="text-sm text-muted-foreground font-medium">Loading...</p>
      </div>
    );
  }

  if (isNativeApp()) {
    if (status === "anon") return <Navigate to="/m/login" replace />;
    return <Navigate to="/m" replace />;
  }

  if (status === "anon") return <Navigate to="/login" replace />;
  if (isSuperAdmin) return <Navigate to="/admin" replace />;
  return <Navigate to="/dashboard" replace />;
}
