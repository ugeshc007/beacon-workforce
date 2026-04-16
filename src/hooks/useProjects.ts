import { toLocalDateStr } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type Project = Tables<"projects"> & {
  branches?: { name: string } | null;
  actual_cost?: number;
};

export function useProjects(filters?: {
  search?: string;
  status?: string;
  branchId?: string;
  dateFrom?: string;
  dateTo?: string;
  userRole?: string | null;
  userId?: string | null;
}) {
  return useQuery({
    queryKey: ["projects", filters],
    queryFn: async () => {
      let query = supabase
        .from("projects")
        .select("*, branches(name)")
        .order("created_at", { ascending: false });

      // Non-admin, non-team_leader users only see projects they created
      // or projects that have team assignments (employees added)
      if (filters?.userId && filters?.userRole && filters.userRole !== "admin" && filters.userRole !== "team_leader") {
        // First get project IDs that have any assignments
        const { data: assignedProjects } = await supabase
          .from("project_assignments")
          .select("project_id")
          .limit(1000);
        
        const assignedIds = Array.from(new Set((assignedProjects ?? []).map(a => a.project_id)));
        
        // Show projects the user created OR projects with team assignments
        if (assignedIds.length > 0) {
          query = query.or(`created_by.eq.${filters.userId},id.in.(${assignedIds.join(",")})`);
        } else {
          query = query.eq("created_by", filters.userId);
        }
      }

      if (filters?.search) {
        const s = `%${filters.search}%`;
        query = query.or(`name.ilike.${s},client_name.ilike.${s},site_address.ilike.${s}`);
      }
      if (filters?.status && filters.status !== "all") {
        query = query.eq("status", filters.status as any);
      }
      if (filters?.branchId && filters.branchId !== "all") {
        query = query.eq("branch_id", filters.branchId);
      }
      if (filters?.dateFrom) {
        query = query.gte("start_date", filters.dateFrom);
      }
      if (filters?.dateTo) {
        query = query.lte("start_date", filters.dateTo);
      }

      const { data, error } = await query;
      if (error) throw error;

      const projects = data as Project[];

      // Fetch actual costs (labor + approved expenses) for projects with budgets
      const withBudget = projects.filter((p) => p.budget);
      if (withBudget.length) {
        const ids = withBudget.map((p) => p.id);

        const [laborRes, expenseRes] = await Promise.all([
          supabase
            .from("attendance_logs")
            .select("project_id, regular_cost, overtime_cost")
            .in("project_id", ids),
          supabase
            .from("project_expenses")
            .select("project_id, amount_aed, status")
            .in("project_id", ids)
            .eq("status", "approved"),
        ]);

        const costMap: Record<string, number> = {};
        for (const a of laborRes.data ?? []) {
          costMap[a.project_id!] = (costMap[a.project_id!] ?? 0) + Number(a.regular_cost ?? 0) + Number(a.overtime_cost ?? 0);
        }
        for (const e of expenseRes.data ?? []) {
          costMap[e.project_id] = (costMap[e.project_id] ?? 0) + Number(e.amount_aed ?? 0);
        }
        for (const p of projects) {
          p.actual_cost = costMap[p.id] ?? 0;
        }
      }

      return projects;
    },
  });
}

export function useProject(id: string | null) {
  return useQuery({
    queryKey: ["project", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*, branches(name)")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data as Project | null;
    },
  });
}

export function useProjectStats(projectId: string | null) {
  return useQuery({
    queryKey: ["project-stats", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const today = toLocalDateStr(new Date());

      const [assignRes, expenseRes, attendanceRes] = await Promise.all([
        supabase
          .from("project_assignments")
          .select("id, employee_id, date")
          .eq("project_id", projectId!)
          .eq("date", today),
        supabase
          .from("project_expenses")
          .select("amount_aed, category, status")
          .eq("project_id", projectId!),
        supabase
          .from("attendance_logs")
          .select("total_work_minutes, overtime_minutes, regular_cost, overtime_cost")
          .eq("project_id", projectId!),
      ]);

      const todayStaff = assignRes.data?.length ?? 0;
      const totalExpenses = (expenseRes.data ?? [])
        .filter((e) => e.status === "approved")
        .reduce((s, e) => s + Number(e.amount_aed ?? 0), 0);
      const totalLaborCost = (attendanceRes.data ?? []).reduce(
        (s, a) => s + Number(a.regular_cost ?? 0) + Number(a.overtime_cost ?? 0),
        0
      );
      const totalHours = (attendanceRes.data ?? []).reduce(
        (s, a) => s + (a.total_work_minutes ?? 0),
        0
      ) / 60;

      return { todayStaff, totalExpenses, totalLaborCost, totalHours: Math.round(totalHours * 10) / 10 };
    },
  });
}

export function useProjectTeam(projectId: string | null) {
  return useQuery({
    queryKey: ["project-team", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_assignments")
        .select("id, employee_id, date, shift_start, shift_end, employees(id, name, skill_type, phone)")
        .eq("project_id", projectId!)
        .order("date", { ascending: false });
      if (error) throw error;

      // Deduplicate: keep the latest assignment per employee
      const seen = new Set<string>();
      const unique = (data ?? []).filter((a) => {
        if (seen.has(a.employee_id)) return false;
        seen.add(a.employee_id);
        return true;
      });
      return unique;
    },
  });
}

export function useProjectExpenses(projectId: string | null) {
  return useQuery({
    queryKey: ["project-expenses", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_expenses")
        .select("*")
        .eq("project_id", projectId!)
        .order("date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useProjectSchedule(projectId: string | null) {
  return useQuery({
    queryKey: ["project-schedule", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_assignments")
        .select("id, employee_id, date, shift_start, shift_end, is_locked, assignment_mode, employees(name, skill_type)")
        .eq("project_id", projectId!)
        .order("date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useProjectAttendance(projectId: string | null) {
  return useQuery({
    queryKey: ["project-attendance", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_logs")
        .select("id, employee_id, date, office_punch_in, office_punch_out, work_start_time, work_end_time, total_work_minutes, overtime_minutes, regular_cost, overtime_cost, employees(name, skill_type)")
        .eq("project_id", projectId!)
        .order("date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useProjectCosts(projectId: string | null) {
  return useQuery({
    queryKey: ["project-costs", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const [laborRes, expenseRes] = await Promise.all([
        supabase
          .from("attendance_logs")
          .select("date, regular_cost, overtime_cost, total_work_minutes, overtime_minutes, employee_id, employees(name, employee_code)")
          .eq("project_id", projectId!),
        supabase
          .from("project_expenses")
          .select("date, category, amount_aed, status, description")
          .eq("project_id", projectId!),
      ]);

      const laborRows = laborRes.data ?? [];
      const expenseRows = expenseRes.data ?? [];

      const totalLabor = laborRows.reduce((s, a) => s + Number(a.regular_cost ?? 0), 0);
      const totalOT = laborRows.reduce((s, a) => s + Number(a.overtime_cost ?? 0), 0);
      const totalApprovedExpenses = expenseRows
        .filter((e) => e.status === "approved")
        .reduce((s, e) => s + Number(e.amount_aed ?? 0), 0);
      const totalPendingExpenses = expenseRows
        .filter((e) => e.status === "pending")
        .reduce((s, e) => s + Number(e.amount_aed ?? 0), 0);

      // By category
      const byCategory: Record<string, number> = {};
      for (const e of expenseRows.filter((e) => e.status === "approved")) {
        byCategory[e.category] = (byCategory[e.category] ?? 0) + Number(e.amount_aed ?? 0);
      }

      // Weekly aggregation for charts
      const weeklyMap = new Map<string, { week: string; labor: number; overtime: number; expenses: number }>();
      const getWeekKey = (dateStr: string) => {
        const d = new Date(dateStr + "T00:00:00");
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(d.setDate(diff));
        return toLocalDateStr(monday);
      };

      for (const r of laborRows) {
        const wk = getWeekKey(r.date);
        if (!weeklyMap.has(wk)) weeklyMap.set(wk, { week: wk, labor: 0, overtime: 0, expenses: 0 });
        const w = weeklyMap.get(wk)!;
        w.labor += Number(r.regular_cost ?? 0);
        w.overtime += Number(r.overtime_cost ?? 0);
      }
      for (const e of expenseRows.filter((e) => e.status === "approved")) {
        const wk = getWeekKey(e.date);
        if (!weeklyMap.has(wk)) weeklyMap.set(wk, { week: wk, labor: 0, overtime: 0, expenses: 0 });
        weeklyMap.get(wk)!.expenses += Number(e.amount_aed ?? 0);
      }
      const weeklyData = Array.from(weeklyMap.values()).sort((a, b) => a.week.localeCompare(b.week));

      // Daily records for drill-down
      const dailyMap = new Map<string, { date: string; labor: number; overtime: number; expenses: number; records: any[] }>();
      for (const r of laborRows) {
        if (!dailyMap.has(r.date)) dailyMap.set(r.date, { date: r.date, labor: 0, overtime: 0, expenses: 0, records: [] });
        const d = dailyMap.get(r.date)!;
        d.labor += Number(r.regular_cost ?? 0);
        d.overtime += Number(r.overtime_cost ?? 0);
        d.records.push({ type: "labor", employee: (r as any).employees?.name ?? "Unknown", regular: Number(r.regular_cost ?? 0), ot: Number(r.overtime_cost ?? 0), minutes: r.total_work_minutes });
      }
      for (const e of expenseRows.filter((e) => e.status === "approved")) {
        if (!dailyMap.has(e.date)) dailyMap.set(e.date, { date: e.date, labor: 0, overtime: 0, expenses: 0, records: [] });
        const d = dailyMap.get(e.date)!;
        d.expenses += Number(e.amount_aed ?? 0);
        d.records.push({ type: "expense", category: e.category, amount: Number(e.amount_aed ?? 0), description: e.description });
      }
      const dailyData = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));

      // Unique dates with costs for forecast
      const uniqueDates = new Set([...laborRows.map((r) => r.date), ...expenseRows.filter((e) => e.status === "approved").map((e) => e.date)]);
      const daysWithCost = uniqueDates.size;

      return {
        totalLabor,
        totalOT,
        totalApprovedExpenses,
        totalPendingExpenses,
        totalCost: totalLabor + totalOT + totalApprovedExpenses,
        byCategory,
        laborRows,
        expenseRows,
        weeklyData,
        dailyData,
        daysWithCost,
      };
    },
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (project: TablesInsert<"projects">) => {
      const { data, error } = await supabase.from("projects").insert(project).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...project }: TablesUpdate<"projects"> & { id: string }) => {
      const { data, error } = await supabase.from("projects").update(project).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["project"] });
    },
  });
}

export function useAssignEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      projectId,
      employeeId,
      date,
      shiftStart,
      shiftEnd,
    }: {
      projectId: string;
      employeeId: string;
      date: string;
      shiftStart?: string;
      shiftEnd?: string;
    }) => {
      const { data, error } = await supabase
        .from("project_assignments")
        .insert({
          project_id: projectId,
          employee_id: employeeId,
          date,
          shift_start: shiftStart ?? "08:00",
          shift_end: shiftEnd ?? "17:00",
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["project-team", vars.projectId] });
      qc.invalidateQueries({ queryKey: ["project-stats", vars.projectId] });
    },
  });
}

export function useRemoveAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ assignmentId, projectId }: { assignmentId: string; projectId: string }) => {
      const { error } = await supabase
        .from("project_assignments")
        .delete()
        .eq("id", assignmentId);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["project-team", vars.projectId] });
      qc.invalidateQueries({ queryKey: ["project-stats", vars.projectId] });
    },
  });
}

export function useTemplates() {
  return useQuery({
    queryKey: ["project-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_templates")
        .select("*")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSaveTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (template: {
      name: string;
      required_technicians: number;
      required_helpers: number;
      required_supervisors: number;
      default_duration_days?: number;
    }) => {
      const { data, error } = await supabase
        .from("project_templates")
        .insert(template)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project-templates"] }),
  });
}
