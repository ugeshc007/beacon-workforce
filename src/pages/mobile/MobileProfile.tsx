import { useMobileAuth } from "@/hooks/useMobileAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { LogOut, User, Shield, Building2 } from "lucide-react";

export default function MobileProfile() {
  const { employee, signOut } = useMobileAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/m/login", { replace: true });
  };

  return (
    <div className="flex flex-col gap-4 p-4 pb-24 safe-area-inset">
      <h1 className="text-xl font-bold text-foreground">Profile</h1>

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

      <div className="mt-auto pt-4">
        <Button variant="destructive" className="w-full h-12" onClick={handleSignOut}>
          <LogOut className="mr-2 h-5 w-5" />
          Sign Out
        </Button>
      </div>
    </div>
  );
}
