import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMobileAuth } from "@/hooks/useMobileAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { friendlyAuthMessage } from "@/lib/action-error";
import bebrightLogo from "@/assets/bebright-logo.png";
import { APP_VERSION, APP_BUILD } from "@/lib/app-version";

export default function MobileLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { signIn, session, loading: authLoading } = useMobileAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Redirect once the auth context has the session
  useEffect(() => {
    if (session && !authLoading) {
      navigate("/m", { replace: true });
    }
  }, [session, authLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const { error } = await signIn(email, password);
    if (error) {
      toast({
        title: "Login failed",
        description: friendlyAuthMessage(error.message),
        variant: "info",
      });
      import("@/lib/error-logger").then(({ logMobileError }) =>
        logMobileError({ category: "auth", action: "sign-in", message: error.message, context: { email } })
      );
      setIsLoading(false);
      return;
    }

    // Fire-and-forget prefetch so a first-launch-then-offline user still
    // has today's assignment snapshot cached on device.
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: emp } = await supabase
          .from("employees")
          .select("id")
          .eq("auth_id", user.id)
          .maybeSingle();
        if (emp?.id) {
          // Report app version / build / platform so the portal knows which
          // devices are on which build. Best-effort — never blocks login.
          try {
            const { Capacitor } = await import("@capacitor/core");
            const platform = Capacitor.getPlatform?.() ?? "web";
            await supabase
              .from("employees")
              .update({
                last_app_version: APP_VERSION,
                last_app_build: APP_BUILD,
                last_platform: platform,
                last_login_at: new Date().toISOString(),
              })
              .eq("id", emp.id);
          } catch { /* best-effort */ }

          const today = new Date().toISOString().slice(0, 10);
          const { data: assignments } = await supabase
            .from("project_assignments")
            .select("id, project_id, shift_start, shift_end, assigned_role, work_location, task, projects(name, site_address, site_latitude, site_longitude, site_gps_radius)")
            .eq("employee_id", emp.id)
            .eq("date", today);
          const { cacheData } = await import("@/lib/offline-queue");
          await cacheData(`today_projects_v2_${emp.id}_${today}`, assignments ?? []);
        }
      }
    } catch { /* best-effort */ }

    toast({ title: "Welcome!", description: "You're signed in." });
    // navigation handled by effect above once session propagates
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6 safe-area-inset">
      {/* Logo area */}
      <div className="flex flex-col items-center gap-5 mb-10">
        <div className="w-32 h-32 flex items-center justify-center rounded-3xl bg-white/95 p-4 shadow-[0_8px_30px_-6px_hsl(var(--brand)/0.35)] ring-1 ring-white/10">
          <img src={bebrightLogo} alt="Logo" className="w-full h-full object-contain" />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">Field Worker App</h1>
          <p className="text-sm text-muted-foreground mt-1">Sign in to continue</p>
        </div>
      </div>

      {/* Login form */}
      <div className="w-full max-w-sm space-y-5">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="m-email" className="text-sm">Email</Label>
            <Input
              id="m-email"
              type="email"
              placeholder="your.email@bebright.ae"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="h-12 text-base"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="m-password" className="text-sm">Password</Label>
            <div className="relative">
              <Input
                id="m-password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="h-12 text-base pr-12"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-10 w-10"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </Button>
            </div>
          </div>

          <Button type="submit" className="w-full h-12 text-base font-semibold" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Signing in...
              </>
            ) : (
              "Sign In"
            )}
          </Button>
        </form>

        <p className="text-center text-xs text-muted-foreground">
          Contact your supervisor if you need access.
        </p>

        <p className="text-center text-[10px] text-muted-foreground/70 pt-2">
          v{APP_VERSION} (build {APP_BUILD})
        </p>
      </div>
    </div>
  );
}
