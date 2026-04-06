import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type Project = Tables<"projects"> & {
  branches?: { name: string } | null;
};

export function useProjects(filters?: {
  search?: string;
  status?: string;
  branchId?: string;
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

      const { data, error } = await query;
      if (error) throw error;
      return data as Project[];
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
