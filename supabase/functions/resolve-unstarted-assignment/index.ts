import {
  createSupabaseAdmin,
  jsonResponse,
  errorResponse,
  corsResponse,
  authenticateEmployee,
  notifyBranchManagers,
} from "../_shared/helpers.ts";

/**
 * Employee-driven resolution of an assigned project that was never started.
 * Offered at punch-out time. Never blocks the employee — it simply records the
 * decision, updates the schedule and flags it for the admin.
 *
 *  action = "cancel"   → removes today's assignment (override: removed)
 *  action = "postpone" → removes today's assignment and re-creates the same
 *                        assignment for tomorrow
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse();

  try {
    const { employee_id, assignment_id, action, reason } = await req.json();
    if (!employee_id) return errorResponse("employee_id required");
    if (!assignment_id) return errorResponse("assignment_id required");
    if (action !== "cancel" && action !== "postpone") {
      return errorResponse("action must be 'cancel' or 'postpone'");
    }

    const supabase = createSupabaseAdmin();
    const auth = await authenticateEmployee(req, supabase, employee_id);
    if (auth.error) return auth.error;

    const { data: assignment } = await supabase
      .from("project_assignments")
      .select("id, project_id, employee_id, date, shift_start, shift_end, assigned_role, work_location, task")
      .eq("id", assignment_id)
      .eq("employee_id", employee_id)
      .maybeSingle();
    if (!assignment) return errorResponse("Assignment not found", 404);

    // Only unstarted assignments can be cancelled/postponed by the employee.
    const { data: session } = await supabase
      .from("project_work_sessions")
      .select("id")
      .eq("employee_id", employee_id)
      .eq("project_id", assignment.project_id)
      .eq("date", assignment.date)
      .maybeSingle();
    if (session) {
      return errorResponse("This task has already been started — it can't be cancelled or postponed.", 409);
    }

    const { data: project } = await supabase
      .from("projects")
      .select("name, branch_id")
      .eq("id", assignment.project_id)
      .maybeSingle();

    let newDate: string | null = null;

    if (action === "postpone") {
      const d = new Date(assignment.date + "T00:00:00Z");
      d.setUTCDate(d.getUTCDate() + 1);
      newDate = d.toISOString().slice(0, 10);

      const { data: existing } = await supabase
        .from("project_assignments")
        .select("id")
        .eq("employee_id", employee_id)
        .eq("project_id", assignment.project_id)
        .eq("date", newDate)
        .maybeSingle();

      if (!existing) {
        const { error: insErr } = await supabase.from("project_assignments").insert({
          project_id: assignment.project_id,
          employee_id,
          date: newDate,
          shift_start: assignment.shift_start,
          shift_end: assignment.shift_end,
          assigned_role: assignment.assigned_role,
          work_location: assignment.work_location,
          task: assignment.task,
          assignment_mode: "manual",
        });
        if (insErr) return errorResponse(insErr.message, 500);
      }
    }

    // Remove today's assignment so it no longer shows on the employee's day,
    // and keep an override trail so admin dashboards see why.
    await supabase.from("daily_team_overrides").insert({
      project_id: assignment.project_id,
      employee_id,
      date: assignment.date,
      action: "removed",
      apply_to: "today_only",
      reason:
        (action === "cancel"
          ? "Cancelled by employee at punch-out"
          : `Postponed by employee to ${newDate}`) + (reason ? `: ${reason}` : ""),
    });

    const { error: delErr } = await supabase
      .from("project_assignments")
      .delete()
      .eq("id", assignment.id);
    if (delErr) return errorResponse(delErr.message, 500);

    await supabase.from("assignment_audit_log").insert({
      project_id: assignment.project_id,
      date: assignment.date,
      change_type: action === "cancel" ? "employee_cancelled" : "employee_postponed",
      before_state: assignment as unknown as Record<string, unknown>,
      after_state: { moved_to_date: newDate },
      reason: reason ?? null,
    });

    if (project?.branch_id) {
      const { data: emp } = await supabase
        .from("employees")
        .select("name")
        .eq("id", employee_id)
        .maybeSingle();
      await notifyBranchManagers(supabase, project.branch_id, {
        type: action === "cancel" ? "assignment_cancelled" : "assignment_postponed",
        title: action === "cancel" ? "Task cancelled by employee" : "Task postponed by employee",
        message:
          `${emp?.name ?? "Employee"} did not start "${project?.name ?? "project"}" on ${assignment.date}` +
          (action === "cancel" ? " and cancelled it." : ` — moved to ${newDate}.`) +
          (reason ? ` Reason: ${reason}` : ""),
        priority: "high",
        reference_id: assignment.project_id,
        reference_type: "project",
      });
    }

    return jsonResponse({ success: true, action, moved_to_date: newDate });
  } catch (err) {
    return errorResponse((err as Error).message, 500);
  }
});
