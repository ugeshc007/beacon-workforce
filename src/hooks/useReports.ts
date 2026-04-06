import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

function monthRange(month: string) {
  const [y, m] = month.split("-").map(Number);
  const start = `${month}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const end = `${month}-${String(lastDay).padStart(2, "0")}`;
  return { start, end, lastDay };
}

export interface UtilizationRow {
  id: string;
  name: string;
  skill_type: string;
  branch_id: string;
  daysWorked: number;
  totalHours: number;
  otHours: number;
  idleHours: number;
  capacity: number;
  utilization: number;
  dailyMinutes: Record<string, number>;
  dailyOtMinutes: Record<string, number>;
}

export interface AbsenceRow {
  id: string;
  name: string;
  skill_type: string;
  absentDays: number;
  dayOfWeekCounts: number[]; // [Sun, Mon, Tue, Wed, Thu, Fri, Sat]
}

export function useUtilizationData(month: string, filters?: {
  employeeIds?: string[];
  skillType?: string;
  branchId?: string;
}) {
  return useQuery({
    queryKey: ["report-utilization", month, filters],
    queryFn: async () => {
      const { start, end, lastDay } = monthRange(month);
      const [y, m] = month.split("-").map(Number);

      // Count working days (exclude Fri in UAE)
      let workingDays = 0;
      for (let d = 1; d <= lastDay; d++) {
        const dow = new Date(y, m - 1, d).getDay();
        if (dow !== 5) workingDays++; // 5 = Friday
      }

      let empQuery = supabase
        .from("employees")
        .select("id, name, skill_type, branch_id, standard_hours_per_day")
        .eq("is_active", true)
        .order("name");

      if (filters?.branchId && filters.branchId !== "all") {
        empQuery = empQuery.eq("branch_id", filters.branchId);
      }
      if (filters?.skillType && filters.skillType !== "all") {
        empQuery = empQuery.eq("skill_type", filters.skillType);
      }

      const [empRes, logsRes, leaveRes, branchRes] = await Promise.all([
        empQuery,
        supabase
          .from("attendance_logs")
          .select("employee_id, date, total_work_minutes, overtime_minutes")
          .gte("date", start)
          .lte("date", end),
        supabase
          .from("employee_leave")
          .select("employee_id, start_date, end_date")
          .lte("start_date", end)
          .gte("end_date", start),
        supabase.from("branches").select("id, name").order("name"),
      ]);

      const employees = empRes.data ?? [];
      const logs = logsRes.data ?? [];
      const leaves = leaveRes.data ?? [];
      const branches = branchRes.data ?? [];

      // Apply employee filter
      let filteredEmps = employees;
      if (filters?.employeeIds?.length) {
        filteredEmps = employees.filter((e) => filters.employeeIds!.includes(e.id));
      }

      // Build log map per employee
      const logMap = new Map<string, { days: Set<string>; totalMin: number; otMin: number; dailyMin: Record<string, number>; dailyOtMin: Record<string, number> }>();
      for (const l of logs) {
        if (!logMap.has(l.employee_id)) logMap.set(l.employee_id, { days: new Set(), totalMin: 0, otMin: 0, dailyMin: {}, dailyOtMin: {} });
        const entry = logMap.get(l.employee_id)!;
        entry.days.add(l.date);
        entry.totalMin += l.total_work_minutes ?? 0;
        entry.otMin += l.overtime_minutes ?? 0;
        entry.dailyMin[l.date] = (entry.dailyMin[l.date] ?? 0) + (l.total_work_minutes ?? 0);
        entry.dailyOtMin[l.date] = (entry.dailyOtMin[l.date] ?? 0) + (l.overtime_minutes ?? 0);
      }

      // Leave days per employee
      const leaveDaysMap = new Map<string, Set<string>>();
      for (const lv of leaves) {
        if (!leaveDaysMap.has(lv.employee_id)) leaveDaysMap.set(lv.employee_id, new Set());
        const lvStart = new Date(lv.start_date) < new Date(start) ? new Date(start) : new Date(lv.start_date);
        const lvEnd = new Date(lv.end_date) > new Date(end) ? new Date(end) : new Date(lv.end_date);
        for (let d = new Date(lvStart); d <= lvEnd; d.setDate(d.getDate() + 1)) {
          leaveDaysMap.get(lv.employee_id)!.add(d.toISOString().slice(0, 10));
        }
      }

      const rows: UtilizationRow[] = filteredEmps.map((e) => {
        const entry = logMap.get(e.id);
        const daysWorked = entry?.days.size ?? 0;
        const totalHours = Math.round(((entry?.totalMin ?? 0) / 60) * 10) / 10;
        const otHours = Math.round(((entry?.otMin ?? 0) / 60) * 10) / 10;
        const capacity = workingDays * Number(e.standard_hours_per_day);
        const idleHours = Math.max(0, Math.round((capacity - totalHours) * 10) / 10);
        const utilization = capacity > 0 ? Math.round((totalHours / capacity) * 100) : 0;
        return {
          id: e.id, name: e.name, skill_type: e.skill_type, branch_id: e.branch_id,
          daysWorked, totalHours, otHours, idleHours, capacity, utilization,
          dailyMinutes: entry?.dailyMin ?? {},
          dailyOtMinutes: entry?.dailyOtMin ?? {},
        };
      });

      // By skill type
      const bySkill = ["technician", "helper", "supervisor"].map((skill) => {
        const group = rows.filter((r) => r.skill_type === skill);
        const avgUtil = group.length > 0 ? Math.round(group.reduce((s, r) => s + r.utilization, 0) / group.length) : 0;
        return { skill, count: group.length, avgUtilization: avgUtil };
      });

      // Weekly trend
      const weeklyMap = new Map<string, { regular: number; ot: number }>();
      for (const l of logs) {
        const dt = new Date(l.date);
        // Week start (Sunday)
        const sun = new Date(dt);
        sun.setDate(dt.getDate() - dt.getDay());
        const weekKey = sun.toISOString().slice(0, 10);
        if (!weeklyMap.has(weekKey)) weeklyMap.set(weekKey, { regular: 0, ot: 0 });
        const w = weeklyMap.get(weekKey)!;
        const otMin = l.overtime_minutes ?? 0;
        const regMin = Math.max(0, (l.total_work_minutes ?? 0) - otMin);
        w.regular += regMin;
        w.ot += otMin;
      }
      const weeklyTrend = Array.from(weeklyMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([week, v]) => ({
          week,
          weekLabel: `W${Math.ceil((new Date(week).getDate()) / 7)}`,
          regular: Math.round((v.regular / 60) * 10) / 10,
          ot: Math.round((v.ot / 60) * 10) / 10,
          total: Math.round(((v.regular + v.ot) / 60) * 10) / 10,
        }));

      // Heatmap data: employee × day-of-month
      const heatmapDays: string[] = [];
      for (let d = 1; d <= lastDay; d++) {
        heatmapDays.push(`${month}-${String(d).padStart(2, "0")}`);
      }

      // Absenteeism analytics
      const absenceRows: AbsenceRow[] = filteredEmps.map((e) => {
        const workedDays = logMap.get(e.id)?.days ?? new Set<string>();
        const onLeave = leaveDaysMap.get(e.id) ?? new Set<string>();
        const dayOfWeekCounts = [0, 0, 0, 0, 0, 0, 0];
        let absentDays = 0;

        for (let d = 1; d <= lastDay; d++) {
          const dt = new Date(y, m - 1, d);
          const dow = dt.getDay();
          if (dow === 5) continue; // Friday off
          const dateStr = `${month}-${String(d).padStart(2, "0")}`;
          const isToday = new Date().toISOString().slice(0, 10) === dateStr;
          const isFuture = new Date(dateStr) > new Date();
          if (isFuture && !isToday) continue;
          if (!workedDays.has(dateStr) && !onLeave.has(dateStr)) {
            absentDays++;
            dayOfWeekCounts[dow]++;
          }
        }
        return { id: e.id, name: e.name, skill_type: e.skill_type, absentDays, dayOfWeekCounts };
      }).filter((r) => r.absentDays > 0).sort((a, b) => b.absentDays - a.absentDays);

      // Day-of-week absence totals
      const dowTotals = [0, 0, 0, 0, 0, 0, 0];
      for (const r of absenceRows) {
        for (let i = 0; i < 7; i++) dowTotals[i] += r.dayOfWeekCounts[i];
      }

      const totalWorkedHours = Math.round(rows.reduce((s, r) => s + r.totalHours, 0));
      const totalOtHours = Math.round(rows.reduce((s, r) => s + r.otHours, 0) * 10) / 10;
      const totalIdleHours = Math.round(rows.reduce((s, r) => s + r.idleHours, 0));
      const avgUtilization = rows.length ? Math.round(rows.reduce((s, r) => s + r.utilization, 0) / rows.length) : 0;

      return {
        rows, bySkill, weeklyTrend, heatmapDays, absenceRows, dowTotals,
        avgUtilization, totalWorkedHours, totalOtHours, totalIdleHours,
        branches: branches.map((b) => ({ id: b.id, name: b.name })),
        employees: filteredEmps.map((e) => ({ id: e.id, name: e.name })),
        workingDays,
      };
    },
  });
}

export function useCostData(month: string) {
  return useQuery({
    queryKey: ["report-costs", month],
    queryFn: async () => {
      const { start, end } = monthRange(month);

      const [logsRes, expensesRes, projectsRes] = await Promise.all([
        supabase.from("attendance_logs").select("project_id, regular_cost, overtime_cost").gte("date", start).lte("date", end),
        supabase.from("project_expenses").select("project_id, amount_aed, category, status").gte("date", start).lte("date", end),
        supabase.from("projects").select("id, name, budget").in("status", ["assigned", "in_progress"]),
      ]);

      const logs = logsRes.data ?? [];
      const expenses = expensesRes.data ?? [];
      const projects = projectsRes.data ?? [];

      const projMap = new Map<string, { name: string; budget: number; laborCost: number; otCost: number; expenses: number }>();
      for (const p of projects) {
        projMap.set(p.id, { name: p.name, budget: Number(p.budget ?? 0), laborCost: 0, otCost: 0, expenses: 0 });
      }
      for (const l of logs) {
        if (l.project_id && projMap.has(l.project_id)) {
          projMap.get(l.project_id)!.laborCost += Number(l.regular_cost ?? 0);
          projMap.get(l.project_id)!.otCost += Number(l.overtime_cost ?? 0);
        }
      }
      for (const e of expenses) {
        if (e.status === "approved" && projMap.has(e.project_id)) {
          projMap.get(e.project_id)!.expenses += Number(e.amount_aed ?? 0);
        }
      }

      const byProject = [...projMap.values()].map((p) => ({
        ...p,
        totalCost: Math.round(p.laborCost + p.otCost + p.expenses),
        laborCost: Math.round(p.laborCost),
        otCost: Math.round(p.otCost),
        expenses: Math.round(p.expenses),
        budget: Math.round(p.budget),
      }));

      const catMap = new Map<string, number>();
      catMap.set("labor", logs.reduce((s, l) => s + Number(l.regular_cost ?? 0), 0));
      catMap.set("overtime", logs.reduce((s, l) => s + Number(l.overtime_cost ?? 0), 0));
      for (const e of expenses.filter((e) => e.status === "approved")) {
        catMap.set(e.category, (catMap.get(e.category) ?? 0) + Number(e.amount_aed ?? 0));
      }
      const byCategory = [...catMap.entries()].map(([category, amount]) => ({ category, amount: Math.round(amount) })).filter((c) => c.amount > 0);

      const totalCost = byCategory.reduce((s, c) => s + c.amount, 0);

      return { byProject, byCategory, totalCost };
    },
  });
}

export function useExecutiveData(month: string) {
  return useQuery({
    queryKey: ["report-executive", month],
    queryFn: async () => {
      const { start, end } = monthRange(month);

      const [empRes, projRes, logsRes, assignRes] = await Promise.all([
        supabase.from("employees").select("id, branch_id, is_active", { count: "exact" }).eq("is_active", true),
        supabase.from("projects").select("id, status, branch_id, budget", { count: "exact" }).in("status", ["assigned", "in_progress"]),
        supabase.from("attendance_logs").select("employee_id, total_work_minutes, overtime_minutes, regular_cost, overtime_cost, date").gte("date", start).lte("date", end),
        supabase.from("project_assignments").select("id, date", { count: "exact" }).gte("date", start).lte("date", end),
      ]);

      const logs = logsRes.data ?? [];
      const totalHours = Math.round(logs.reduce((s, l) => s + (l.total_work_minutes ?? 0), 0) / 60);
      const totalOtHours = Math.round(logs.reduce((s, l) => s + (l.overtime_minutes ?? 0), 0) / 60);
      const totalLaborCost = Math.round(logs.reduce((s, l) => s + Number(l.regular_cost ?? 0) + Number(l.overtime_cost ?? 0), 0));
      const uniqueWorkers = new Set(logs.map((l) => l.employee_id)).size;
      const totalBudget = (projRes.data ?? []).reduce((s, p) => s + Number(p.budget ?? 0), 0);

      const dailyCost = new Map<string, number>();
      for (const l of logs) {
        const cost = Number(l.regular_cost ?? 0) + Number(l.overtime_cost ?? 0);
        dailyCost.set(l.date, (dailyCost.get(l.date) ?? 0) + cost);
      }
      const costTrend = [...dailyCost.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, cost]) => ({ date, cost: Math.round(cost) }));

      return {
        activeEmployees: empRes.count ?? 0,
        activeProjects: projRes.count ?? 0,
        totalAssignments: assignRes.count ?? 0,
        totalHours,
        totalOtHours,
        totalLaborCost,
        totalBudget: Math.round(totalBudget),
        uniqueWorkers,
        costTrend,
      };
    },
  });
}

export function useProfitabilityData() {
  return useQuery({
    queryKey: ["report-profitability"],
    queryFn: async () => {
      const [projRes, logsRes, expensesRes] = await Promise.all([
        supabase.from("projects").select("id, name, budget, project_value, status, start_date, end_date"),
        supabase.from("attendance_logs").select("project_id, regular_cost, overtime_cost, total_work_minutes"),
        supabase.from("project_expenses").select("project_id, amount_aed, status"),
      ]);

      const projects = projRes.data ?? [];
      const logs = logsRes.data ?? [];
      const expenses = expensesRes.data ?? [];

      const costMap = new Map<string, { labor: number; ot: number; expenses: number; hours: number }>();
      for (const l of logs) {
        if (!l.project_id) continue;
        if (!costMap.has(l.project_id)) costMap.set(l.project_id, { labor: 0, ot: 0, expenses: 0, hours: 0 });
        const e = costMap.get(l.project_id)!;
        e.labor += Number(l.regular_cost ?? 0);
        e.ot += Number(l.overtime_cost ?? 0);
        e.hours += (l.total_work_minutes ?? 0) / 60;
      }
      for (const ex of expenses) {
        if (ex.status !== "approved") continue;
        if (!costMap.has(ex.project_id)) costMap.set(ex.project_id, { labor: 0, ot: 0, expenses: 0, hours: 0 });
        costMap.get(ex.project_id)!.expenses += Number(ex.amount_aed ?? 0);
      }

      const rows = projects.map((p) => {
        const c = costMap.get(p.id) ?? { labor: 0, ot: 0, expenses: 0, hours: 0 };
        const totalCost = Math.round(c.labor + c.ot + c.expenses);
        const projectValue = Number(p.project_value ?? 0);
        const budget = Number(p.budget ?? 0);
        const grossProfit = Math.round(projectValue - totalCost);
        const margin = projectValue > 0 ? Math.round((grossProfit / projectValue) * 100) : 0;
        const budgetVariance = budget > 0 ? Math.round(budget - totalCost) : 0;
        const budgetUsedPct = budget > 0 ? Math.round((totalCost / budget) * 100) : 0;
        return {
          name: p.name, status: p.status, projectValue: Math.round(projectValue),
          budget: Math.round(budget), laborCost: Math.round(c.labor), otCost: Math.round(c.ot),
          expenseCost: Math.round(c.expenses), totalCost, grossProfit, margin,
          budgetVariance, budgetUsedPct, hours: Math.round(c.hours),
        };
      });

      const totals = rows.reduce((s, r) => ({
        value: s.value + r.projectValue, cost: s.cost + r.totalCost,
        budget: s.budget + r.budget, profit: s.profit + r.grossProfit,
      }), { value: 0, cost: 0, budget: 0, profit: 0 });
      const avgMargin = totals.value > 0 ? Math.round((totals.profit / totals.value) * 100) : 0;
      const profitable = rows.filter((r) => r.grossProfit > 0).length;

      return { rows, totals, avgMargin, profitable };
    },
  });
}
