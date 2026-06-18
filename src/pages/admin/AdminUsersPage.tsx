import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Shield } from "lucide-react";

interface AdminUserRow {
  id: string;
  email: string;
  name: string | null;
  created_at: string;
  company: { id: string; name: string; slug: string } | null;
}

export default function AdminUsersPage() {
  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select(
          "user_id, role, users:user_id ( id, email, name, created_at, companies:company_id ( id, name, slug ) )"
        )
        .eq("role", "admin");

      if (error) {
        console.warn("[admin/users] load failed", error.message);
        setLoading(false);
        return;
      }

      const mapped: AdminUserRow[] = (data ?? [])
        .map((r: any) => r.users)
        .filter(Boolean)
        .map((u: any) => ({
          id: u.id,
          email: u.email,
          name: u.name,
          created_at: u.created_at,
          company: u.companies
            ? { id: u.companies.id, name: u.companies.name, slug: u.companies.slug }
            : null,
        }))
        .sort((a, b) =>
          (a.company?.name ?? "").localeCompare(b.company?.name ?? "")
        );

      setRows(mapped);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
            <Shield className="h-5 w-5 text-sky-400" />
            Organisation Admins
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            All tenant administrators across every organisation.
          </p>
        </div>
        <div className="text-xs text-slate-500">
          {loading ? "…" : `${rows.length} admin${rows.length === 1 ? "" : "s"}`}
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
        {loading ? (
          <div className="p-10 flex items-center justify-center text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading admins…
          </div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-sm">
            No organisation admins yet.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-900/70 text-slate-400 text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Organisation</th>
                <th className="text-left px-4 py-3 font-medium">Name</th>
                <th className="text-left px-4 py-3 font-medium">Email</th>
                <th className="text-left px-4 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {rows.map((u) => (
                <tr key={u.id} className="hover:bg-slate-800/30">
                  <td className="px-4 py-3">
                    {u.company ? (
                      <div className="flex flex-col">
                        <span className="text-slate-100">{u.company.name}</span>
                        <span className="text-xs text-slate-500">{u.company.slug}</span>
                      </div>
                    ) : (
                      <span className="text-slate-500 italic">No organisation</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-200">{u.name || "—"}</td>
                  <td className="px-4 py-3 text-slate-300">{u.email}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
