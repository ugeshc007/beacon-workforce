import { createSupabaseAdmin, jsonResponse, errorResponse, corsResponse } from "../_shared/helpers.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse();

  try {
    const supabase = createSupabaseAdmin();

    // Verify caller is admin or manager
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !caller) return errorResponse("Unauthorized", 401);

    const { data: callerUser } = await supabase
      .from("users")
      .select("id, company_id")
      .eq("auth_id", caller.id)
      .single();
    if (!callerUser) return errorResponse("Caller not found", 403);

    const { data: callerRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", callerUser.id)
      .in("role", ["admin", "manager", "super_admin"])
      .limit(1)
      .single();
    if (!callerRole) return errorResponse("Only admin/manager can reset passwords", 403);
    const isSuperAdmin = callerRole.role === "super_admin";

    const { employee_id, new_password } = await req.json();
    if (!employee_id || !new_password) {
      return errorResponse("employee_id and new_password are required");
    }
    if (new_password.length < 6) {
      return errorResponse("Password must be at least 6 characters");
    }

    // Get employee's auth_id + company_id
    const { data: emp } = await supabase
      .from("employees")
      .select("id, auth_id, name, company_id")
      .eq("id", employee_id)
      .single();
    if (!emp) return errorResponse("Employee not found", 404);
    if (!emp.auth_id) return errorResponse("Employee has no login account. Create one first.");

    // Tenant guard: caller must be super_admin or in the same company as the target employee
    if (!isSuperAdmin && emp.company_id !== callerUser.company_id) {
      return errorResponse("Forbidden: employee belongs to another company", 403);
    }

    // Reset password using admin API
    const { error: updateErr } = await supabase.auth.admin.updateUserById(emp.auth_id, {
      password: new_password,
    });
    if (updateErr) return errorResponse(updateErr.message, 400);

    return jsonResponse({ success: true, message: `Password reset for ${emp.name}` });
  } catch (e) {
    return errorResponse(e, 500);
  }
});
