import { createSupabaseAdmin, jsonResponse, errorResponse, corsResponse, todayDate } from "../_shared/helpers.ts";

interface AssignedEmployee {
  employeeId: string;
  name: string;
  skillType: string;
  score: number;
  scoreBreakdown: {
    utilization_balance: number;
    hours_balance: number;
    recency: number;
    total: number;
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse();

  try {
    const { projectId, date, requiredByRole, lockedEmployeeIds } = await req.json();

    if (!projectId || !date || !requiredByRole) {
      return errorResponse("projectId, date, and requiredByRole are required");
    }

    const supabase = createSupabaseAdmin();
    const locked: string[] = lockedEmployeeIds ?? [];

    // Get project branch
    const { data: project } = await supabase
      .from("projects")
      .select("branch_id")
      .eq("id", projectId)
      .single();

    if (!project) return errorResponse("Project not found", 404);

    // Get month boundaries for scoring
    const dateObj = new Date(date);
    const firstOfMonth = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, "0")}-01`;
    const lastOfMonth = new Date(dateObj.getFullYear(), dateObj.getMonth() + 1, 0).toISOString().split("T")[0];

    // Get all active employees in this branch
    const { data: allEmployees } = await supabase
      .from("employees")
      .select("id, name, skill_type")
      .eq("branch_id", project.branch_id)
      .eq("is_active", true);

    if (!allEmployees?.length) {
      return jsonResponse({ assigned: [], unfilled: Object.entries(requiredByRole).map(([role, count]) => ({ role, needed: count })) });
    }

    // Get employees on leave on this date
    const { data: leaveData } = await supabase
      .from("employee_leave")
      .select("employee_id")
      .lte("start_date", date)
      .gte("end_date", date);
    const onLeave = new Set((leaveData ?? []).map((l) => l.employee_id));

    // Get employees already assigned elsewhere on this date
    const { data: busyData } = await supabase
      .from("project_assignments")
      .select("employee_id")
      .eq("date", date)
      .neq("project_id", projectId);
    const busy = new Set((busyData ?? []).map((b) => b.employee_id));

    // Get assignment counts this month per employee
    const { data: monthAssignments } = await supabase
      .from("project_assignments")
      .select("employee_id")
      .gte("date", firstOfMonth)
      .lte("date", lastOfMonth);

    const assignmentCounts: Record<string, number> = {};
    for (const a of monthAssignments ?? []) {
      assignmentCounts[a.employee_id] = (assignmentCounts[a.employee_id] ?? 0) + 1;
    }

    // Get hours this month per employee
    const { data: monthAttendance } = await supabase
      .from("attendance_logs")
      .select("employee_id, total_work_minutes")
      .gte("date", firstOfMonth)
      .lte("date", lastOfMonth);

    const hourCounts: Record<string, number> = {};
    for (const a of monthAttendance ?? []) {
      hourCounts[a.employee_id] = (hourCounts[a.employee_id] ?? 0) + (a.total_work_minutes ?? 0);
    }

    // Get last assignment date per employee
    const { data: lastAssignments } = await supabase
      .from("project_assignments")
      .select("employee_id, date")
      .lte("date", date)
      .order("date", { ascending: false });

    const lastAssigned: Record<string, string> = {};
    for (const a of lastAssignments ?? []) {
      if (!lastAssigned[a.employee_id]) {
        lastAssigned[a.employee_id] = a.date;
      }
    }

    // Max values for scoring
    const maxDays = Math.max(1, ...Object.values(assignmentCounts));
    const maxHours = Math.max(1, ...Object.values(hourCounts));

    // Score and rank available employees per role
    function scoreEmployee(empId: string): { utilization_balance: number; hours_balance: number; recency: number; total: number } {
      const days = assignmentCounts[empId] ?? 0;
      const hours = hourCounts[empId] ?? 0;
      const lastDate = lastAssigned[empId];
      const daysSinceLast = lastDate
        ? Math.max(0, (dateObj.getTime() - new Date(lastDate).getTime()) / 86400000)
        : 30; // never assigned = high recency score

      const utilization_balance = Math.round((maxDays - days) * 3);
      const hours_balance = Math.round(((maxHours - hours) / 60) * 2);
      const recency = Math.round(daysSinceLast * 1);
      const total = utilization_balance + hours_balance + recency;

      return { utilization_balance, hours_balance, recency, total };
    }

    const assigned: AssignedEmployee[] = [];
    const unfilled: { role: string; needed: number }[] = [];
    const usedIds = new Set(locked);

    const roles: Record<string, string> = {
      technicians: "technician",
      helpers: "helper",
      supervisors: "supervisor",
    };

    for (const [roleKey, skillType] of Object.entries(roles)) {
      const needed = requiredByRole[roleKey] ?? 0;
      if (needed <= 0) continue;

      // Count locked employees of this role already assigned
      const lockedOfRole = locked.filter((lid) => {
        const emp = allEmployees.find((e) => e.id === lid);
        return emp?.skill_type === skillType;
      });

      const remaining = needed - lockedOfRole.length;
      if (remaining <= 0) continue;

      // Filter eligible employees
      const eligible = allEmployees
        .filter((e) =>
          e.skill_type === skillType &&
          !onLeave.has(e.id) &&
          !busy.has(e.id) &&
          !usedIds.has(e.id)
        )
        .map((e) => ({
          ...e,
          breakdown: scoreEmployee(e.id),
        }))
        .sort((a, b) => b.breakdown.total - a.breakdown.total);

      const selected = eligible.slice(0, remaining);

      for (const emp of selected) {
        assigned.push({
          employeeId: emp.id,
          name: emp.name,
          skillType: emp.skill_type,
          score: emp.breakdown.total,
          scoreBreakdown: emp.breakdown,
        });
        usedIds.add(emp.id);
      }

      if (selected.length < remaining) {
        unfilled.push({ role: skillType, needed: remaining - selected.length });
      }
    }

    return jsonResponse({ assigned, unfilled });
  } catch (err) {
    return errorResponse(err.message, 500);
  }
});
