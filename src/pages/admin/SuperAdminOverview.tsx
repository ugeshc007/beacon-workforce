import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Users, Briefcase, Activity } from "lucide-react";

function Stat({ label, value, icon: Icon }: { label: string; value: number | string; icon: React.ElementType }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-slate-500">{label}</span>
        <Icon className="h-4 w-4 text-sky-400" />
      </div>
      <div className="mt-2 text-3xl font-semibold text-white">{value}</div>
    </div>
  );
}

export default function SuperAdminOverview() {
  const { data, isLoading } = useQuery({
    queryKey: ["super-admin-overview"],
    queryFn: async () => {
      const [{ count: companies }, { count: users }, { count: employees }, { count: projects }] = await Promise.all([
        supabase.from("companies").select("id", { count: "exact", head: true }),
        supabase.from("users").select("id", { count: "exact", head: true }),
        supabase.from("employees").select("id", { count: "exact", head: true }),
        supabase.from("projects").select("id", { count: "exact", head: true }),
      ]);
      return { companies: companies ?? 0, users: users ?? 0, employees: employees ?? 0, projects: projects ?? 0 };
    },
  });

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-white">Platform Overview</h1>
        <p className="text-slate-400 text-sm mt-1">Cross-tenant metrics for all companies on the platform.</p>
      </header>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Stat label="Companies" value={isLoading ? "…" : data!.companies} icon={Building2} />
        <Stat label="Users" value={isLoading ? "…" : data!.users} icon={Users} />
        <Stat label="Employees" value={isLoading ? "…" : data!.employees} icon={Users} />
        <Stat label="Projects" value={isLoading ? "…" : data!.projects} icon={Briefcase} />
      </div>

      <div className="mt-10 rounded-xl border border-slate-800 bg-slate-900/40 p-6">
        <div className="flex items-center gap-2 text-slate-300 mb-2"><Activity className="h-4 w-4 text-sky-400" /> Quick actions</div>
        <ul className="text-sm text-slate-400 space-y-2 list-disc pl-5">
          <li>Go to <span className="text-sky-300">Companies</span> to create a new tenant.</li>
          <li>Each tenant has its own admin, branding, and feature flags.</li>
          <li>Tenant data is isolated — even you only see cross-tenant data from this console.</li>
        </ul>
      </div>
    </div>
  );
}
