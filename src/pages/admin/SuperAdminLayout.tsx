import { useEffect } from "react";
import { Navigate, Outlet, useNavigate, NavLink } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Building2, Users, LayoutDashboard, LogOut, Activity } from "lucide-react";

export default function SuperAdminLayout() {
  const { user, loading, signOut, isSuperAdmin } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    if (!loading && (!user || !isSuperAdmin)) {
      nav("/login", { replace: true });
    }
  }, [user, loading, isSuperAdmin, nav]);

  if (loading || !user) {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-950 text-slate-300">Loading…</div>
    );
  }
  if (!isSuperAdmin) return <Navigate to="/dashboard" replace />;

  const linkCls = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
      isActive ? "bg-sky-500/15 text-sky-300" : "text-slate-300 hover:bg-slate-800/60"
    }`;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <aside className="w-64 border-r border-slate-800 bg-slate-900/60 p-4 flex flex-col">
        <div className="px-2 py-3 mb-4">
          <div className="text-xs uppercase tracking-widest text-slate-500">Platform</div>
          <div className="text-lg font-semibold text-white">Super Admin</div>
        </div>
        <nav className="space-y-1 flex-1">
          <NavLink to="/admin" end className={linkCls}>
            <LayoutDashboard className="h-4 w-4" /> Overview
          </NavLink>
          <NavLink to="/admin/companies" className={linkCls}>
            <Building2 className="h-4 w-4" /> Companies
          </NavLink>
          <NavLink to="/admin/users" className={linkCls}>
            <Users className="h-4 w-4" /> Users
          </NavLink>
          <NavLink to="/admin/activity" className={linkCls}>
            <Activity className="h-4 w-4" /> Activity
          </NavLink>
        </nav>
        <div className="border-t border-slate-800 pt-3 mt-3">
          <div className="px-2 mb-2">
            <div className="text-xs text-slate-500">Signed in</div>
            <div className="text-sm text-slate-200 truncate">{user.email}</div>
          </div>
          <Button variant="ghost" size="sm" className="w-full justify-start text-slate-400" onClick={async () => { await signOut(); nav("/login"); }}>
            <LogOut className="h-4 w-4 mr-2" /> Sign out
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
