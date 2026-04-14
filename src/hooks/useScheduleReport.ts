import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";

function allDates(start: string, end: string): string[] {
  const dates: string[] = [];
  const d = new Date(start + "T00:00:00");
  const last = new Date(end + "T00:00:00");
  while (d <= last) {
    dates.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

export interface ScheduleReportData {
  summary: {
    totalAssignments: number;
    uniqueEmployees: number;
    projectsCovered: number;
    avgTeamSize: number;
  };
  dailyOverview: {
    date: string;
    project: string;
    location: string;
    teamSize: number;
    tasksLogged: number;
  }[];
  employeeSummary: {
    name: string;
    code: string;
    daysScheduled: number;
    projectsWorked: number;
    totalHours: number;
  }[];
  projectCoverage: {
    project: string;
    daysActive: number;
    avgTeamSize: number;
    required: number;
    assigned: number;
    fillRate: number;
  }[];
  unscheduledDays: {
    date: string;
    project: string;
    required: number;
    assigned: number;
    gap: number;
  }[];
}

export function useScheduleReport(start: string, end: string) {
  const assignmentsQ = useQuery({
    queryKey: ["schedule-report-assignments", start, end],
    queryFn: async () => {
      const { data } = await supabase
        .from("project_assignments")
        .select("id, date, project_id, employee_id, shift_start, shift_end, employees(name, employee_code), projects(name, site_address, required_technicians, required_helpers, required_supervisors, required_drivers, required_team_members)")
        .gte("date", start)
        .lte("date", end)
        .order("date");
      return data ?? [];
    },
  });

  const logsQ = useQuery({
    queryKey: ["schedule-report-logs", start, end],
    queryFn: async () => {
      const { data } = await supabase
        .from("project_daily_logs")
        .select("id, date, project_id")
        .gte("date", start)
        .lte("date", end);
      return data ?? [];
    },
  });

  const data = useMemo<ScheduleReportData | null>(() => {
    if (!assignmentsQ.data) return null;
    const assignments = assignmentsQ.data as any[];
    const logs = logsQ.data ?? [];
    const dates = allDates(start, end);

    // Summary
    const uniqueEmpIds = new Set(assignments.map((a) => a.employee_id));
    const uniqueProjectIds = new Set(assignments.map((a) => a.project_id));
    const projectDateCounts: Record<string, Set<string>> = {};
    assignments.forEach((a) => {
      const k = a.project_id;
      if (!projectDateCounts[k]) projectDateCounts[k] = new Set();
      projectDateCounts[k].add(a.date);
    });
    const avgTeamSize = uniqueProjectIds.size > 0
      ? Math.round((assignments.length / (Object.values(projectDateCounts).reduce((s, v) => s + v.size, 0) || 1)) * 10) / 10
      : 0;

    // Daily overview
    const dailyMap = new Map<string, { project: string; location: string; teamSize: number; tasksLogged: number }>();
    assignments.forEach((a) => {
      const key = `${a.date}|${a.project_id}`;
      const existing = dailyMap.get(key);
      if (existing) {
        existing.teamSize += 1;
      } else {
        const logCount = logs.filter((l) => l.date === a.date && l.project_id === a.project_id).length;
        dailyMap.set(key, {
          project: a.projects?.name ?? "—",
          location: a.projects?.site_address ?? "—",
          teamSize: 1,
          tasksLogged: logCount,
        });
      }
    });
    const dailyOverview = Array.from(dailyMap.entries()).map(([key, val]) => ({
      date: key.split("|")[0],
      ...val,
    })).sort((a, b) => a.date.localeCompare(b.date));

    // Employee summary
    const empMap = new Map<string, { name: string; code: string; dates: Set<string>; projects: Set<string>; totalMinutes: number }>();
    assignments.forEach((a) => {
      const existing = empMap.get(a.employee_id);
      const shiftMinutes = calcShiftMinutes(a.shift_start, a.shift_end);
      if (existing) {
        existing.dates.add(a.date);
        existing.projects.add(a.project_id);
        existing.totalMinutes += shiftMinutes;
      } else {
        empMap.set(a.employee_id, {
          name: a.employees?.name ?? "—",
          code: a.employees?.employee_code ?? "—",
          dates: new Set([a.date]),
          projects: new Set([a.project_id]),
          totalMinutes: shiftMinutes,
        });
      }
    });
    const employeeSummary = Array.from(empMap.values())
      .map((e) => ({
        name: e.name,
        code: e.code,
        daysScheduled: e.dates.size,
        projectsWorked: e.projects.size,
        totalHours: Math.round((e.totalMinutes / 60) * 10) / 10,
      }))
      .sort((a, b) => b.daysScheduled - a.daysScheduled);

    // Project coverage
    const projectCoverage = Array.from(uniqueProjectIds).map((pid) => {
      const projAssignments = assignments.filter((a) => a.project_id === pid);
      const proj = projAssignments[0]?.projects;
      const datesActive = new Set(projAssignments.map((a) => a.date));
      const required = (proj?.required_technicians ?? 0) + (proj?.required_helpers ?? 0) + (proj?.required_supervisors ?? 0) + (proj?.required_drivers ?? 0) + (proj?.required_team_members ?? 0);
      const avgTeam = datesActive.size > 0 ? Math.round((projAssignments.length / datesActive.size) * 10) / 10 : 0;
      return {
        project: proj?.name ?? "—",
        daysActive: datesActive.size,
        avgTeamSize: avgTeam,
        required,
        assigned: avgTeam,
        fillRate: required > 0 ? Math.round((avgTeam / required) * 100) : 100,
      };
    }).sort((a, b) => a.fillRate - b.fillRate);

    // Unscheduled days
    const unscheduledDays: ScheduleReportData["unscheduledDays"] = [];
    dates.forEach((date) => {
      const dow = new Date(date + "T00:00:00").getDay();
      if (dow === 0 || dow === 6) return; // skip weekends
      uniqueProjectIds.forEach((pid) => {
        const dayCount = assignments.filter((a) => a.date === date && a.project_id === pid).length;
        const proj = assignments.find((a) => a.project_id === pid)?.projects;
        const required = (proj?.required_technicians ?? 0) + (proj?.required_helpers ?? 0) + (proj?.required_supervisors ?? 0) + (proj?.required_drivers ?? 0) + (proj?.required_team_members ?? 0);
        if (dayCount < required) {
          unscheduledDays.push({
            date,
            project: proj?.name ?? "—",
            required,
            assigned: dayCount,
            gap: required - dayCount,
          });
        }
      });
    });

    return {
      summary: {
        totalAssignments: assignments.length,
        uniqueEmployees: uniqueEmpIds.size,
        projectsCovered: uniqueProjectIds.size,
        avgTeamSize,
      },
      dailyOverview,
      employeeSummary,
      projectCoverage,
      unscheduledDays: unscheduledDays.sort((a, b) => a.date.localeCompare(b.date)),
    };
  }, [assignmentsQ.data, logsQ.data, start, end]);

  return { data, isLoading: assignmentsQ.isLoading || logsQ.isLoading };
}

function calcShiftMinutes(start?: string | null, end?: string | null): number {
  if (!start || !end) return 480; // default 8h
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return (eh * 60 + em) - (sh * 60 + sm);
}
