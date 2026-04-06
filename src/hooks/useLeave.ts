import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface EmployeeLeave {
  id: string;
  employee_id: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  approved_by: string | null;
  created_at: string;
}

export function useEmployeeLeave(employeeId: string | null) {
  return useQuery({
    queryKey: ["employee-leave", employeeId],
    enabled: !!employeeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_leave")
        .select("*")
        .eq("employee_id", employeeId!)
        .order("start_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as EmployeeLeave[];
    },
  });
}

export function useCreateLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (leave: {
      employee_id: string;
      start_date: string;
      end_date: string;
      reason?: string;
    }) => {
      const { data, error } = await supabase
        .from("employee_leave")
        .insert({
          employee_id: leave.employee_id,
          start_date: leave.start_date,
          end_date: leave.end_date,
          reason: leave.reason || null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["employee-leave", vars.employee_id] });
      qc.invalidateQueries({ queryKey: ["employee-leave"] });
    },
  });
}

export function useDeleteLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, employeeId }: { id: string; employeeId: string }) => {
      const { error } = await supabase.from("employee_leave").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["employee-leave", vars.employeeId] });
    },
  });
}

export function useEmployeeProjectHistory(employeeId: string | null) {
  return useQuery({
    queryKey: ["employee-project-history", employeeId],
    enabled: !!employeeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_assignments")
        .select("id, date, project_id, projects(name)")
        .eq("employee_id", employeeId!)
        .order("date", { ascending: false })
        .limit(50);
      if (error) throw error;

      // Deduplicate by project_id, keep latest date
      const projectMap = new Map<string, { projectId: string; projectName: string; lastDate: string; count: number }>();
      for (const a of data ?? []) {
        const proj = a.projects as any;
        const name = proj?.name ?? "Unknown";
        const existing = projectMap.get(a.project_id);
        if (existing) {
          existing.count++;
          if (a.date > existing.lastDate) existing.lastDate = a.date;
        } else {
          projectMap.set(a.project_id, { projectId: a.project_id, projectName: name, lastDate: a.date, count: 1 });
        }
      }
      return Array.from(projectMap.values()).sort((a, b) => b.lastDate.localeCompare(a.lastDate));
    },
  });
}
