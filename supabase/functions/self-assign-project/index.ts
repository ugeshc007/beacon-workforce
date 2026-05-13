import { createSupabaseAdmin, jsonResponse, errorResponse, corsResponse, todayDate, authenticateEmployee } from "../_shared/helpers.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse();

  try {
    const { employee_id, project_id, assigned_role } = await req.json();
    if (!employee_id || !project_id) {
      return errorResponse("employee_id and project_id are required");
    }

    const supabase = createSupabaseAdmin();
    const auth = await authenticateEmployee(req, supabase, employee_id);
    if (auth.error) return auth.error;

    const today = todayDate();

    // Verify employee is active and get branch
    const { data: emp } = await supabase
      .from("employees")
      .select("id, name, branch_id, is_active")
      .eq("id", employee_id)
      .maybeSingle();
    if (!emp || !emp.is_active) return errorResponse("Employee not found or inactive", 403);

    // Verify project exists in same branch and is active/in-progress
    const { data: project } = await supabase
      .from("projects")
      .select("id, name, branch_id, status")
      .eq("id", project_id)
      .maybeSingle();
    if (!project) return errorResponse("Project not found", 404);
    if (project.branch_id !== emp.branch_id) return errorResponse("Project not available in your branch", 403);
    if (project.status === "completed" || project.status === "cancelled") {
      return errorResponse("This project is no longer active", 400);
    }

    // If already assigned today, return existing
    const { data: existing } = await supabase
      .from("project_assignments")
      .select("id")
      .eq("employee_id", employee_id)
      .eq("project_id", project_id)
      .eq("date", today)
      .maybeSingle();

    if (existing) {
      return jsonResponse({ success: true, assignment_id: existing.id, already_assigned: true });
    }

    const { data: inserted, error } = await supabase
      .from("project_assignments")
      .insert({
        employee_id,
        project_id,
        date: today,
        assigned_role: assigned_role || "team_member",
        assignment_mode: "manual",
        is_locked: false,
      })
      .select("id")
      .single();

    if (error) return errorResponse(error.message, 500);
    return jsonResponse({ success: true, assignment_id: inserted.id });
  } catch (err) {
    return errorResponse((err as Error).message, 500);
  }
});
