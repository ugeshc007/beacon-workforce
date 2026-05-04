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
 * Always derives live from worked minutes when punch-in exists, so it stays
 * consistent with the Timesheets/Daily view. Falls back to stored cost only
 * when no times are present.
 *
 * Pass org settings (standard_work_hours, overtime_multiplier) so all surfaces
 * agree on the same numbers.
 */
export function computeLiveCost(
  log: any,
  opts?: { stdHours?: number; otMult?: number },
): number {
  const rate = Number(log.employees?.hourly_rate ?? 0);
  const empStdHours = Number(log.employees?.standard_hours_per_day ?? 0);
  const stdHours = opts?.stdHours ?? (empStdHours > 0 ? empStdHours : 8);
  const otMult = opts?.otMult ?? 1.5;
  const otRate = Number(log.employees?.overtime_rate ?? 0) > 0
    ? Number(log.employees?.overtime_rate)
    : rate * otMult;

  const workedMin = getDisplayWorkedMinutes(log);
  if (workedMin > 0 && rate > 0) {
    const otMin = getDisplayOvertimeMinutes(log, stdHours);
    const regMin = Math.max(0, workedMin - otMin);
    return (regMin / 60) * rate + (otMin / 60) * otRate;
  }

  // No times yet — fall back to anything stored
  return Number(log.regular_cost ?? 0) + Number(log.overtime_cost ?? 0);
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
      const [logsRes, empsRes, settingsRes] = await Promise.all([
        supabase
          .from("attendance_logs")
          .select("employee_id, work_start_time, work_end_time, break_start_time, break_end_time, break_minutes, office_punch_in, travel_start_time, site_arrival_time, office_punch_out, overtime_minutes, regular_cost, overtime_cost, employees(hourly_rate)")
          .eq("date", date),
        supabase
          .from("employees")
          .select("id")
          .eq("is_active", true),
        supabase
          .from("settings")
          .select("key, value")
          .in("key", ["shift_start_time", "late_grace_minutes"]),
      ]);
      if (logsRes.error) throw logsRes.error;

      const logs = (logsRes.data ?? []) as any[];
      const activeCount = (empsRes.data ?? []).length;
      const settingsMap = new Map((settingsRes.data ?? []).map((s: any) => [s.key, s.value]));
      const shiftStart = (settingsMap.get("shift_start_time") as string) || "08:00";
      const graceMin = parseInt((settingsMap.get("late_grace_minutes") as string) || "10", 10);

      // Late cutoff in UAE local time
      const [sh, sm] = shiftStart.split(":").map(Number);
      const cutoffMinutes = (sh || 0) * 60 + (sm || 0) + (isNaN(graceMin) ? 10 : graceMin);
      const isLate = (ts: string | null) => {
        if (!ts) return false;
        const d = new Date(new Date(ts).getTime() + 4 * 60 * 60 * 1000); // shift to UAE
        return d.getUTCHours() * 60 + d.getUTCMinutes() > cutoffMinutes;
      };

      const punchedIn = logs.filter((l) => l.office_punch_in).length;
      const travelling = logs.filter((l) => l.travel_start_time && !l.site_arrival_time).length;
      const onSite = logs.filter((l) => l.site_arrival_time).length;
      const working = logs.filter((l) => l.work_start_time && !l.work_end_time).length;
      const onBreak = logs.filter((l) => l.break_start_time && !l.break_end_time).length;
      const completed = logs.filter((l) => l.office_punch_out).length;
      const late = logs.filter((l) => isLate(l.office_punch_in)).length;
      const punchedEmpIds = new Set(logs.filter((l) => l.office_punch_in).map((l) => l.employee_id));
      const absent = Math.max(0, activeCount - punchedEmpIds.size);
      const totalOtMin = logs.reduce((s, l) => s + (l.overtime_minutes ?? 0), 0);
      const totalCost = logs.reduce((s, l) => s + computeLiveCost(l), 0);

      return { total: logs.length, punchedIn, travelling, onSite, working, onBreak, completed, late, absent, totalOtMin, totalCost };
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
