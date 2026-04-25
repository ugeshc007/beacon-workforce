import { createSupabaseAdmin, jsonResponse, errorResponse, corsResponse, todayDate, notifyBranchManagers } from "../_shared/helpers.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse();

  try {
    const supabase = createSupabaseAdmin();
    const today = todayDate();

    // Get late threshold from settings
    const { data: settings } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "notification_absent_alert_delay")
      .maybeSingle();

    const absentDelayMinutes = parseInt(settings?.value ?? "30", 10);

    // Get all assignments for today
    const { data: assignments } = await supabase
      .from("project_assignments")
      .select("employee_id, shift_start, project_id, employees(id, name, branch_id), projects(name)")
      .eq("date", today);

    if (!assignments?.length) {
      return jsonResponse({ checked: 0, absent: 0 });
    }

    // Get all punch-ins for today
    const { data: punchIns } = await supabase
      .from("attendance_logs")
      .select("employee_id")
      .eq("date", today)
      .not("office_punch_in", "is", null);

    const punchedInIds = new Set((punchIns ?? []).map((p: { employee_id: string }) => p.employee_id));

    // Get employees on leave today
    const { data: leaves } = await supabase
      .from("employee_leave")
      .select("employee_id")
      .lte("start_date", today)
      .gte("end_date", today);

    const onLeaveIds = new Set((leaves ?? []).map((l: { employee_id: string }) => l.employee_id));

    const now = new Date();
    let absentCount = 0;

    // Group absent employees by branch for batch notifications
    const branchAbsent: Record<string, { empName: string; projectName: string; shiftStart: string }[]> = {};

    for (const a of assignments) {
      const emp = a.employees as any;
      const project = a.projects as any;
      if (!emp || punchedInIds.has(a.employee_id) || onLeaveIds.has(a.employee_id)) continue;

      // Check if enough time has passed since shift start
      if (a.shift_start) {
        const shiftStartStr = `${today}T${a.shift_start}+04:00`;
        const shiftStart = new Date(shiftStartStr);
        const diffMinutes = (now.getTime() - shiftStart.getTime()) / 60000;

        if (diffMinutes < absentDelayMinutes) continue; // Not late enough yet
      }

      const branchId = emp.branch_id;
      if (!branchAbsent[branchId]) branchAbsent[branchId] = [];
      branchAbsent[branchId].push({
        empName: emp.name,
        projectName: project?.name ?? "Unknown project",
        shiftStart: a.shift_start?.slice(0, 5) ?? "N/A",
      });
      absentCount++;
    }

    // Send notifications per branch
    for (const [branchId, absentees] of Object.entries(branchAbsent)) {
      if (absentees.length === 1) {
        const a = absentees[0];
        await notifyBranchManagers(supabase, branchId, {
          type: "absent",
          title: `${a.empName} is absent`,
          message: `No punch-in for ${a.projectName} (shift started at ${a.shiftStart})`,
          priority: "high",
          reference_type: "attendance",
        });
      } else {
        const names = absentees.map((a) => a.empName).join(", ");
        await notifyBranchManagers(supabase, branchId, {
          type: "absent",
          title: `${absentees.length} employees absent today`,
          message: `Missing: ${names}`,
          priority: "urgent",
          reference_type: "attendance",
        });
      }
    }

    return jsonResponse({
      checked: assignments.length,
      absent: absentCount,
      branches_notified: Object.keys(branchAbsent).length,
    });
  } catch (err) {
    return errorResponse(err, 500);
  }
});
