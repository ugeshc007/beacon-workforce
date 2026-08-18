import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

import { getDisplayWorkedMinutes, getDisplayOvertimeMinutes, groupAndAggregateLogs } from "@/lib/timesheet-display";

export type AttendanceSessionSummary = {
  id: string;
  project_id: string | null;
  project_name: string | null;
  travel_start_time: string | null;
  site_arrival_time: string | null;
  work_start_time: string | null;
  break_start_time: string | null;
  break_end_time: string | null;
  work_end_time: string | null;
  work_location?: "in_house" | "site" | null;
};

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
  work_location?: "in_house" | "site" | null;
  sessions?: AttendanceSessionSummary[];
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

      const { data, error } = await query;
      if (error) throw error;

      let results = data as AttendanceLog[];

      // Enrich logs with project sessions for this date (per-project start/end).
      // IMPORTANT: sessions are matched to a log by TIME WINDOW, not only by the
      // stored attendance_log_id. Offline sync can bind a session to the wrong
      // shift (e.g. a night-shift session attached to the morning log), which
      // used to merge two shifts into one timeline. Windowing keeps every shift
      // separate and self-healing.
      const logIds = results.map((r) => r.id);
      const employeeIdsForSessions = Array.from(new Set(results.map((r) => r.employee_id).filter(Boolean) as string[]));
      let sessionsByLog = new Map<string, AttendanceSessionSummary[]>();
      let sessionProjectIds: string[] = [];
      if (logIds.length > 0 && employeeIdsForSessions.length > 0) {
        const { data: pws } = await supabase
          .from("project_work_sessions")
          .select("id, attendance_log_id, employee_id, project_id, travel_start_time, site_arrival_time, work_start_time, break_start_time, break_end_time, work_end_time, projects(name)")
          .in("employee_id", employeeIdsForSessions)
          .eq("date", filters.date)
          .order("created_at", { ascending: true });

        // Build per-employee shift windows from the logs themselves.
        const windowsByEmp = new Map<string, { id: string; start: number; end: number }[]>();
        for (const r of results) {
          if (!r.employee_id || !r.office_punch_in) continue;
          const start = new Date(r.office_punch_in).getTime();
          const end = r.office_punch_out
            ? new Date(r.office_punch_out).getTime()
            : start + 12 * 60 * 60 * 1000;
          const arr = windowsByEmp.get(r.employee_id) ?? [];
          arr.push({ id: r.id, start, end });
          windowsByEmp.set(r.employee_id, arr);
        }
        for (const arr of windowsByEmp.values()) arr.sort((a, b) => a.start - b.start);

        const ts = (v: string | null) => (v ? new Date(v).getTime() : null);

        for (const s of (pws ?? []) as any[]) {
          const summary: AttendanceSessionSummary = {
            id: s.id,
            project_id: s.project_id,
            project_name: s.projects?.name ?? null,
            travel_start_time: s.travel_start_time,
            site_arrival_time: s.site_arrival_time,
            work_start_time: s.work_start_time,
            break_start_time: s.break_start_time,
            break_end_time: s.break_end_time,
            work_end_time: s.work_end_time,
          };
          if (s.project_id) sessionProjectIds.push(s.project_id);

          const sessionStart =
            ts(s.travel_start_time) ??
            ts(s.site_arrival_time) ??
            ts(s.work_start_time) ??
            ts(s.break_start_time) ??
            ts(s.work_end_time);

          const windows = windowsByEmp.get(s.employee_id) ?? [];
          let targetLogId: string | null = null;
          if (sessionStart != null && windows.length > 0) {
            // Prefer the shift whose window contains the session start.
            const containing = windows.filter((w) => sessionStart >= w.start && sessionStart <= w.end);
            if (containing.length > 0) {
              targetLogId = containing[containing.length - 1].id;
            } else {
              // Otherwise the latest shift that started before the session.
              const before = windows.filter((w) => w.start <= sessionStart);
              if (before.length > 0) targetLogId = before[before.length - 1].id;
            }
          }
          // Last resort: honour the stored binding when it points at a visible log.
          if (!targetLogId && s.attendance_log_id && logIds.includes(s.attendance_log_id)) {
            targetLogId = s.attendance_log_id;
          }
          if (!targetLogId) continue;

          const list = sessionsByLog.get(targetLogId) ?? [];
          list.push(summary);
          sessionsByLog.set(targetLogId, list);
        }
      }


      // Enrich each log with the day's work_location (in_house vs site) for its project
      const projectIds = Array.from(new Set([
        ...results.map((r) => r.project_id).filter(Boolean) as string[],
        ...sessionProjectIds,
      ]));
      let locMap = new Map<string, "in_house" | "site">();
      let assignmentLocMap = new Map<string, "in_house" | "site">();
      const assignmentTaskMap = new Map<string, string>();
      if (projectIds.length > 0) {
        const { data: locs } = await supabase
          .from("project_day_work_locations")
          .select("project_id, location")
          .eq("date", filters.date)
          .in("project_id", projectIds);
        locMap = new Map((locs ?? []).map((l: any) => [l.project_id, l.location]));

        // Per-assignment location is employee-specific, so key by employee+project.
        // A project-level day override remains the fallback for older/global schedules.
        const employeeIds = Array.from(new Set(results.map((r) => r.employee_id).filter(Boolean) as string[]));
        if (employeeIds.length > 0) {
          const { data: assigns } = await supabase
            .from("project_assignments")
            .select("employee_id, project_id, work_location, task")
            .eq("date", filters.date)
            .in("project_id", projectIds)
            .in("employee_id", employeeIds);
          for (const a of assigns ?? []) {
            if (a.work_location) {
              assignmentLocMap.set(`${a.employee_id}:${a.project_id}`, a.work_location as "in_house" | "site");
            }
            const task = (a as any).task as string | null;
            if (task && task.trim()) {
              assignmentTaskMap.set(`${a.employee_id}:${a.project_id}`, task.trim());
            }
          }
        }
      }


      results = results.map((r) => {
        const sessions = (sessionsByLog.get(r.id) ?? []).map((s) => ({
          ...s,
          work_location: s.project_id
            ? (assignmentLocMap.get(`${r.employee_id}:${s.project_id}`) ?? locMap.get(s.project_id) ?? null)
            : null,
          task: s.project_id ? (assignmentTaskMap.get(`${r.employee_id}:${s.project_id}`) ?? null) : null,
        }));
        const sessionLocations = sessions
          .map((s) => s.work_location)
          .filter((loc): loc is "in_house" | "site" => loc === "in_house" || loc === "site");
        const sessionResolvedLocation: "in_house" | "site" | null = sessionLocations.includes("site")
          ? "site"
          : sessionLocations.length > 0
          ? "in_house"
          : null;

        // Did the schedule give this employee a named task today?
        const hasTask =
          sessions.some((s) => !!s.task) ||
          (!!r.project_id && !!assignmentTaskMap.get(`${r.employee_id}:${r.project_id}`));

        return {
          ...r,
          // Per-project sessions are the source of truth on multi-shift days.
          // attendance_logs.project_id is only a daily/open-punch hint and can
          // point at a different shift when the employee has multiple projects.
          work_location: sessionResolvedLocation ?? (r.project_id
            ? (assignmentLocMap.get(`${r.employee_id}:${r.project_id}`) ?? locMap.get(r.project_id) ?? null)
            : null),
          has_task: hasTask,
          sessions,
        };
      });

      if (filters.projectId && filters.projectId !== "all") {
        results = results.filter((r) =>
          r.project_id === filters.projectId ||
          r.sessions?.some((s) => s.project_id === filters.projectId)
        );
      }

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
          .select("date, employee_id, work_start_time, work_end_time, break_start_time, break_end_time, break_minutes, office_punch_in, office_punch_out, office_arrival_time, travel_start_time, site_arrival_time, return_travel_start_time, total_work_minutes, overtime_minutes, regular_cost, overtime_cost, employees(hourly_rate, overtime_rate, standard_hours_per_day)")
          .eq("date", date),
        supabase
          .from("employees")
          .select("id")
          .eq("is_active", true),
        supabase
          .from("settings")
          .select("key, value")
          .in("key", ["shift_start_time", "late_grace_minutes", "standard_work_hours", "overtime_multiplier"]),
      ]);
      if (logsRes.error) throw logsRes.error;

      const logs = (logsRes.data ?? []) as any[];
      const activeCount = (empsRes.data ?? []).length;
      const settingsMap = new Map((settingsRes.data ?? []).map((s: any) => [s.key, s.value]));
      const shiftStart = (settingsMap.get("shift_start_time") as string) || "08:00";
      const graceMin = parseInt((settingsMap.get("late_grace_minutes") as string) || "10", 10);
      const stdHours = parseFloat((settingsMap.get("standard_work_hours") as string) ?? "8") || 8;
      const otMult = parseFloat((settingsMap.get("overtime_multiplier") as string) ?? "1.5") || 1.5;

      // Late cutoff in UAE local time
      const [sh, sm] = shiftStart.split(":").map(Number);
      const cutoffMinutes = (sh || 0) * 60 + (sm || 0) + (isNaN(graceMin) ? 10 : graceMin);
      const isLate = (ts: string | null) => {
        if (!ts) return false;
        const d = new Date(new Date(ts).getTime() + 4 * 60 * 60 * 1000); // shift to UAE
        return d.getUTCHours() * 60 + d.getUTCMinutes() > cutoffMinutes;
      };

      // Status counts: dedupe by employee_id (an employee with 2 shifts counts once)
      const setOf = (pred: (l: any) => boolean) =>
        new Set(logs.filter(pred).map((l) => l.employee_id)).size;

      const punchedIn = setOf((l) => !!l.office_punch_in);
      const travelling = setOf((l) => l.travel_start_time && !l.site_arrival_time);
      const onSite = setOf((l) => !!l.site_arrival_time);
      const working = setOf((l) => l.work_start_time && !l.work_end_time);
      const onBreak = setOf((l) => l.break_start_time && !l.break_end_time);
      // Completed = employees who punched in AND have no open shift remaining
      const openIds = new Set(logs.filter((l) => l.office_punch_in && !l.office_punch_out).map((l) => l.employee_id));
      const punchedSet = new Set(logs.filter((l) => l.office_punch_in).map((l) => l.employee_id));
      const completed = [...punchedSet].filter((id) => !openIds.has(id)).length;
      const late = setOf((l) => isLate(l.office_punch_in));
      const punchedEmpIds = new Set(logs.filter((l) => l.office_punch_in).map((l) => l.employee_id));
      const absent = Math.max(0, activeCount - punchedEmpIds.size);

      // Combined daily totals: group shifts by (employee, date)
      const grouped = groupAndAggregateLogs(logs as any[], stdHours);
      let totalOtMin = 0;
      let totalCost = 0;
      for (const [, agg] of grouped) {
        totalOtMin += agg.otMin;
        const emp = (agg.logs[0] as any).employees;
        const rate = Number(emp?.hourly_rate ?? 0);
        const otRate = Number(emp?.overtime_rate ?? 0) > 0
          ? Number(emp?.overtime_rate)
          : rate * otMult;
        totalCost += (agg.regularMin / 60) * rate + (agg.otMin / 60) * otRate;
      }

      return { total: punchedEmpIds.size, punchedIn, travelling, onSite, working, onBreak, completed, late, absent, totalOtMin, totalCost };
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
