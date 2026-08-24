import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isNativeApp } from "@/lib/capacitor";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading, authError, retryAuth } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (authError && !session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background p-6 text-center">
        <p className="text-lg font-semibold text-foreground">Couldn't load your account</p>
        <p className="max-w-sm text-sm text-muted-foreground">{authError}</p>
        <Button onClick={retryAuth} className="gap-2"><RefreshCw className="h-4 w-4" /> Retry</Button>
      </div>
    );
  }

  if (isNativeApp()) {
    return <Navigate to={session ? "/m" : "/m/login"} replace />;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
