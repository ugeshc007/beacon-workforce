import { createSupabaseAdmin, jsonResponse, errorResponse, corsResponse } from "../_shared/helpers.ts";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

// Admin/Manager creates a Supabase Auth account for an employee
// and links the auth_id back to the employees row.
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
      .select("id")
      .eq("auth_id", caller.id)
      .single();
    if (!callerUser) return errorResponse("Caller not found in users table", 403);

    const { data: callerRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", callerUser.id)
      .in("role", ["admin", "manager"])
      .limit(1)
      .single();
    if (!callerRole) return errorResponse("Only admin/manager can create employee accounts", 403);

    const { employee_id, email, password, name } = await req.json();
    if (!employee_id || !email || !password) {
      return errorResponse("employee_id, email, and password are required");
    }

    // Check employee exists and has no auth_id yet
    const { data: emp } = await supabase
      .from("employees")
      .select("id, auth_id, name")
      .eq("id", employee_id)
      .single();
    if (!emp) return errorResponse("Employee not found", 404);
    if (emp.auth_id) return errorResponse("Employee already has an auth account");

    // Create Supabase Auth user
    const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: name || emp.name, is_employee: true },
    });
    if (createErr) return errorResponse(createErr.message, 400);

    // Link auth_id to employee
    const { error: updateErr } = await supabase
      .from("employees")
      .update({ auth_id: newUser.user!.id, email })
      .eq("id", employee_id);
    if (updateErr) return errorResponse(updateErr.message, 500);

    return jsonResponse({ success: true, auth_id: newUser.user!.id });
  } catch (e) {
    return errorResponse(e.message, 500);
  }
});
