import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

function monthRange(month: string) {
  const [y, m] = month.split("-").map(Number);
  const start = `${month}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const end = `${month}-${String(lastDay).padStart(2, "0")}`;
  return { start, end, lastDay };
}

export function useUtilizationData(month: string) {
  return useQuery({
    queryKey: ["report-utilization", month],
    queryFn: async () => {
      const { start, end, lastDay } = monthRange(month);
      const workingDays = 22;

      const [empRes, logsRes] = await Promise.all([
        supabase.from("employees").select("id, name, skill_type, standard_hours_per_day").eq("is_active", true).order("name"),
        supabase.from("attendance_logs").select("employee_id, date, total_work_minutes").gte("date", start).lte("date", end),
      ]);

      const employees = empRes.data ?? [];
      const logs = logsRes.data ?? [];

      const logMap = new Map<string, { days: Set<string>; totalMin: number }>();
      for (const l of logs) {
        if (!logMap.has(l.employee_id)) logMap.set(l.employee_id, { days: new Set(), totalMin: 0 });
        const entry = logMap.get(l.employee_id)!;
        entry.days.add(l.date);
        entry.totalMin += l.total_work_minutes ?? 0;
      }

      const rows = employees.map((e) => {
        const entry = logMap.get(e.id);
        const daysWorked = entry?.days.size ?? 0;
        const totalHours = Math.round(((entry?.totalMin ?? 0) / 60) * 10) / 10;
        const capacity = workingDays * Number(e.standard_hours_per_day);
        const utilization = capacity > 0 ? Math.round((totalHours / capacity) * 100) : 0;
        return { name: e.name, skill_type: e.skill_type, daysWorked, totalHours, capacity, utilization };
      });

      // By skill type
      const bySkill = ["technician", "helper", "supervisor"].map((skill) => {
        const group = rows.filter((r) => r.skill_type === skill);
        const avgUtil = group.length > 0 ? Math.round(group.reduce((s, r) => s + r.utilization, 0) / group.length) : 0;
        return { skill, count: group.length, avgUtilization: avgUtil };
      });

      // Daily trend
      const dailyMap = new Map<string, number>();
      for (const l of logs) {
        dailyMap.set(l.date, (dailyMap.get(l.date) ?? 0) + (l.total_work_minutes ?? 0));
      }
      const dailyTrend = Array.from(dailyMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, min]) => ({ date, hours: Math.round((min / 60) * 10) / 10 }));

      return { rows, bySkill, dailyTrend, avgUtilization: rows.length ? Math.round(rows.reduce((s, r) => s + r.utilization, 0) / rows.length) : 0 };
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

      // By project
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

      // By category
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

      // Daily cost trend
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
