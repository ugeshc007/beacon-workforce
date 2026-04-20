import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type AttendanceLog = Tables<"attendance_logs"> & {
  employees?: { name: string; employee_code: string; skill_type: string; hourly_rate?: number } | null;
  projects?: { name: string } | null;
  live_cost?: number;
};

/** Estimate live labor cost for an in-progress shift (work started but not ended). */
export function computeLiveCost(log: {
  work_start_time?: string | null;
  work_end_time?: string | null;
  break_start_time?: string | null;
  break_end_time?: string | null;
  break_minutes?: number | null;
  regular_cost?: number | null;
  overtime_cost?: number | null;
  employees?: { hourly_rate?: number } | null;
}): number {
  const finalCost = Number(log.regular_cost ?? 0) + Number(log.overtime_cost ?? 0);
  if (finalCost > 0) return finalCost;
  if (!log.work_start_time || log.work_end_time) return 0;
  const rate = Number(log.employees?.hourly_rate ?? 0);
  if (!rate) return 0;
  const start = new Date(log.work_start_time).getTime();
  const end = Date.now();
  let elapsedMin = Math.max(0, (end - start) / 60000);
  // subtract break time (completed or in-progress)
  if (log.break_start_time && log.break_end_time) {
    elapsedMin -= Math.max(0, (new Date(log.break_end_time).getTime() - new Date(log.break_start_time).getTime()) / 60000);
  } else if (log.break_start_time && !log.break_end_time) {
    elapsedMin -= Math.max(0, (end - new Date(log.break_start_time).getTime()) / 60000);
  } else if (log.break_minutes) {
    elapsedMin -= log.break_minutes;
  }
  return Math.max(0, (elapsedMin / 60) * rate);
}

export function useAttendanceLogs(filters: {
  date: string;
  search?: string;
  projectId?: string;
}) {
  return useQuery({
    queryKey: ["attendance-logs", filters],
    queryFn: async () => {
      let query = supabase
        .from("attendance_logs")
        .select("*, employees(name, employee_code, skill_type, hourly_rate), projects(name)")
        .eq("date", filters.date)
        .order("office_punch_in", { ascending: true, nullsFirst: false });

      if (filters.projectId && filters.projectId !== "all") {
        query = query.eq("project_id", filters.projectId);
      }

      const { data, error } = await query;
      if (error) throw error;

      let results = data as AttendanceLog[];

      if (filters.search) {
        const s = filters.search.toLowerCase();
        results = results.filter(
          (r) =>
            r.employees?.name?.toLowerCase().includes(s) ||
            r.employees?.employee_code?.toLowerCase().includes(s)
        );
      }

      return results;
    },
    refetchInterval: 30000,
  });
}

export function useAttendanceSummary(date: string) {
  return useQuery({
    queryKey: ["attendance-summary", date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_logs")
        .select("work_start_time, work_end_time, break_start_time, break_end_time, break_minutes, office_punch_in, travel_start_time, site_arrival_time, office_punch_out, overtime_minutes, regular_cost, overtime_cost, employees(hourly_rate)")
        .eq("date", date);

      if (error) throw error;
      const logs = (data ?? []) as any[];

      const punchedIn = logs.filter((l) => l.office_punch_in).length;
      const onSite = logs.filter((l) => l.site_arrival_time).length;
      const working = logs.filter((l) => l.work_start_time && !l.work_end_time).length;
      const completed = logs.filter((l) => l.office_punch_out).length;
      const totalOtMin = logs.reduce((s, l) => s + (l.overtime_minutes ?? 0), 0);
      const totalCost = logs.reduce((s, l) => s + computeLiveCost(l), 0);

      if (error) throw error;
      const logs = data ?? [];

      const punchedIn = logs.filter((l) => l.office_punch_in).length;
      const onSite = logs.filter((l) => l.site_arrival_time).length;
      const working = logs.filter((l) => l.work_start_time && !l.work_end_time).length;
      const completed = logs.filter((l) => l.office_punch_out).length;
      const totalOtMin = logs.reduce((s, l) => s + (l.overtime_minutes ?? 0), 0);
      const totalCost = logs.reduce((s, l) => s + Number(l.regular_cost ?? 0) + Number(l.overtime_cost ?? 0), 0);

      return { total: logs.length, punchedIn, onSite, working, completed, totalOtMin, totalCost };
    },
    refetchInterval: 30000,
  });
}

export function useOverrideAttendance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      id: string;
      office_punch_in?: string | null;
      travel_start_time?: string | null;
      site_arrival_time?: string | null;
      work_start_time?: string | null;
      work_end_time?: string | null;
      office_punch_out?: string | null;
      break_start_time?: string | null;
      break_end_time?: string | null;
      notes?: string | null;
      override_reason: string;
    }) => {
      const { id, override_reason, ...fields } = payload;
      const { error } = await supabase
        .from("attendance_logs")
        .update({
          ...fields,
          is_manual_override: true,
          override_reason,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance-logs"] });
      qc.invalidateQueries({ queryKey: ["attendance-summary"] });
    },
  });
}
