import { createSupabaseAdmin, jsonResponse, errorResponse, corsResponse } from "../_shared/helpers.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse();

  try {
    const supabase = createSupabaseAdmin();

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !caller) return errorResponse("Unauthorized", 401);

    const { data: callerUser } = await supabase
      .from("users").select("id, company_id").eq("auth_id", caller.id).single();
    if (!callerUser) return errorResponse("Caller not found", 403);

    const { data: callerRole } = await supabase
      .from("user_roles").select("role").eq("user_id", callerUser.id)
      .in("role", ["admin", "manager", "super_admin"]).limit(1).single();
    if (!callerRole) return errorResponse("Only admin/manager", 403);
    const isSuperAdmin = callerRole.role === "super_admin";

    const url = new URL(req.url);
    const employee_id = url.searchParams.get("employee_id");
    if (!employee_id) return errorResponse("employee_id required");

    const { data: emp } = await supabase
      .from("employees").select("id, auth_id, email, company_id").eq("id", employee_id).single();
    if (!emp) return errorResponse("Employee not found", 404);
    if (!isSuperAdmin && emp.company_id !== callerUser.company_id) {
      return errorResponse("Forbidden", 403);
    }

    let auth_email: string | null = null;
    if (emp.auth_id) {
      const { data: authUser } = await supabase.auth.admin.getUserById(emp.auth_id);
      auth_email = authUser?.user?.email ?? null;
    }

    return jsonResponse({
      employee_email: emp.email,
      auth_email,
      has_login: !!emp.auth_id,
      mismatch: !!auth_email && !!emp.email && auth_email.toLowerCase() !== emp.email.toLowerCase(),
    });
  } catch (e) {
    return errorResponse(e, 500);
  }
});
