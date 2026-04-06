import { Sun, Moon, User, LogOut, ChevronDown, Lock } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { NotificationPanel } from "./NotificationPanel";
import { MorningBriefingDialog } from "./MorningBriefingDialog";
import { ChangePasswordDialog } from "@/components/auth/ChangePasswordDialog";

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/projects": "Projects",
  "/employees": "Employees",
  "/schedule": "Schedule",
  "/attendance": "Attendance",
  "/timesheets": "Timesheets",
  "/reports": "Reports",
  "/reports/utilization": "Staff Utilization",
  "/reports/attendance": "Attendance Report",
  "/reports/overtime": "Overtime Report",
  "/reports/costs": "Project Costs",
  "/reports/manpower": "Project Manpower",
  "/reports/absentee": "Absentee Report",
  "/reports/executive": "Executive Summary",
  "/reports/profitability": "Profitability",
  "/settings": "Settings",
};

export function AppHeader() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isDark, setIsDark] = useState(true);
  const [pwDialogOpen, setPwDialogOpen] = useState(false);
  const { user, signOut } = useAuth();
  const title = pageTitles[location.pathname] || (location.pathname.startsWith("/projects/") ? "Project Details" : "BeBright Planner");

  const toggleTheme = () => {
    setIsDark(!isDark);
    document.documentElement.classList.toggle("light");
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  return (
    <header className="h-14 flex items-center justify-between border-b border-border px-4 bg-background/80 backdrop-blur-sm sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
        <h1 className="text-base font-semibold text-foreground">{title}</h1>
      </div>

      <div className="flex items-center gap-1">
        <MorningBriefingDialog />
        <NotificationPanel />

        <Button variant="ghost" size="icon" onClick={toggleTheme} className="text-muted-foreground hover:text-foreground">
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground ml-1">
              <div className="h-7 w-7 rounded-full bg-brand/20 flex items-center justify-center">
                <User className="h-3.5 w-3.5 text-brand" />
              </div>
              <div className="hidden sm:flex flex-col items-start">
                <span className="text-sm font-medium leading-none">{user?.name || "User"}</span>
                <span className="text-[10px] text-muted-foreground capitalize">{user?.role || ""}</span>
              </div>
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium">{user?.name}</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/settings")}>
              <User className="mr-2 h-4 w-4" /> Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setPwDialogOpen(true)}>
              <Lock className="mr-2 h-4 w-4" /> Change Password
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" /> Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <ChangePasswordDialog open={pwDialogOpen} onOpenChange={setPwDialogOpen} />
      </div>
    </header>
  );
}
