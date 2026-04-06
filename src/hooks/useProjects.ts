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
}) {
  return useQuery({
    queryKey: ["projects", filters],
    queryFn: async () => {
      let query = supabase
        .from("projects")
        .select("*, branches(name)")
        .order("created_at", { ascending: false });

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
      const today = new Date().toISOString().split("T")[0];

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
          .select("date, regular_cost, overtime_cost, total_work_minutes, overtime_minutes")
          .eq("project_id", projectId!),
        supabase
          .from("project_expenses")
          .select("date, category, amount_aed, status")
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

      return {
        totalLabor,
        totalOT,
        totalApprovedExpenses,
        totalPendingExpenses,
        totalCost: totalLabor + totalOT + totalApprovedExpenses,
        byCategory,
        laborRows,
        expenseRows,
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
