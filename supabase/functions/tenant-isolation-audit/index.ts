// Tenant isolation audit — super-admin only.
// Scans tables that have company_id and detects rows where a parent reference
// crosses tenant boundaries (e.g. a project_assignment whose employee belongs
// to a different company than its project). Returns a JSON report.
import { createSupabaseAdmin, jsonResponse, errorResponse, corsResponse } from "../_shared/helpers.ts";

type Leak = { check: string; count: number; sample: unknown[] };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse();

  try {
    const supabase = createSupabaseAdmin();

    // Auth: super_admin only
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) return errorResponse("Unauthorized", 401);

    const { data: callerUser } = await supabase
      .from("users").select("id").eq("auth_id", user.id).single();
    if (!callerUser) return errorResponse("Forbidden", 403);

    const { data: role } = await supabase
      .from("user_roles").select("role")
      .eq("user_id", callerUser.id).eq("role", "super_admin").maybeSingle();
    if (!role) return errorResponse("Super admin only", 403);

    const leaks: Leak[] = [];

    // Helper: run a raw count via a parameterless RPC isn't available, so use
    // .select with head:true & exact count where possible.
    async function record(check: string, query: any) {
      const { data, count, error } = await query;
      if (error) {
        leaks.push({ check, count: -1, sample: [{ error: error.message }] });
        return;
      }
      if ((count ?? data?.length ?? 0) > 0) {
        leaks.push({ check, count: count ?? data?.length ?? 0, sample: (data ?? []).slice(0, 5) });
      }
    }

    // 1. Projects whose branch belongs to a different company
    {
      const { data, error } = await supabase
        .from("projects")
        .select("id, company_id, branch_id, branches!inner(company_id)")
        .limit(5000);
      if (!error && data) {
        const bad = data.filter((p: any) => p.branches?.company_id !== p.company_id);
        if (bad.length) leaks.push({
          check: "projects.branch_id → branches.company_id mismatch",
          count: bad.length,
          sample: bad.slice(0, 5).map((p: any) => ({ id: p.id, project_company: p.company_id, branch_company: p.branches?.company_id })),
        });
      }
    }

    // 2. Employees whose branch belongs to a different company
    {
      const { data, error } = await supabase
        .from("employees")
        .select("id, company_id, branch_id, branches!inner(company_id)")
        .limit(5000);
      if (!error && data) {
        const bad = data.filter((e: any) => e.branches?.company_id !== e.company_id);
        if (bad.length) leaks.push({
          check: "employees.branch_id → branches.company_id mismatch",
          count: bad.length,
          sample: bad.slice(0, 5).map((e: any) => ({ id: e.id, employee_company: e.company_id, branch_company: e.branches?.company_id })),
        });
      }
    }

    // 3. project_assignments where employee.company != project.company
    {
      const { data, error } = await supabase
        .from("project_assignments")
        .select("id, employee:employees!inner(company_id), project:projects!inner(company_id)")
        .limit(5000);
      if (!error && data) {
        const bad = data.filter((a: any) => a.employee?.company_id !== a.project?.company_id);
        if (bad.length) leaks.push({
          check: "project_assignments cross-tenant (employee vs project)",
          count: bad.length,
          sample: bad.slice(0, 5).map((a: any) => ({ id: a.id })),
        });
      }
    }

    // 4. Rows with NULL company_id in tenant-scoped tables
    for (const tbl of ["projects", "employees", "branches", "users"]) {
      const { count, error } = await supabase
        .from(tbl).select("id", { count: "exact", head: true }).is("company_id", null);
      if (!error && (count ?? 0) > 0) {
        leaks.push({ check: `${tbl} rows with NULL company_id`, count: count!, sample: [] });
      }
    }

    // 5. Per-company row counts (informational)
    const { data: companies } = await supabase
      .from("companies").select("id, name, slug");
    const summary: Record<string, Record<string, number>> = {};
    for (const c of companies ?? []) {
      summary[c.slug] = {};
      for (const tbl of ["projects", "employees", "branches", "users"]) {
        const { count } = await supabase
          .from(tbl).select("id", { count: "exact", head: true }).eq("company_id", c.id);
        summary[c.slug][tbl] = count ?? 0;
      }
    }

    return jsonResponse({
      ok: leaks.length === 0,
      leaks,
      summary,
      checked_at: new Date().toISOString(),
    });
  } catch (e) {
    return errorResponse(e, 500);
  }
});
