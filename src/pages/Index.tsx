import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { isNativeApp } from "@/lib/capacitor";

export default function Index() {
  const [status, setStatus] = useState<"loading" | "authed" | "anon">("loading");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setStatus(session ? "authed" : "anon");
    });
  }, []);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <img src="/splash-butterfly.png" alt="BeBright" className="w-24 h-auto animate-bounce" />
        <p className="text-sm text-muted-foreground font-medium">Loading...</p>
      </div>
    );
  }

  // Native app always uses mobile flow
  if (isNativeApp()) {
    if (status === "anon") return <Navigate to="/m/login" replace />;
    return <Navigate to="/m" replace />;
  }

  // Web portal uses admin flow
  if (status === "anon") return <Navigate to="/login" replace />;
  return <Navigate to="/dashboard" replace />;
}
