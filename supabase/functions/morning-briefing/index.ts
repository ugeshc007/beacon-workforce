import { createSupabaseAdmin, jsonResponse, errorResponse, corsResponse, todayDate, notifyBranchManagers } from "../_shared/helpers.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse();

  try {
    const supabase = createSupabaseAdmin();
    const today = todayDate();

    // Get all branches
    const { data: branches } = await supabase.from("branches").select("id, name");
    if (!branches?.length) return jsonResponse({ message: "No branches found" });

    let notified = 0;

    for (const branch of branches) {
      // Get assignments for today in this branch
      const { data: assignments } = await supabase
        .from("project_assignments")
        .select("id, employee_id, project_id, projects(name, branch_id)")
        .eq("date", today);

      const branchAssignments = (assignments ?? []).filter(
        (a: any) => a.projects?.branch_id === branch.id
      );

      if (!branchAssignments.length) continue;

      const uniqueEmployees = new Set(branchAssignments.map((a: any) => a.employee_id)).size;
      const uniqueProjects = new Set(branchAssignments.map((a: any) => a.project_id)).size;
      const projectNames = [...new Set(
        branchAssignments.map((a: any) => a.projects?.name).filter(Boolean)
      )].slice(0, 5);

      // Get employees on leave
      const { data: leaves } = await supabase
        .from("employee_leave")
        .select("employee_id, employees(branch_id)")
        .lte("start_date", today)
        .gte("end_date", today);

      const branchLeaves = (leaves ?? []).filter(
        (l: any) => l.employees?.branch_id === branch.id
      );

      const message = [
        `${uniqueEmployees} employees assigned across ${uniqueProjects} project${uniqueProjects > 1 ? "s" : ""}`,
        projectNames.length ? `Projects: ${projectNames.join(", ")}` : null,
        branchLeaves.length ? `⚠️ ${branchLeaves.length} on leave today` : null,
      ].filter(Boolean).join(". ");

      await notifyBranchManagers(supabase, branch.id, {
        type: "briefing",
        title: `Good morning — ${branch.name} briefing`,
        message,
        priority: "normal",
        reference_type: "briefing",
      });

      notified++;
    }

    return jsonResponse({ branches_notified: notified, date: today });
  } catch (err) {
    return errorResponse(err.message, 500);
  }
});
