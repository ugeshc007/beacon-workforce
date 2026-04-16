import { useMobileAuth } from "@/hooks/useMobileAuth";
import { useBiometricAuth } from "@/hooks/useBiometricAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useNavigate } from "react-router-dom";
import { LogOut, User, Shield, Building2, Moon, Sun, Fingerprint } from "lucide-react";
import { useEffect, useState } from "react";

export default function MobileProfile() {
  const { employee, signOut } = useMobileAuth();
  const { isAvailable: biometricAvailable, isEnabled: biometricEnabled, toggleBiometric } = useBiometricAuth();
  const navigate = useNavigate();

  // Theme state — CSS default is dark (:root), light is toggled via .light class
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === "undefined") return true;
    const saved = localStorage.getItem("bebright-theme");
    if (saved) return saved === "dark";
    return !document.documentElement.classList.contains("light");
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.remove("light");
      localStorage.setItem("bebright-theme", "dark");
    } else {
      document.documentElement.classList.add("light");
      localStorage.setItem("bebright-theme", "light");
    }
  }, [isDark]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/m/login", { replace: true });
  };

  return (
    <div className="flex flex-col gap-4 p-4 pb-24 safe-area-inset">
      <h1 className="text-xl font-bold text-foreground">Profile</h1>

      {/* Avatar + name */}
      <Card className="p-4 border-border/50 bg-card">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-brand/10 flex items-center justify-center">
            <User className="w-7 h-7 text-brand" />
          </div>
          <div>
            <p className="font-semibold text-foreground">{employee?.name}</p>
            <p className="text-sm text-muted-foreground">{employee?.email}</p>
          </div>
        </div>
      </Card>

      {/* Info */}
      <Card className="p-4 border-border/50 bg-card space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Role</span>
          </div>
          <span className="text-sm font-medium text-foreground capitalize">{employee?.skillType?.replace("_", " ")}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Employee Code</span>
          </div>
          <span className="text-sm font-medium text-foreground">{employee?.employeeCode}</span>
        </div>
      </Card>

      {/* Settings */}
      <Card className="p-4 border-border/50 bg-card space-y-4">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Settings</p>

        {/* Theme toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isDark ? <Moon className="h-4 w-4 text-muted-foreground" /> : <Sun className="h-4 w-4 text-muted-foreground" />}
            <span className="text-sm text-foreground">Dark Mode</span>
          </div>
          <Switch checked={isDark} onCheckedChange={setIsDark} />
        </div>

        {/* Biometric toggle (native only) */}
        {biometricAvailable && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Fingerprint className="h-4 w-4 text-muted-foreground" />
              <div>
                <span className="text-sm text-foreground">Biometric Unlock</span>
                <p className="text-[11px] text-muted-foreground">Use fingerprint or face to unlock</p>
              </div>
            </div>
            <Switch checked={biometricEnabled} onCheckedChange={toggleBiometric} />
          </div>
        )}
      </Card>

      {/* Sign out */}
      <div className="mt-auto pt-4">
        <Button variant="destructive" className="w-full h-12" onClick={handleSignOut}>
          <LogOut className="mr-2 h-5 w-5" />
          Sign Out
        </Button>
      </div>
    </div>
  );
}
