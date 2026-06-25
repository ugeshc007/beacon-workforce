import { Outlet, NavLink, Navigate } from "react-router-dom";
import { useEffect } from "react";
import { useMobileAuth } from "@/hooks/useMobileAuth";
import { Home, ClipboardList, Bell, User, Loader2, Users, FileText, MapPin } from "lucide-react";
import { initAutoSync } from "@/lib/offline-sync";
import { initDailyLogAutoSync } from "@/lib/offline-daily-logs";
import { initSessionMirror } from "@/lib/mobile-session-persist";
import { SyncStatusBadge } from "@/components/mobile/SyncStatusBadge";

export default function MobileLayout() {
  const { session, employee, loading } = useMobileAuth();

  useEffect(() => {
    const cleanupActions = initAutoSync();
    const cleanupLogs = initDailyLogAutoSync();
    const cleanupMirror = initSessionMirror();
    return () => { cleanupActions(); cleanupLogs(); cleanupMirror(); };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/m/login" replace />;
  }

  if (!employee) {
    const offline = typeof navigator !== "undefined" && navigator.onLine === false;
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 text-center gap-3">
        <p className="text-base font-semibold text-foreground">
          {offline ? "You're offline" : "No employee profile linked"}
        </p>
        <p className="text-sm text-muted-foreground">
          {offline
            ? "Connect to the internet once so we can load your profile, then you can keep working offline."
            : "Your account isn't linked to an employee record. Please contact your supervisor."}
        </p>
      </div>
    );
  }

  const isTeamLeader = employee.isTeamLeader;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="fixed top-2 right-2 z-50 safe-area-top">
        <SyncStatusBadge />
      </div>
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border/50 safe-area-bottom z-50 pointer-events-auto">
        <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
          <MobileNavItem to="/m" icon={Home} label="Home" end />
          <MobileNavItem to="/m/site-visits" icon={MapPin} label="Visits" end />
          <MobileNavItem to="/m/timesheet" icon={ClipboardList} label="Timesheet" end />
          {isTeamLeader && <MobileNavItem to="/m/team" icon={Users} label="Team" end />}
          <MobileNavItem to="/m/notifications" icon={Bell} label="Alerts" end />
          <MobileNavItem to="/m/profile" icon={User} label="Profile" end />
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
