import { createSupabaseAdmin, jsonResponse, errorResponse, corsResponse } from "../_shared/helpers.ts";

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

// Seeded shuffle for deterministic round-robin when scores tie
function shuffleTied<T extends { breakdown: { total: number } }>(arr: T[]): T[] {
  if (arr.length <= 1) return arr;
  const result = [...arr];
  // Group by score, shuffle within groups
  let i = 0;
  while (i < result.length) {
    let j = i;
    while (j < result.length && result[j].breakdown.total === result[i].breakdown.total) j++;
    // Fisher-Yates shuffle the tied block
    for (let k = j - 1; k > i; k--) {
      const r = i + Math.floor(Math.random() * (k - i + 1));
      [result[k], result[r]] = [result[r], result[k]];
    }
    i = j;
  }
  return result;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse();

  try {
    const { projectId, date, requiredByRole, lockedEmployeeIds, shiftStart, shiftEnd } = await req.json();

    if (!projectId || !date || !requiredByRole) {
      return errorResponse("projectId, date, and requiredByRole are required");
    }

    const supabase = createSupabaseAdmin();
    const locked: string[] = lockedEmployeeIds ?? [];
    const assignShiftStart = shiftStart ?? "08:00";
    const assignShiftEnd = shiftEnd ?? "17:00";

    // Get project branch + name
    const { data: project } = await supabase
      .from("projects")
      .select("branch_id, name, branches(name)")
      .eq("id", projectId)
      .single();

    if (!project) return errorResponse("Project not found", 404);
    const branchName = (project.branches as any)?.name ?? "Unknown";

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
      return jsonResponse({
        assigned: [],
        unfilled: Object.entries(requiredByRole).map(([role, count]) => ({ role, needed: count })),
        reason: `No active employees found in the "${branchName}" branch. Please add employees to this branch first.`,
      });
    }

    // Parallel data fetches
    const [leaveRes, alreadyAssignedRes, allDayAssignRes, monthAssignRes, monthAttendRes, lastAssignRes] = await Promise.all([
      supabase.from("employee_leave").select("employee_id").lte("start_date", date).gte("end_date", date),
      supabase.from("project_assignments").select("employee_id").eq("date", date).eq("project_id", projectId),
      // All assignments for this date across ALL projects (to detect double-booking)
      supabase.from("project_assignments").select("employee_id, project_id, shift_start, shift_end, projects(name)").eq("date", date),
      supabase.from("project_assignments").select("employee_id").gte("date", firstOfMonth).lte("date", lastOfMonth),
      supabase.from("attendance_logs").select("employee_id, total_work_minutes").gte("date", firstOfMonth).lte("date", lastOfMonth),
      supabase.from("project_assignments").select("employee_id, date").lte("date", date).order("date", { ascending: false }),
    ]);

    const onLeave = new Set((leaveRes.data ?? []).map((l) => l.employee_id));
    const alreadyOnProject = new Set((alreadyAssignedRes.data ?? []).map((a) => a.employee_id));

    // Employees assigned to OTHER projects on this day
    const assignedElsewhere = new Set<string>();
    const assignedElsewhereDetails: Record<string, string[]> = {};
    for (const a of allDayAssignRes.data ?? []) {
      if (a.project_id !== projectId) {
        assignedElsewhere.add(a.employee_id);
        if (!assignedElsewhereDetails[a.employee_id]) assignedElsewhereDetails[a.employee_id] = [];
        const projName = (a.projects as any)?.name ?? "Other";
        if (!assignedElsewhereDetails[a.employee_id].includes(projName)) {
          assignedElsewhereDetails[a.employee_id].push(projName);
        }
      }
    }

    const assignmentCounts: Record<string, number> = {};
    for (const a of monthAssignRes.data ?? []) {
      assignmentCounts[a.employee_id] = (assignmentCounts[a.employee_id] ?? 0) + 1;
    }

    const hourCounts: Record<string, number> = {};
    for (const a of monthAttendRes.data ?? []) {
      hourCounts[a.employee_id] = (hourCounts[a.employee_id] ?? 0) + (a.total_work_minutes ?? 0);
    }

    const lastAssigned: Record<string, string> = {};
    for (const a of lastAssignRes.data ?? []) {
      if (!lastAssigned[a.employee_id]) {
        lastAssigned[a.employee_id] = a.date;
      }
    }

    // Max values for scoring
    const maxDays = Math.max(1, ...Object.values(assignmentCounts));
    const maxHours = Math.max(1, ...Object.values(hourCounts));

    function scoreEmployee(empId: string) {
      const days = assignmentCounts[empId] ?? 0;
      const hours = hourCounts[empId] ?? 0;
      const lastDate = lastAssigned[empId];
      const daysSinceLast = lastDate
        ? Math.max(0, (dateObj.getTime() - new Date(lastDate).getTime()) / 86400000)
        : 30;

      const utilization_balance = Math.round((maxDays - days) * 3);
      const hours_balance = Math.round(((maxHours - hours) / 60) * 2);
      const recency = Math.round(daysSinceLast * 1);
      const total = utilization_balance + hours_balance + recency;

      return { utilization_balance, hours_balance, recency, total };
    }

    const assigned: (AssignedEmployee & { doubleBooked?: boolean; otherProjects?: string[] })[] = [];
    const unfilled: { role: string; needed: number }[] = [];
    const usedIds = new Set([...locked, ...alreadyOnProject]);

    const roles: Record<string, string> = {
      technicians: "technician",
      helpers: "helper",
      supervisors: "supervisor",
    };

    for (const [roleKey, skillType] of Object.entries(roles)) {
      const needed = requiredByRole[roleKey] ?? 0;
      if (needed <= 0) continue;

      const lockedOfRole = locked.filter((lid) => {
        const emp = allEmployees.find((e) => e.id === lid);
        return emp?.skill_type === skillType;
      });

      const remaining = needed - lockedOfRole.length;
      if (remaining <= 0) continue;

      // Split eligible: prefer employees NOT assigned elsewhere on same day
      const allEligible = allEmployees
        .filter((e) =>
          e.skill_type === skillType &&
          !onLeave.has(e.id) &&
          !usedIds.has(e.id)
        )
        .map((e) => ({ ...e, breakdown: scoreEmployee(e.id), isDoubleBook: assignedElsewhere.has(e.id) }));

      const free = shuffleTied(
        allEligible.filter((e) => !e.isDoubleBook).sort((a, b) => b.breakdown.total - a.breakdown.total)
      );
      const doubleBook = shuffleTied(
        allEligible.filter((e) => e.isDoubleBook).sort((a, b) => b.breakdown.total - a.breakdown.total)
      );

      // Pick free first, then double-booked as last resort
      const selected = [...free, ...doubleBook].slice(0, remaining);

      for (const emp of selected) {
        assigned.push({
          employeeId: emp.id,
          name: emp.name,
          skillType: emp.skill_type,
          score: emp.breakdown.total,
          scoreBreakdown: emp.breakdown,
          doubleBooked: emp.isDoubleBook,
          otherProjects: assignedElsewhereDetails[emp.id] ?? [],
        });
        usedIds.add(emp.id);
      }

      if (selected.length < remaining) {
        unfilled.push({ role: skillType, needed: remaining - selected.length });
      }
    }

    // Insert assignments into project_assignments
    if (assigned.length > 0) {
      const rows = assigned.map((a) => ({
        project_id: projectId,
        employee_id: a.employeeId,
        date,
        shift_start: assignShiftStart,
        shift_end: assignShiftEnd,
        assignment_mode: "auto" as const,
        auto_score: a.scoreBreakdown,
      }));
      const { error: insertErr } = await supabase.from("project_assignments").insert(rows);
      if (insertErr) return errorResponse(insertErr.message, 500);

      // Log to assignment_audit_log
      await supabase.from("assignment_audit_log").insert({
        project_id: projectId,
        date,
        change_type: "auto_assign",
        reason: `Auto-assigned ${assigned.length} employee(s) via allocation engine`,
        before_state: { locked_ids: locked },
        after_state: {
          assigned: assigned.map((a) => ({
            employeeId: a.employeeId,
            name: a.name,
            role: a.skillType,
            score: a.score,
            scoreBreakdown: a.scoreBreakdown,
          })),
          unfilled,
        },
      });
    }

    return jsonResponse({ assigned, unfilled });
  } catch (err) {
    return errorResponse(err.message, 500);
  }
});
