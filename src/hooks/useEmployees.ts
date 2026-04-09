import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type Employee = Tables<"employees"> & {
  branches?: { name: string } | null;
};

export function useEmployees(filters?: {
  search?: string;
  skillType?: string;
  branchId?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}) {
  const page = filters?.page ?? 0;
  const pageSize = filters?.pageSize ?? 25;

  return useQuery({
    queryKey: ["employees", filters],
    queryFn: async () => {
      let query = supabase
        .from("employees")
        .select("*, branches(name)", { count: "exact" });

      if (filters?.search) {
        const s = `%${filters.search}%`;
        query = query.or(`name.ilike.${s},employee_code.ilike.${s},phone.ilike.${s},email.ilike.${s}`);
      }
      if (filters?.skillType && filters.skillType !== "all") {
        query = query.eq("skill_type", filters.skillType as "team_member" | "team_leader");
      }
      if (filters?.branchId && filters.branchId !== "all") {
        query = query.eq("branch_id", filters.branchId);
      }
      if (filters?.status === "active") query = query.eq("is_active", true);
      if (filters?.status === "inactive") query = query.eq("is_active", false);

      query = query
        .order("name")
        .range(page * pageSize, (page + 1) * pageSize - 1);

      const { data, count, error } = await query;
      if (error) throw error;
      return { data: data as Employee[], count: count ?? 0 };
    },
  });
}

export function useEmployee(id: string | null) {
  return useQuery({
    queryKey: ["employee", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("*, branches(name)")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data as Employee | null;
    },
  });
}

export function useEmployeeStats(employeeId: string | null) {
  return useQuery({
    queryKey: ["employee-stats", employeeId],
    enabled: !!employeeId,
    queryFn: async () => {
      const now = new Date();
      const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      const today = now.toISOString().split("T")[0];

      const [attendance, assignment] = await Promise.all([
        supabase
          .from("attendance_logs")
          .select("total_work_minutes, overtime_minutes, regular_cost, overtime_cost")
          .eq("employee_id", employeeId!)
          .gte("date", firstOfMonth)
          .lte("date", today),
        supabase
          .from("project_assignments")
          .select("id, date, project_id, projects(name)")
          .eq("employee_id", employeeId!)
          .gte("date", firstOfMonth)
          .lte("date", today),
      ]);

      const totalMinutes = (attendance.data ?? []).reduce((s, r) => s + (r.total_work_minutes ?? 0), 0);
      const otMinutes = (attendance.data ?? []).reduce((s, r) => s + (r.overtime_minutes ?? 0), 0);
      const totalRegCost = (attendance.data ?? []).reduce((s, r) => s + Number(r.regular_cost ?? 0), 0);
      const totalOtCost = (attendance.data ?? []).reduce((s, r) => s + Number(r.overtime_cost ?? 0), 0);
      const workingDaysInMonth = 22;
      const daysWorked = attendance.data?.length ?? 0;
      const utilization = workingDaysInMonth > 0 ? Math.round((daysWorked / workingDaysInMonth) * 100) : 0;

      // Current assignment (today)
      const { data: todayAssignment } = await supabase
        .from("project_assignments")
        .select("*, projects(name, site_address)")
        .eq("employee_id", employeeId!)
        .eq("date", today)
        .maybeSingle();

      return {
        totalHours: Math.round(totalMinutes / 60 * 10) / 10,
        otHours: Math.round(otMinutes / 60 * 10) / 10,
        regularCost: totalRegCost,
        otCost: totalOtCost,
        daysWorked,
        utilization,
        todayAssignment,
        assignmentCount: assignment.data?.length ?? 0,
      };
    },
  });
}

export function useBranches() {
  return useQuery({
    queryKey: ["branches"],
    queryFn: async () => {
      const { data, error } = await supabase.from("branches").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (emp: TablesInsert<"employees">) => {
      const { data, error } = await supabase.from("employees").insert(emp).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["employees"] }),
  });
}

export function useUpdateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...emp }: TablesUpdate<"employees"> & { id: string }) => {
      const { data, error } = await supabase.from("employees").update(emp).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employees"] });
      qc.invalidateQueries({ queryKey: ["employee"] });
    },
  });
}

export function useToggleEmployeeStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("employees").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["employees"] }),
  });
}

export function useDeleteEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("delete_employee_cascade", { emp_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employees"] });
      qc.invalidateQueries({ queryKey: ["employee"] });
    },
  });
}
