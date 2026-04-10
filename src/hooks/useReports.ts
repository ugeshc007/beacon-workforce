import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Count working days between two ISO dates (excludes Fridays for UAE) */
function countWorkingDays(start: string, end: string) {
  let count = 0;
  const cur = new Date(start);
  const endDate = new Date(end);
  while (cur <= endDate) {
    if (cur.getDay() !== 5) count++; // 5 = Friday
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

/** Generate all dates between start and end (inclusive) */
function allDates(start: string, end: string): string[] {
  const dates: string[] = [];
  const cur = new Date(start);
  const endDate = new Date(end);
  while (cur <= endDate) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
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

export function useUtilizationData(start: string, end: string, filters?: {
  employeeIds?: string[];
  skillType?: string;
  branchId?: string;
}) {
  return useQuery({
    queryKey: ["report-utilization", start, end, filters],
    queryFn: async () => {
      const workingDays = countWorkingDays(start, end);
      const allDays = allDates(start, end);

      let empQuery = supabase
        .from("employees")
        .select("id, name, skill_type, branch_id, standard_hours_per_day")
        .eq("is_active", true)
        .order("name");

      if (filters?.branchId && filters.branchId !== "all") {
        empQuery = empQuery.eq("branch_id", filters.branchId);
      }
      if (filters?.skillType && filters.skillType !== "all") {
        empQuery = empQuery.eq("skill_type", filters.skillType as "technician" | "helper" | "team_leader");
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

      let filteredEmps = employees;
      if (filters?.employeeIds?.length) {
        filteredEmps = employees.filter((e) => filters.employeeIds!.includes(e.id));
      }

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

      const bySkill = ["team_member", "team_leader"].map((skill) => {
        const group = rows.filter((r) => r.skill_type === skill);
        const avgUtil = group.length > 0 ? Math.round(group.reduce((s, r) => s + r.utilization, 0) / group.length) : 0;
        return { skill, count: group.length, avgUtilization: avgUtil };
      });

      const weeklyMap = new Map<string, { regular: number; ot: number }>();
      for (const l of logs) {
        const dt = new Date(l.date);
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
        .map(([week, v], i) => ({
          week,
          weekLabel: `W${i + 1}`,
          regular: Math.round((v.regular / 60) * 10) / 10,
          ot: Math.round((v.ot / 60) * 10) / 10,
          total: Math.round(((v.regular + v.ot) / 60) * 10) / 10,
        }));

      const heatmapDays = allDays;

      // Absenteeism analytics
      const absenceRows: AbsenceRow[] = filteredEmps.map((e) => {
        const workedDays = logMap.get(e.id)?.days ?? new Set<string>();
        const onLeave = leaveDaysMap.get(e.id) ?? new Set<string>();
        const dayOfWeekCounts = [0, 0, 0, 0, 0, 0, 0];
        let absentDays = 0;

        for (const dateStr of allDays) {
          const dt = new Date(dateStr);
          const dow = dt.getDay();
          if (dow === 5) continue; // Friday off
          if (new Date(dateStr) > new Date()) continue;
          if (!workedDays.has(dateStr) && !onLeave.has(dateStr)) {
            absentDays++;
            dayOfWeekCounts[dow]++;
          }
        }
        return { id: e.id, name: e.name, skill_type: e.skill_type, absentDays, dayOfWeekCounts };
      }).filter((r) => r.absentDays > 0).sort((a, b) => b.absentDays - a.absentDays);

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

export interface CostProjectRow {
  id: string;
  name: string;
  status: string;
  budget: number;
  projectValue: number;
  laborCost: number;
  otCost: number;
  expenses: number;
  totalCost: number;
  variance: number;
  pctUsed: number;
  forecastedFinal: number;
  grossProfit: number;
  margin: number;
  startDate: string | null;
  endDate: string | null;
  dailyCosts: { date: string; labor: number; ot: number; expenses: number }[];
}

export function useCostData(start: string, end: string, filters?: {
  projectIds?: string[];
  status?: string;
  branchId?: string;
}) {
  return useQuery({
    queryKey: ["report-costs", start, end, filters],
    queryFn: async () => {
      let projQuery = supabase
        .from("projects")
        .select("id, name, budget, project_value, status, branch_id, start_date, end_date");

      if (filters?.status && filters.status !== "all") {
        projQuery = projQuery.eq("status", filters.status as any);
      } else {
        projQuery = projQuery.in("status", ["on_hold", "in_progress", "completed"]);
      }
      if (filters?.branchId && filters.branchId !== "all") {
        projQuery = projQuery.eq("branch_id", filters.branchId);
      }

      const [logsRes, expensesRes, projectsRes, branchRes] = await Promise.all([
        supabase.from("attendance_logs")
          .select("project_id, date, regular_cost, overtime_cost")
          .gte("date", start).lte("date", end),
        supabase.from("project_expenses")
          .select("project_id, date, amount_aed, category, status")
          .gte("date", start).lte("date", end),
        projQuery,
        supabase.from("branches").select("id, name").order("name"),
      ]);

      const logs = logsRes.data ?? [];
      const expenses = expensesRes.data ?? [];
      let projects = projectsRes.data ?? [];
      const branches = branchRes.data ?? [];

      if (filters?.projectIds?.length) {
        projects = projects.filter((p) => filters.projectIds!.includes(p.id));
      }

      const projMap = new Map<string, {
        name: string; status: string; budget: number; projectValue: number;
        laborCost: number; otCost: number; expenses: number;
        startDate: string | null; endDate: string | null;
        dailyCosts: Map<string, { labor: number; ot: number; expenses: number }>;
      }>();
      for (const p of projects) {
        projMap.set(p.id, {
          name: p.name, status: p.status, budget: Number(p.budget ?? 0),
          projectValue: Number(p.project_value ?? 0),
          laborCost: 0, otCost: 0, expenses: 0,
          startDate: p.start_date, endDate: p.end_date,
          dailyCosts: new Map(),
        });
      }

      for (const l of logs) {
        if (l.project_id && projMap.has(l.project_id)) {
          const p = projMap.get(l.project_id)!;
          const reg = Number(l.regular_cost ?? 0);
          const ot = Number(l.overtime_cost ?? 0);
          p.laborCost += reg;
          p.otCost += ot;
          if (!p.dailyCosts.has(l.date)) p.dailyCosts.set(l.date, { labor: 0, ot: 0, expenses: 0 });
          const dc = p.dailyCosts.get(l.date)!;
          dc.labor += reg;
          dc.ot += ot;
        }
      }
      for (const e of expenses) {
        if (e.status === "approved" && projMap.has(e.project_id)) {
          const p = projMap.get(e.project_id)!;
          const amt = Number(e.amount_aed ?? 0);
          p.expenses += amt;
          if (!p.dailyCosts.has(e.date)) p.dailyCosts.set(e.date, { labor: 0, ot: 0, expenses: 0 });
          p.dailyCosts.get(e.date)!.expenses += amt;
        }
      }

      const byProject: CostProjectRow[] = [...projMap.entries()].map(([id, p]) => {
        const totalCost = Math.round(p.laborCost + p.otCost + p.expenses);
        const budget = Math.round(p.budget);
        const variance = budget > 0 ? budget - totalCost : 0;
        const pctUsed = budget > 0 ? Math.round((totalCost / budget) * 100) : 0;
        const daysWithCost = p.dailyCosts.size;

        let forecastedFinal = totalCost;
        if (daysWithCost > 0 && p.endDate) {
          const today = new Date();
          const endDt = new Date(p.endDate);
          const remaining = Math.max(0, Math.ceil((endDt.getTime() - today.getTime()) / 86400000));
          const avgDaily = totalCost / daysWithCost;
          forecastedFinal = Math.round(totalCost + avgDaily * remaining);
        }

        const grossProfit = Math.round(p.projectValue - totalCost);
        const margin = p.projectValue > 0 ? Math.round((grossProfit / p.projectValue) * 100) : 0;

        const dailyCosts = Array.from(p.dailyCosts.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, c]) => ({
            date,
            labor: Math.round(c.labor),
            ot: Math.round(c.ot),
            expenses: Math.round(c.expenses),
          }));

        return {
          id, name: p.name, status: p.status, budget,
          projectValue: Math.round(p.projectValue),
          laborCost: Math.round(p.laborCost), otCost: Math.round(p.otCost),
          expenses: Math.round(p.expenses), totalCost, variance, pctUsed,
          forecastedFinal, grossProfit, margin,
          startDate: p.startDate, endDate: p.endDate, dailyCosts,
        };
      }).sort((a, b) => b.totalCost - a.totalCost);

      const catMap = new Map<string, number>();
      catMap.set("labor", logs.reduce((s, l) => {
        if (l.project_id && projMap.has(l.project_id)) return s + Number(l.regular_cost ?? 0);
        return s;
      }, 0));
      catMap.set("overtime", logs.reduce((s, l) => {
        if (l.project_id && projMap.has(l.project_id)) return s + Number(l.overtime_cost ?? 0);
        return s;
      }, 0));
      for (const e of expenses.filter((e) => e.status === "approved" && projMap.has(e.project_id))) {
        catMap.set(e.category, (catMap.get(e.category) ?? 0) + Number(e.amount_aed ?? 0));
      }
      const byCategory = [...catMap.entries()]
        .map(([category, amount]) => ({ category, amount: Math.round(amount) }))
        .filter((c) => c.amount > 0);

      const dailyTrend = new Map<string, { labor: number; ot: number; expenses: number }>();
      for (const p of byProject) {
        for (const dc of p.dailyCosts) {
          if (!dailyTrend.has(dc.date)) dailyTrend.set(dc.date, { labor: 0, ot: 0, expenses: 0 });
          const t = dailyTrend.get(dc.date)!;
          t.labor += dc.labor;
          t.ot += dc.ot;
          t.expenses += dc.expenses;
        }
      }
      const costTrend = Array.from(dailyTrend.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, c]) => ({
          date,
          label: date.split("-")[2],
          labor: c.labor,
          ot: c.ot,
          expenses: c.expenses,
          total: c.labor + c.ot + c.expenses,
        }));

      const totalCost = byProject.reduce((s, p) => s + p.totalCost, 0);
      const totalBudget = byProject.reduce((s, p) => s + p.budget, 0);
      const totalLabor = byProject.reduce((s, p) => s + p.laborCost, 0);
      const totalOt = byProject.reduce((s, p) => s + p.otCost, 0);

      return {
        byProject, byCategory, costTrend, totalCost, totalBudget, totalLabor, totalOt,
        branches: branches.map((b) => ({ id: b.id, name: b.name })),
        projects: projects.map((p) => ({ id: p.id, name: p.name })),
      };
    },
  });
}

export function useExecutiveData(start: string, end: string) {
  return useQuery({
    queryKey: ["report-executive", start, end],
    queryFn: async () => {
      const workingDays = countWorkingDays(start, end);

      // Previous period for comparison (same length before start)
      const startDate = new Date(start);
      const endDate = new Date(end);
      const rangeDays = Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000) + 1;
      const prevEnd = new Date(startDate);
      prevEnd.setDate(prevEnd.getDate() - 1);
      const prevStart = new Date(prevEnd);
      prevStart.setDate(prevStart.getDate() - rangeDays + 1);
      const prevStartStr = prevStart.toISOString().slice(0, 10);
      const prevEndStr = prevEnd.toISOString().slice(0, 10);

      const todayStr = new Date(Date.now() + 4 * 3600000).toISOString().slice(0, 10);

      // 12-week utilization trend
      const weekStarts: string[] = [];
      const now = new Date();
      for (let w = 11; w >= 0; w--) {
        const d = new Date(now);
        d.setDate(d.getDate() - d.getDay() - w * 7);
        weekStarts.push(d.toISOString().slice(0, 10));
      }
      const twelveWeeksAgo = weekStarts[0];

      const [
        empRes, projRes, logsRes, prevLogsRes, assignTodayRes,
        branchRes, notifRes, weeklyLogsRes,
      ] = await Promise.all([
        supabase.from("employees").select("id, branch_id, is_active, standard_hours_per_day", { count: "exact" }).eq("is_active", true),
        supabase.from("projects").select("id, name, status, branch_id, budget", { count: "exact" }).in("status", ["in_progress"]),
        supabase.from("attendance_logs")
          .select("employee_id, total_work_minutes, overtime_minutes, regular_cost, overtime_cost, date, project_id")
          .gte("date", start).lte("date", end),
        supabase.from("attendance_logs")
          .select("regular_cost, overtime_cost")
          .gte("date", prevStartStr).lte("date", prevEndStr),
        supabase.from("project_assignments")
          .select("employee_id", { count: "exact" })
          .eq("date", todayStr),
        supabase.from("branches").select("id, name"),
        supabase.from("notifications")
          .select("type, is_read")
          .eq("is_read", false),
        supabase.from("attendance_logs")
          .select("employee_id, date, total_work_minutes")
          .gte("date", twelveWeeksAgo),
      ]);

      const employees = empRes.data ?? [];
      const projects = projRes.data ?? [];
      const logs = logsRes.data ?? [];
      const prevLogs = prevLogsRes.data ?? [];
      const branches = branchRes.data ?? [];
      const unreadNotifs = notifRes.data ?? [];
      const weeklyLogs = weeklyLogsRes.data ?? [];

      const totalHours = Math.round(logs.reduce((s, l) => s + (l.total_work_minutes ?? 0), 0) / 60);
      const totalOtHours = Math.round(logs.reduce((s, l) => s + (l.overtime_minutes ?? 0), 0) / 60);
      const totalLaborCost = Math.round(logs.reduce((s, l) => s + Number(l.regular_cost ?? 0) + Number(l.overtime_cost ?? 0), 0));
      const prevMonthSpend = Math.round(prevLogs.reduce((s, l) => s + Number(l.regular_cost ?? 0) + Number(l.overtime_cost ?? 0), 0));
      const spendChange = prevMonthSpend > 0 ? Math.round(((totalLaborCost - prevMonthSpend) / prevMonthSpend) * 100) : 0;
      const totalBudget = projects.reduce((s, p) => s + Number(p.budget ?? 0), 0);
      const deployedToday = assignTodayRes.count ?? 0;

      const totalCapacity = employees.reduce((s, e) => s + workingDays * Number(e.standard_hours_per_day), 0);
      const companyUtilization = totalCapacity > 0 ? Math.round((totalHours / totalCapacity) * 100) : 0;

      const projCostMap = new Map<string, { name: string; cost: number; labor: number; ot: number }>();
      for (const p of projects) {
        projCostMap.set(p.id, { name: p.name, cost: 0, labor: 0, ot: 0 });
      }
      for (const l of logs) {
        if (l.project_id && projCostMap.has(l.project_id)) {
          const pc = projCostMap.get(l.project_id)!;
          pc.labor += Number(l.regular_cost ?? 0);
          pc.ot += Number(l.overtime_cost ?? 0);
          pc.cost += Number(l.regular_cost ?? 0) + Number(l.overtime_cost ?? 0);
        }
      }
      const top5Projects = [...projCostMap.values()]
        .sort((a, b) => b.cost - a.cost)
        .slice(0, 5)
        .map((p) => ({
          name: p.name.length > 18 ? p.name.slice(0, 16) + "…" : p.name,
          labor: Math.round(p.labor),
          ot: Math.round(p.ot),
          total: Math.round(p.cost),
        }));

      const weeklyUtilization = weekStarts.map((ws, i) => {
        const weekEnd = i < weekStarts.length - 1 ? weekStarts[i + 1] : new Date(new Date(ws).getTime() + 7 * 86400000).toISOString().slice(0, 10);
        const wLogs = weeklyLogs.filter((l) => l.date >= ws && l.date < weekEnd);
        const weekHours = wLogs.reduce((s, l) => s + (l.total_work_minutes ?? 0), 0) / 60;
        const weekCapacity = employees.length * 5 * 8;
        const util = weekCapacity > 0 ? Math.round((weekHours / weekCapacity) * 100) : 0;
        return { week: ws, weekLabel: `W${i + 1}`, utilization: Math.min(util, 100), hours: Math.round(weekHours) };
      });

      const branchStats = branches.map((b) => {
        const branchEmps = employees.filter((e) => e.branch_id === b.id);
        const branchEmpIds = new Set(branchEmps.map((e) => e.id));
        const branchLogs = logs.filter((l) => branchEmpIds.has(l.employee_id));
        const branchHours = Math.round(branchLogs.reduce((s, l) => s + (l.total_work_minutes ?? 0), 0) / 60);
        const branchCost = Math.round(branchLogs.reduce((s, l) => s + Number(l.regular_cost ?? 0) + Number(l.overtime_cost ?? 0), 0));
        const branchCapacity = branchEmps.reduce((s, e) => s + workingDays * Number(e.standard_hours_per_day), 0);
        const branchUtil = branchCapacity > 0 ? Math.round((branchHours / branchCapacity) * 100) : 0;
        return {
          name: b.name, id: b.id,
          employees: branchEmps.length, hours: branchHours,
          cost: branchCost, utilization: branchUtil,
        };
      }).filter((b) => b.employees > 0);

      const alertsByType = new Map<string, number>();
      for (const n of unreadNotifs) {
        alertsByType.set(n.type, (alertsByType.get(n.type) ?? 0) + 1);
      }
      const unresolvedAlerts = [...alertsByType.entries()]
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count);

      const dailyCost = new Map<string, number>();
      for (const l of logs) {
        const cost = Number(l.regular_cost ?? 0) + Number(l.overtime_cost ?? 0);
        dailyCost.set(l.date, (dailyCost.get(l.date) ?? 0) + cost);
      }
      const costTrend = [...dailyCost.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, cost]) => ({ date, cost: Math.round(cost) }));

      return {
        activeEmployees: empRes.count ?? 0,
        activeProjects: projRes.count ?? 0,
        deployedToday,
        companyUtilization,
        totalHours,
        totalOtHours,
        totalLaborCost,
        prevMonthSpend,
        spendChange,
        totalBudget: Math.round(totalBudget),
        top5Projects,
        weeklyUtilization,
        branchStats,
        unresolvedAlerts,
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

// ─── Attendance Report ──────────────────────────────────────
export function useAttendanceReport(start: string, end: string, filters?: { branchId?: string }) {
  return useQuery({
    queryKey: ["report-attendance", start, end, filters],
    queryFn: async () => {
      const workingDays = countWorkingDays(start, end);

      let empQuery = supabase.from("employees").select("id, name, branch_id, standard_hours_per_day").eq("is_active", true);
      if (filters?.branchId && filters.branchId !== "all") empQuery = empQuery.eq("branch_id", filters.branchId);

      const [empRes, logsRes, branchRes] = await Promise.all([
        empQuery,
        supabase.from("attendance_logs")
          .select("employee_id, date, total_work_minutes, office_punch_in, work_start_time")
          .gte("date", start).lte("date", end),
        supabase.from("branches").select("id, name").order("name"),
      ]);

      const employees = empRes.data ?? [];
      const logs = logsRes.data ?? [];
      const branches = branchRes.data ?? [];

      const logMap = new Map<string, { days: Set<string>; totalMin: number; lateDays: number; punchInDays: number }>();
      const dailyCount = new Map<string, number>();

      for (const l of logs) {
        if (!logMap.has(l.employee_id)) logMap.set(l.employee_id, { days: new Set(), totalMin: 0, lateDays: 0, punchInDays: 0 });
        const entry = logMap.get(l.employee_id)!;
        entry.days.add(l.date);
        entry.totalMin += l.total_work_minutes ?? 0;
        if (l.office_punch_in) entry.punchInDays++;
        dailyCount.set(l.date, (dailyCount.get(l.date) ?? 0) + 1);
      }

      const rows = employees.map((e) => {
        const entry = logMap.get(e.id);
        const daysWorked = entry?.days.size ?? 0;
        const avgHours = daysWorked > 0 ? Math.round((entry!.totalMin / daysWorked) / 60 * 10) / 10 : 0;
        const lateDays = entry?.lateDays ?? 0;
        const onTimePct = daysWorked > 0 ? Math.round(((daysWorked - lateDays) / daysWorked) * 100) : 100;
        const punchInRate = workingDays > 0 ? Math.round(((entry?.punchInDays ?? 0) / workingDays) * 100) : 0;
        return { id: e.id, name: e.name, daysWorked, avgHours, lateDays, onTimePct, punchInRate };
      }).sort((a, b) => b.daysWorked - a.daysWorked);

      const totalEmployees = employees.length;
      const avgAttendanceRate = totalEmployees > 0 && workingDays > 0
        ? Math.round((rows.reduce((s, r) => s + r.daysWorked, 0) / (totalEmployees * workingDays)) * 100) : 0;
      const avgHoursPerDay = rows.length > 0 ? Math.round(rows.reduce((s, r) => s + r.avgHours, 0) / rows.length * 10) / 10 : 0;
      const totalLateDays = rows.reduce((s, r) => s + r.lateDays, 0);

      const dailyTrend = [...dailyCount.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([d, c]) => ({ day: d.split("-")[2], present: c }));
      const onTimeCount = rows.filter((r) => r.onTimePct >= 90).length;
      const lateCount = rows.filter((r) => r.onTimePct < 90 && r.onTimePct >= 50).length;
      const poorCount = rows.filter((r) => r.onTimePct < 50).length;
      const punctualityDist = [
        { name: "On Time (≥90%)", value: onTimeCount },
        { name: "Sometimes Late", value: lateCount },
        { name: "Frequently Late", value: poorCount },
      ].filter((d) => d.value > 0);

      return { rows, totalEmployees, avgAttendanceRate, avgHoursPerDay, totalLateDays, dailyTrend, punctualityDist, branches };
    },
  });
}

// ─── Overtime Report ────────────────────────────────────────
export function useOvertimeReport(start: string, end: string, filters?: { branchId?: string }) {
  return useQuery({
    queryKey: ["report-overtime", start, end, filters],
    queryFn: async () => {
      let empQuery = supabase.from("employees").select("id, name, skill_type, branch_id, hourly_rate, overtime_rate").eq("is_active", true);
      if (filters?.branchId && filters.branchId !== "all") empQuery = empQuery.eq("branch_id", filters.branchId);

      const [empRes, logsRes, branchRes] = await Promise.all([
        empQuery,
        supabase.from("attendance_logs")
          .select("employee_id, date, total_work_minutes, overtime_minutes, overtime_cost")
          .gte("date", start).lte("date", end),
        supabase.from("branches").select("id, name").order("name"),
      ]);

      const employees = empRes.data ?? [];
      const logs = logsRes.data ?? [];
      const branches = branchRes.data ?? [];

      const logMap = new Map<string, { regularMin: number; otMin: number; otCost: number; otDays: Set<string>; dailyOt: Map<string, number> }>();
      for (const l of logs) {
        if (!logMap.has(l.employee_id)) logMap.set(l.employee_id, { regularMin: 0, otMin: 0, otCost: 0, otDays: new Set(), dailyOt: new Map() });
        const entry = logMap.get(l.employee_id)!;
        const ot = l.overtime_minutes ?? 0;
        entry.regularMin += (l.total_work_minutes ?? 0) - ot;
        entry.otMin += ot;
        entry.otCost += Number(l.overtime_cost ?? 0);
        if (ot > 0) entry.otDays.add(l.date);
        entry.dailyOt.set(l.date, (entry.dailyOt.get(l.date) ?? 0) + ot);
      }

      const rows = employees.map((e) => {
        const entry = logMap.get(e.id);
        const regularHours = Math.round((entry?.regularMin ?? 0) / 60);
        const otHours = Math.round((entry?.otMin ?? 0) / 60);
        const otCost = Math.round(entry?.otCost ?? 0);
        const otDays = entry?.otDays.size ?? 0;
        const totalHours = regularHours + otHours;
        const otRatio = totalHours > 0 ? Math.round((otHours / totalHours) * 100) : 0;
        return { id: e.id, name: e.name, skill: e.skill_type, regularHours, otHours, otCost, otDays, otRatio };
      }).filter((r) => r.otHours > 0 || r.regularHours > 0).sort((a, b) => b.otHours - a.otHours);

      const totalOtHours = rows.reduce((s, r) => s + r.otHours, 0);
      const totalOtCost = rows.reduce((s, r) => s + r.otCost, 0);
      const employeesWithOt = rows.filter((r) => r.otHours > 0).length;
      const avgOtPerEmployee = employeesWithOt > 0 ? Math.round(totalOtHours / employeesWithOt) : 0;

      const dailyOtMap = new Map<string, number>();
      for (const l of logs) {
        if (l.overtime_minutes && l.overtime_minutes > 0) {
          dailyOtMap.set(l.date, (dailyOtMap.get(l.date) ?? 0) + l.overtime_minutes);
        }
      }
      const dailyTrend = [...dailyOtMap.entries()].sort(([a], [b]) => a.localeCompare(b))
        .map(([d, m]) => ({ day: d.split("-")[2], otHours: Math.round(m / 60) }));

      return { rows, totalOtHours, totalOtCost, employeesWithOt, avgOtPerEmployee, dailyTrend, branches };
    },
  });
}

// ─── Manpower Report ────────────────────────────────────────
export function useManpowerReport(start: string, end: string, filters?: { branchId?: string }) {
  return useQuery({
    queryKey: ["report-manpower", start, end, filters],
    queryFn: async () => {
      let projQuery = supabase.from("projects")
        .select("id, name, status, branch_id, required_technicians, required_helpers, required_supervisors")
        .in("status", ["in_progress"]);
      if (filters?.branchId && filters.branchId !== "all") projQuery = projQuery.eq("branch_id", filters.branchId);

      const todayStr = new Date(Date.now() + 4 * 3600000).toISOString().slice(0, 10);

      const [projRes, assignRes, branchRes] = await Promise.all([
        projQuery,
        supabase.from("project_assignments")
          .select("project_id, employee_id, employees(skill_type)")
          .eq("date", todayStr),
        supabase.from("branches").select("id, name").order("name"),
      ]);

      const projects = projRes.data ?? [];
      const assignments = assignRes.data ?? [];
      const branches = branchRes.data ?? [];

      const rows = projects.map((p) => {
        const projAssigns = assignments.filter((a) => a.project_id === p.id);
        const required = (p as any).required_team_members + p.required_supervisors;
        const assigned = projAssigns.length;
        const teamMembers = projAssigns.filter((a: any) => a.employees?.skill_type === "team_member").length;
        const teamLeaders = projAssigns.filter((a: any) => a.employees?.skill_type === "team_leader").length;
        const fillRate = required > 0 ? Math.round((assigned / required) * 100) : assigned > 0 ? 100 : 0;
        return { id: p.id, name: p.name, status: p.status, required, assigned, fillRate, teamMembers, teamLeaders };
      }).sort((a, b) => a.fillRate - b.fillRate);

      const totalProjects = rows.length;
      const totalRequired = rows.reduce((s, r) => s + r.required, 0);
      const avgFillRate = totalProjects > 0 ? Math.round(rows.reduce((s, r) => s + r.fillRate, 0) / totalProjects) : 0;
      const understaffed = rows.filter((r) => r.fillRate < 100).length;

      return { rows, totalProjects, totalRequired, avgFillRate, understaffed, branches };
    },
  });
}

// ─── Absentee Report ────────────────────────────────────────
export function useAbsenteeReport(start: string, end: string, filters?: { branchId?: string }) {
  return useQuery({
    queryKey: ["report-absentee", start, end, filters],
    queryFn: async () => {
      const workingDays = countWorkingDays(start, end);
      const allDays = allDates(start, end);

      let empQuery = supabase.from("employees").select("id, name, skill_type, branch_id").eq("is_active", true);
      if (filters?.branchId && filters.branchId !== "all") empQuery = empQuery.eq("branch_id", filters.branchId);

      const [empRes, logsRes, leaveRes, branchRes] = await Promise.all([
        empQuery,
        supabase.from("attendance_logs")
          .select("employee_id, date")
          .gte("date", start).lte("date", end),
        supabase.from("employee_leave")
          .select("employee_id, start_date, end_date")
          .lte("start_date", end).gte("end_date", start),
        supabase.from("branches").select("id, name").order("name"),
      ]);

      const employees = empRes.data ?? [];
      const logs = logsRes.data ?? [];
      const leaves = leaveRes.data ?? [];
      const branches = branchRes.data ?? [];

      const attendedDays = new Map<string, Set<string>>();
      for (const l of logs) {
        if (!attendedDays.has(l.employee_id)) attendedDays.set(l.employee_id, new Set());
        attendedDays.get(l.employee_id)!.add(l.date);
      }

      const leaveDaysMap = new Map<string, number>();
      for (const l of leaves) {
        const s = new Date(Math.max(new Date(l.start_date).getTime(), new Date(start).getTime()));
        const e = new Date(Math.min(new Date(l.end_date).getTime(), new Date(end).getTime()));
        let count = 0;
        for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
          if (d.getDay() !== 5) count++;
        }
        leaveDaysMap.set(l.employee_id, (leaveDaysMap.get(l.employee_id) ?? 0) + count);
      }

      const dayOfWeekTotals = [0, 0, 0, 0, 0, 0, 0];
      const rows = employees.map((e) => {
        const attended = attendedDays.get(e.id)?.size ?? 0;
        const leaveDays = leaveDaysMap.get(e.id) ?? 0;
        const absentDays = Math.max(0, workingDays - attended);
        const unexcusedDays = Math.max(0, absentDays - leaveDays);
        const absenceRate = workingDays > 0 ? Math.round((absentDays / workingDays) * 100) : 0;

        for (const dateStr of allDays) {
          const dt = new Date(dateStr);
          if (dt.getDay() === 5) continue;
          if (!attendedDays.get(e.id)?.has(dateStr)) {
            dayOfWeekTotals[dt.getDay()]++;
          }
        }

        return { id: e.id, name: e.name, skill: e.skill_type, absentDays, leaveDays, unexcusedDays, absenceRate };
      }).filter((r) => r.absentDays > 0).sort((a, b) => b.absentDays - a.absentDays);

      const totalAbsentDays = rows.reduce((s, r) => s + r.absentDays, 0);
      const totalLeaveDays = rows.reduce((s, r) => s + r.leaveDays, 0);
      const totalUnexcused = rows.reduce((s, r) => s + r.unexcusedDays, 0);
      const avgAbsenceRate = rows.length > 0 ? Math.round(rows.reduce((s, r) => s + r.absenceRate, 0) / rows.length) : 0;

      const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const dayOfWeekData = dayOfWeekTotals.map((c, i) => ({ day: dayNames[i], absences: c })).filter((d) => d.day !== "Fri");

      return { rows, totalAbsentDays, totalLeaveDays, totalUnexcused, avgAbsenceRate, dayOfWeekData, branches };
    },
  });
}
