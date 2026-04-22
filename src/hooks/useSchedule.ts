import { toLocalDateStr } from "@/lib/utils";
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
  assigned_role: string;
  employee_name: string;
  employee_skill: string;
  project_name: string;
}

export interface MaintenanceScheduleItem {
  id: string;
  maintenance_call_id: string;
  employee_id: string;
  date: string;
  shift_start: string | null;
  shift_end: string | null;
  employee_name: string;
  employee_skill: string;
  company_name: string;
  location: string | null;
  priority: string;
  scope: string | null;
}

export interface SiteVisitScheduleItem {
  id: string;
  date: string;
  client_name: string;
  site_address: string | null;
  project_type: string | null;
  priority: string;
  status: string;
  employee_id: string;
  employee_name: string;
  employee_skill: string;
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
        .select("id, project_id, employee_id, date, shift_start, shift_end, assignment_mode, is_locked, assigned_role, employees(name, skill_type), projects(name)")
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
        assigned_role: a.assigned_role ?? a.employees?.skill_type ?? "team_member",
        employee_name: a.employees?.name ?? "Unknown",
        employee_skill: a.employees?.skill_type ?? "helper",
        project_name: a.projects?.name ?? "Unknown",
      })) as ScheduleAssignment[];
    },
  });
}

export function useWeekMaintenanceAssignments(weekStart: string, weekEnd: string) {
  return useQuery({
    queryKey: ["schedule-maintenance-assignments", weekStart, weekEnd],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maintenance_assignments")
        .select("id, maintenance_call_id, employee_id, date, shift_start, shift_end, employees(name, skill_type), maintenance_calls(company_name, location, priority, scope)")
        .gte("date", weekStart)
        .lte("date", weekEnd)
        .order("date");

      if (error) throw error;

      return (data ?? []).map((a: any) => ({
        id: a.id,
        maintenance_call_id: a.maintenance_call_id,
        employee_id: a.employee_id,
        date: a.date,
        shift_start: a.shift_start,
        shift_end: a.shift_end,
        employee_name: a.employees?.name ?? "Unknown",
        employee_skill: a.employees?.skill_type ?? "helper",
        company_name: a.maintenance_calls?.company_name ?? "Unknown",
        location: a.maintenance_calls?.location ?? null,
        priority: a.maintenance_calls?.priority ?? "normal",
        scope: a.maintenance_calls?.scope ?? null,
      })) as MaintenanceScheduleItem[];
    },
  });
}

export function useWeekSiteVisits(weekStart: string, weekEnd: string) {
  return useQuery({
    queryKey: ["schedule-site-visits", weekStart, weekEnd],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_visits")
        .select("id, visit_date, client_name, site_address, project_type, priority, status, assigned_employee_id, employees!site_visits_assigned_employee_id_fkey(name, skill_type)")
        .gte("visit_date", weekStart)
        .lte("visit_date", weekEnd)
        .not("assigned_employee_id", "is", null)
        .order("visit_date");

      if (error) throw error;

      return (data ?? []).map((v: any) => ({
        id: v.id,
        date: v.visit_date,
        client_name: v.client_name,
        site_address: v.site_address,
        project_type: v.project_type,
        priority: v.priority,
        status: v.status,
        employee_id: v.assigned_employee_id,
        employee_name: v.employees?.name ?? "Unknown",
        employee_skill: v.employees?.skill_type ?? "helper",
      })) as SiteVisitScheduleItem[];
    },
  });
}

/** Check if two time ranges overlap. If either has no times set, assume full-day overlap. */
function timesOverlap(
  s1: string | null, e1: string | null,
  s2: string | null, e2: string | null,
): boolean {
  // If either assignment has no shift times, treat as full-day → always overlaps
  if (!s1 || !e1 || !s2 || !e2) return true;
  // Times are "HH:MM" or "HH:MM:SS" strings — lexicographic comparison works
  return s1 < e2 && s2 < e1;
}

export function useDetectConflicts(assignments: ScheduleAssignment[]): ConflictInfo[] {
  // Group assignments by employee+date
  const map = new Map<string, { name: string; entries: { project: string; start: string | null; end: string | null }[] }>();
  for (const a of assignments) {
    const key = `${a.employee_id}::${a.date}`;
    if (!map.has(key)) map.set(key, { name: a.employee_name, entries: [] });
    map.get(key)!.entries.push({ project: a.project_name, start: a.shift_start, end: a.shift_end });
  }

  const conflicts: ConflictInfo[] = [];
  for (const [key, val] of map) {
    const { entries } = val;
    if (entries.length < 2) continue;

    // Check pairwise for actual time overlaps
    const overlappingProjects = new Set<string>();
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        if (entries[i].project !== entries[j].project &&
            timesOverlap(entries[i].start, entries[i].end, entries[j].start, entries[j].end)) {
          overlappingProjects.add(entries[i].project);
          overlappingProjects.add(entries[j].project);
        }
      }
    }

    if (overlappingProjects.size > 1) {
      const [employee_id, date] = key.split("::");
      conflicts.push({ employee_id, employee_name: val.name, date, projects: [...overlappingProjects] });
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
      assigned_role?: string;
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
          assigned_role: payload.assigned_role ?? "team_member",
        })
        .select()
        .single();
      if (error) throw error;
      // Notify employee via mobile notification
      try {
        await supabase.functions.invoke("notify-assignment", {
          body: {
            employee_id: payload.employee_id,
            project_id: payload.project_id,
            date: payload.date,
            shift_start: payload.shift_start,
            shift_end: payload.shift_end,
          },
        });
      } catch {}
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

export function useUpdateAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, shift_start, shift_end }: { id: string; shift_start?: string; shift_end?: string }) => {
      const updates: { shift_start?: string; shift_end?: string } = {};
      if (shift_start !== undefined) updates.shift_start = shift_start;
      if (shift_end !== undefined) updates.shift_end = shift_end;
      const { error } = await supabase.from("project_assignments").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["schedule-assignments"] }),
  });
}

export function useReassignEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ oldAssignmentId, newProjectId, employeeId, date, shiftStart, shiftEnd, keepOld, oldShiftEnd }: {
      oldAssignmentId: string;
      newProjectId: string;
      employeeId: string;
      date: string;
      shiftStart: string;
      shiftEnd: string;
      keepOld: boolean;
      oldShiftEnd?: string;
    }) => {
      if (keepOld && oldShiftEnd) {
        const { error } = await supabase.from("project_assignments").update({ shift_end: oldShiftEnd }).eq("id", oldAssignmentId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("project_assignments").delete().eq("id", oldAssignmentId);
        if (error) throw error;
      }
      const { error: insertErr } = await supabase.from("project_assignments").insert({
        project_id: newProjectId,
        employee_id: employeeId,
        date,
        shift_start: shiftStart,
        shift_end: shiftEnd,
        assignment_mode: "manual" as const,
      });
      if (insertErr) throw insertErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["schedule-assignments"] });
      qc.invalidateQueries({ queryKey: ["available-employees"] });
    },
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

/** Copy all assignments from previous week to current week */
export function useCopyPreviousWeek() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ sourceStart, sourceEnd, targetStart, projectId }: {
      sourceStart: string; sourceEnd: string; targetStart: string; projectId?: string;
    }) => {
      let query = supabase
        .from("project_assignments")
        .select("project_id, employee_id, shift_start, shift_end")
        .gte("date", sourceStart)
        .lte("date", sourceEnd);

      if (projectId && projectId !== "all") {
        query = query.eq("project_id", projectId);
      }

      const { data: source, error } = await query;
      if (error) throw error;
      if (!source?.length) throw new Error("No assignments found in source week");

      // Map day-of-week offset
      const srcMon = new Date(sourceStart + "T00:00:00");
      const tgtMon = new Date(targetStart + "T00:00:00");

      // Re-fetch with date to compute offset
      let query2 = supabase
        .from("project_assignments")
        .select("project_id, employee_id, date, shift_start, shift_end")
        .gte("date", sourceStart)
        .lte("date", sourceEnd);
      if (projectId && projectId !== "all") query2 = query2.eq("project_id", projectId);

      const { data: sourceWithDates } = await query2;

      const rows = (sourceWithDates ?? []).map((a) => {
        const srcDate = new Date(a.date + "T00:00:00");
        const dayOffset = Math.round((srcDate.getTime() - srcMon.getTime()) / 86400000);
        const tgtDate = new Date(tgtMon);
        tgtDate.setDate(tgtDate.getDate() + dayOffset);
        return {
          project_id: a.project_id,
          employee_id: a.employee_id,
          date: toLocalDateStr(tgtDate),
          shift_start: a.shift_start,
          shift_end: a.shift_end,
          assignment_mode: "manual" as const,
        };
      });

      if (!rows.length) throw new Error("No assignments to copy");

      const { error: insertErr } = await supabase.from("project_assignments").insert(rows);
      if (insertErr) throw insertErr;
      return rows.length;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["schedule-assignments"] }),
  });
}

/** Apply a day's assignments to a date range */
export function useApplyToDateRange() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ sourceDate, startDate, endDate, projectId, skipWeekends }: {
      sourceDate: string; startDate: string; endDate: string; projectId?: string; skipWeekends?: boolean;
    }) => {
      let query = supabase
        .from("project_assignments")
        .select("project_id, employee_id, shift_start, shift_end")
        .eq("date", sourceDate);
      if (projectId && projectId !== "all") query = query.eq("project_id", projectId);

      const { data: source, error } = await query;
      if (error) throw error;
      if (!source?.length) throw new Error("No assignments on source date");

      const rows: any[] = [];
      const start = new Date(startDate + "T00:00:00");
      const end = new Date(endDate + "T00:00:00");

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        if (dateStr === sourceDate) continue;
        const dow = d.getDay();
        if (skipWeekends && (dow === 0 || dow === 6)) continue;

        for (const a of source) {
          rows.push({
            project_id: a.project_id,
            employee_id: a.employee_id,
            date: dateStr,
            shift_start: a.shift_start,
            shift_end: a.shift_end,
            assignment_mode: "manual" as const,
          });
        }
      }

      if (!rows.length) throw new Error("No dates to apply to");
      const { error: insertErr } = await supabase.from("project_assignments").insert(rows);
      if (insertErr) throw insertErr;
      return rows.length;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["schedule-assignments"] }),
  });
}

/** Create recurring weekly schedule for N weeks */
export function useRecurringSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ sourceStart, sourceEnd, weeks, projectId }: {
      sourceStart: string; sourceEnd: string; weeks: number; projectId?: string;
    }) => {
      let query = supabase
        .from("project_assignments")
        .select("project_id, employee_id, date, shift_start, shift_end")
        .gte("date", sourceStart)
        .lte("date", sourceEnd);
      if (projectId && projectId !== "all") query = query.eq("project_id", projectId);

      const { data: source, error } = await query;
      if (error) throw error;
      if (!source?.length) throw new Error("No assignments in source week");

      const srcMon = new Date(sourceStart + "T00:00:00");
      const rows: any[] = [];

      for (let w = 1; w <= weeks; w++) {
        for (const a of source) {
          const srcDate = new Date(a.date + "T00:00:00");
          const dayOffset = Math.round((srcDate.getTime() - srcMon.getTime()) / 86400000);
          const tgtDate = new Date(srcMon);
          tgtDate.setDate(tgtDate.getDate() + dayOffset + w * 7);
          rows.push({
            project_id: a.project_id,
            employee_id: a.employee_id,
            date: toLocalDateStr(tgtDate),
            shift_start: a.shift_start,
            shift_end: a.shift_end,
            assignment_mode: "manual" as const,
          });
        }
      }

      if (!rows.length) throw new Error("No assignments to create");
      const { error: insertErr } = await supabase.from("project_assignments").insert(rows);
      if (insertErr) throw insertErr;
      return { assignments: rows.length, weeks };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["schedule-assignments"] }),
  });
}

export function useAvailableEmployees(date: string, projectId: string) {
  return useQuery({
    queryKey: ["available-employees", date, projectId],
    enabled: !!date && !!projectId,
    queryFn: async () => {
      const { data: employees } = await supabase
        .from("employees")
        .select("id, name, skill_type, secondary_skills")
        .eq("is_active", true)
        .order("name");

      const { data: assignedToProject } = await supabase
        .from("project_assignments")
        .select("employee_id")
        .eq("date", date)
        .eq("project_id", projectId);

      // Get all assignments for this date with time slots
      const { data: allAssignments } = await supabase
        .from("project_assignments")
        .select("employee_id, shift_start, shift_end, projects(name)")
        .eq("date", date)
        .neq("project_id", projectId);

      // Also check maintenance assignments for this date
      const { data: maintenanceAssignments } = await supabase
        .from("maintenance_assignments")
        .select("employee_id, shift_start, shift_end, maintenance_calls(company_name)")
        .eq("date", date);

      const { data: onLeave } = await supabase
        .from("employee_leave")
        .select("employee_id")
        .lte("start_date", date)
        .gte("end_date", date);

      const assignedToProjectIds = new Set((assignedToProject ?? []).map((a) => a.employee_id));
      const leaveIds = new Set((onLeave ?? []).map((l) => l.employee_id));

      // Build time slots map per employee
      const timeSlotsMap = new Map<string, { start: string; end: string; project: string }[]>();
      for (const a of allAssignments ?? []) {
        if (!timeSlotsMap.has(a.employee_id)) timeSlotsMap.set(a.employee_id, []);
        timeSlotsMap.get(a.employee_id)!.push({
          start: a.shift_start?.slice(0, 5) ?? "08:00",
          end: a.shift_end?.slice(0, 5) ?? "17:00",
          project: (a.projects as any)?.name ?? "Other",
        });
      }
      // Add maintenance slots
      for (const a of maintenanceAssignments ?? []) {
        if (!timeSlotsMap.has(a.employee_id)) timeSlotsMap.set(a.employee_id, []);
        timeSlotsMap.get(a.employee_id)!.push({
          start: a.shift_start?.slice(0, 5) ?? "08:00",
          end: a.shift_end?.slice(0, 5) ?? "17:00",
          project: `🔧 ${(a.maintenance_calls as any)?.company_name ?? "Maintenance"}`,
        });
      }

      return (employees ?? []).map((e) => ({
        ...e,
        available: !assignedToProjectIds.has(e.id) && !leaveIds.has(e.id) && !timeSlotsMap.has(e.id),
        on_leave: leaveIds.has(e.id),
        assigned_elsewhere: timeSlotsMap.has(e.id) && !leaveIds.has(e.id),
        existing_slots: timeSlotsMap.get(e.id) ?? [],
      }));
    },
  });
}
