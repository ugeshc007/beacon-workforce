import { Outlet, NavLink, Navigate } from "react-router-dom";
import { useMobileAuth } from "@/hooks/useMobileAuth";
import { Home, ClipboardList, Bell, User, Loader2, Users, FileText } from "lucide-react";

export default function MobileLayout() {
  const { session, employee, loading } = useMobileAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
      </div>
    );
  }

  if (!session || !employee) {
    return <Navigate to="/m/login" replace />;
  }

  const isTeamLeader = employee.isTeamLeader;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border/50 safe-area-bottom z-50">
        <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
          <MobileNavItem to="/m" icon={Home} label="Home" end />
          <MobileNavItem to="/m/daily-log" icon={FileText} label="Log" />
          <MobileNavItem to="/m/timesheet" icon={ClipboardList} label="Timesheet" />
          {isTeamLeader && <MobileNavItem to="/m/team" icon={Users} label="Team" />}
          <MobileNavItem to="/m/notifications" icon={Bell} label="Alerts" />
          <MobileNavItem to="/m/profile" icon={User} label="Profile" />
        </div>
      </nav>
    </div>
  );
}

function MobileNavItem({
  to,
  icon: Icon,
  label,
  end,
}: {
  to: string;
  icon: React.ElementType;
  label: string;
  end?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors ${
          isActive
            ? "text-brand"
            : "text-muted-foreground hover:text-foreground"
        }`
      }
    >
      <Icon className="h-5 w-5" />
      <span className="text-[10px] font-medium">{label}</span>
    </NavLink>
  );
}
