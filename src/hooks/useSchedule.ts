import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export interface ScheduleAssignment {
  id: string;
  project_id: string;
  employee_id: string;
  date: string;
  shift_start: string | null;
  shift_end: string | null;
  assignment_mode: string;
  is_locked: boolean;
  employee_name: string;
  employee_skill: string;
  project_name: string;
}

export interface ConflictInfo {
  employee_id: string;
  employee_name: string;
  date: string;
  projects: string[];
}

export function useWeekAssignments(weekStart: string, weekEnd: string, projectId?: string) {
  return useQuery({
    queryKey: ["schedule-assignments", weekStart, weekEnd, projectId],
    queryFn: async () => {
      let query = supabase
        .from("project_assignments")
        .select("id, project_id, employee_id, date, shift_start, shift_end, assignment_mode, is_locked, employees(name, skill_type), projects(name)")
        .gte("date", weekStart)
        .lte("date", weekEnd)
        .order("date");

      if (projectId && projectId !== "all") {
        query = query.eq("project_id", projectId);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data ?? []).map((a: any) => ({
        id: a.id,
        project_id: a.project_id,
        employee_id: a.employee_id,
        date: a.date,
        shift_start: a.shift_start,
        shift_end: a.shift_end,
        assignment_mode: a.assignment_mode,
        is_locked: a.is_locked,
        employee_name: a.employees?.name ?? "Unknown",
        employee_skill: a.employees?.skill_type ?? "helper",
        project_name: a.projects?.name ?? "Unknown",
      })) as ScheduleAssignment[];
    },
  });
}

export function useDetectConflicts(assignments: ScheduleAssignment[]): ConflictInfo[] {
  const map = new Map<string, { name: string; projects: Set<string> }>();
  for (const a of assignments) {
    const key = `${a.employee_id}::${a.date}`;
    if (!map.has(key)) map.set(key, { name: a.employee_name, projects: new Set() });
    map.get(key)!.projects.add(a.project_name);
  }
  const conflicts: ConflictInfo[] = [];
  for (const [key, val] of map) {
    if (val.projects.size > 1) {
      const [employee_id, date] = key.split("::");
      conflicts.push({ employee_id, employee_name: val.name, date, projects: [...val.projects] });
    }
  }
  return conflicts;
}

export function useAddAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      project_id: string;
      employee_id: string;
      date: string;
      shift_start?: string;
      shift_end?: string;
      assignment_mode?: "manual" | "auto" | "hybrid";
    }) => {
      const { data, error } = await supabase
        .from("project_assignments")
        .insert({
          project_id: payload.project_id,
          employee_id: payload.employee_id,
          date: payload.date,
          shift_start: payload.shift_start ?? null,
          shift_end: payload.shift_end ?? null,
          assignment_mode: payload.assignment_mode ?? "manual",
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["schedule-assignments"] }),
  });
}

export function useRemoveAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("project_assignments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["schedule-assignments"] }),
  });
}

export function useToggleLock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_locked }: { id: string; is_locked: boolean }) => {
      const { error } = await supabase.from("project_assignments").update({ is_locked }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["schedule-assignments"] }),
  });
}

export function useAvailableEmployees(date: string, projectId: string) {
  return useQuery({
    queryKey: ["available-employees", date, projectId],
    enabled: !!date && !!projectId,
    queryFn: async () => {
      // Get all active employees
      const { data: employees } = await supabase
        .from("employees")
        .select("id, name, skill_type")
        .eq("is_active", true)
        .order("name");

      // Get already-assigned employees for this date
      const { data: assigned } = await supabase
        .from("project_assignments")
        .select("employee_id")
        .eq("date", date);

      // Get employees on leave
      const { data: onLeave } = await supabase
        .from("employee_leave")
        .select("employee_id")
        .lte("start_date", date)
        .gte("end_date", date);

      const assignedIds = new Set((assigned ?? []).map((a) => a.employee_id));
      const leaveIds = new Set((onLeave ?? []).map((l) => l.employee_id));

      return (employees ?? []).map((e) => ({
        ...e,
        available: !assignedIds.has(e.id) && !leaveIds.has(e.id),
        on_leave: leaveIds.has(e.id),
        assigned_elsewhere: assignedIds.has(e.id) && !leaveIds.has(e.id),
      }));
    },
  });
}
