import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

import { getDisplayWorkedMinutes, getDisplayOvertimeMinutes } from "@/lib/timesheet-display";

export type AttendanceLog = Tables<"attendance_logs"> & {
  employees?: {
    name: string;
    employee_code: string;
    skill_type: string;
    hourly_rate?: number;
    overtime_rate?: number;
    standard_hours_per_day?: number;
  } | null;
  projects?: { name: string } | null;
  live_cost?: number;
};

/**
 * Compute labor cost from any work stage (office/project/maintenance/site visit).
 * Uses stored regular+overtime cost when present, otherwise derives from
 * worked minutes × hourly_rate, with overtime portion at overtime_rate.
 */
export function computeLiveCost(log: any): number {
  const finalCost = Number(log.regular_cost ?? 0) + Number(log.overtime_cost ?? 0);
  if (finalCost > 0) return finalCost;

  const rate = Number(log.employees?.hourly_rate ?? 0);
  if (!rate) return 0;

  const stdHours = Number(log.employees?.standard_hours_per_day ?? 8);
  const otRate = Number(log.employees?.overtime_rate ?? 0) || rate * 1.5;

  const workedMin = getDisplayWorkedMinutes(log);
  if (workedMin <= 0) return 0;

  const otMin = getDisplayOvertimeMinutes(log, stdHours);
  const regMin = Math.max(0, workedMin - otMin);

  return (regMin / 60) * rate + (otMin / 60) * otRate;
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
        .select("*, employees(name, employee_code, skill_type, hourly_rate, overtime_rate, standard_hours_per_day), projects(name)")
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
      const onBreak = logs.filter((l) => l.break_start_time && !l.break_end_time).length;
      const completed = logs.filter((l) => l.office_punch_out).length;
      const totalOtMin = logs.reduce((s, l) => s + (l.overtime_minutes ?? 0), 0);
      const totalCost = logs.reduce((s, l) => s + computeLiveCost(l), 0);


      return { total: logs.length, punchedIn, onSite, working, onBreak, completed, totalOtMin, totalCost };
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
