import { toLocalDateStr } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DailyTeamMember {
  assignment_id: string;
  employee_id: string;
  employee_name: string;
  employee_code: string;
  skill_type: string;
  project_id: string;
  project_name: string;
  shift_start: string | null;
  shift_end: string | null;
  is_locked: boolean;
  // attendance
  attendance_id: string | null;
  punch_in: string | null;
  site_arrival: string | null;
  work_start: string | null;
  work_end: string | null;
  punch_out: string | null;
  is_manual_override: boolean;
  // override
  override_action: string | null;
  override_reason: string | null;
}

export interface DailyProjectGroup {
  project_id: string;
  project_name: string;
  client_name: string | null;
  site_address: string | null;
  notes: string | null;
  required_technicians: number;
  required_helpers: number;
  required_supervisors: number;
  members: DailyTeamMember[];
}

function todayUAE(): string {
  const now = new Date();
  const uae = new Date(now.getTime() + 4 * 60 * 60 * 1000);
  return toLocalDateStr(uae);
}

export function useDailyTeam(date?: string) {
  const d = date ?? todayUAE();
  return useQuery({
    queryKey: ["daily-team", d],
    queryFn: async () => {
      // 1. Assignments for the date
      const { data: assignments, error: aErr } = await supabase
        .from("project_assignments")
        .select("id, project_id, employee_id, shift_start, shift_end, is_locked, employees(name, employee_code, skill_type), projects(name, client_name, site_address, notes, required_technicians, required_helpers, required_supervisors)")
        .eq("date", d)
        .order("project_id");
      if (aErr) throw aErr;

      // 2. Attendance logs for the date
      const { data: logs } = await supabase
        .from("attendance_logs")
        .select("id, employee_id, office_punch_in, site_arrival_time, work_start_time, work_end_time, office_punch_out, is_manual_override")
        .eq("date", d);

      const logMap = new Map((logs ?? []).map((l) => [l.employee_id, l]));

      // 3. Overrides for the date
      const { data: overrides } = await supabase
        .from("daily_team_overrides")
        .select("employee_id, project_id, action, reason")
        .eq("date", d);

      const overrideMap = new Map((overrides ?? []).map((o) => [`${o.employee_id}::${o.project_id}`, o]));

      // Group by project
      const projectMap = new Map<string, DailyProjectGroup>();

      for (const a of assignments ?? []) {
        const proj = (a as any).projects;
        const emp = (a as any).employees;
        const log = logMap.get(a.employee_id);
        const ov = overrideMap.get(`${a.employee_id}::${a.project_id}`);

        if (!projectMap.has(a.project_id)) {
          projectMap.set(a.project_id, {
            project_id: a.project_id,
            project_name: proj?.name ?? "Unknown",
            client_name: proj?.client_name ?? null,
            site_address: proj?.site_address ?? null,
            notes: proj?.notes ?? null,
            required_technicians: proj?.required_technicians ?? 0,
            required_helpers: proj?.required_helpers ?? 0,
            required_supervisors: proj?.required_supervisors ?? 0,
            members: [],
          });
        }

        projectMap.get(a.project_id)!.members.push({
          assignment_id: a.id,
          employee_id: a.employee_id,
          employee_name: emp?.name ?? "Unknown",
          employee_code: emp?.employee_code ?? "",
          skill_type: emp?.skill_type ?? "helper",
          project_id: a.project_id,
          project_name: proj?.name ?? "Unknown",
          shift_start: a.shift_start,
          shift_end: a.shift_end,
          is_locked: a.is_locked,
          attendance_id: log?.id ?? null,
          punch_in: log?.office_punch_in ?? null,
          site_arrival: log?.site_arrival_time ?? null,
          work_start: log?.work_start_time ?? null,
          work_end: log?.work_end_time ?? null,
          punch_out: log?.office_punch_out ?? null,
          is_manual_override: log?.is_manual_override ?? false,
          override_action: ov?.action ?? null,
          override_reason: ov?.reason ?? null,
        });
      }

      return Array.from(projectMap.values());
    },
    refetchInterval: 30000,
  });
}

/** Manual mark-present: creates attendance_log with override flag */
export function useMarkPresent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { employee_id: string; project_id: string; date: string }) => {
      const now = new Date().toISOString();
      const { error } = await supabase.from("attendance_logs").insert({
        employee_id: payload.employee_id,
        project_id: payload.project_id,
        date: payload.date,
        office_punch_in: now,
        is_manual_override: true,
        override_reason: "Manually marked present by manager",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["daily-team"] });
      qc.invalidateQueries({ queryKey: ["attendance-logs"] });
      qc.invalidateQueries({ queryKey: ["attendance-summary"] });
    },
  });
}

/** Bulk mark present for all un-punched members of a project */
export function useBulkMarkPresent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { members: { employee_id: string; project_id: string }[]; date: string }) => {
      const now = new Date().toISOString();
      const rows = payload.members.map((m) => ({
        employee_id: m.employee_id,
        project_id: m.project_id,
        date: payload.date,
        office_punch_in: now,
        is_manual_override: true,
        override_reason: "Bulk marked present by manager",
      }));
      const { error } = await supabase.from("attendance_logs").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["daily-team"] });
      qc.invalidateQueries({ queryKey: ["attendance-logs"] });
      qc.invalidateQueries({ queryKey: ["attendance-summary"] });
    },
  });
}

/** Mark absent with override record */
export function useMarkAbsent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      employee_id: string;
      project_id: string;
      date: string;
      action: "absent" | "replaced" | "removed";
      reason?: string;
      replacement_employee_id?: string;
      apply_to?: string;
    }) => {
      const { error } = await supabase.from("daily_team_overrides").insert({
        employee_id: payload.employee_id,
        project_id: payload.project_id,
        date: payload.date,
        action: payload.action as any,
        reason: payload.reason ?? null,
        replacement_employee_id: payload.replacement_employee_id ?? null,
        apply_to: payload.apply_to ?? "today_only",
      });
      if (error) throw error;

      // If replacing, add assignment for replacement
      if (payload.action === "replaced" && payload.replacement_employee_id) {
        await supabase.from("project_assignments").insert({
          project_id: payload.project_id,
          employee_id: payload.replacement_employee_id,
          date: payload.date,
          assignment_mode: "manual" as const,
        });
      }

      // If removing from remaining schedule
      if (payload.apply_to === "remaining" && (payload.action === "removed" || payload.action === "absent")) {
        await supabase
          .from("project_assignments")
          .delete()
          .eq("employee_id", payload.employee_id)
          .eq("project_id", payload.project_id)
          .gte("date", payload.date);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["daily-team"] });
      qc.invalidateQueries({ queryKey: ["schedule-assignments"] });
    },
  });
}

/** Add extra staff for today */
export function useAddExtraStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { employee_id: string; project_id: string; date: string }) => {
      // Add assignment
      await supabase.from("project_assignments").insert({
        project_id: payload.project_id,
        employee_id: payload.employee_id,
        date: payload.date,
        assignment_mode: "manual" as const,
      });
      // Log override
      await supabase.from("daily_team_overrides").insert({
        employee_id: payload.employee_id,
        project_id: payload.project_id,
        date: payload.date,
        action: "added" as any,
        reason: "Extra staff added by manager",
        apply_to: "today_only",
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["daily-team"] });
      qc.invalidateQueries({ queryKey: ["schedule-assignments"] });
      qc.invalidateQueries({ queryKey: ["available-employees"] });
    },
  });
}

/** Remove employee */
export function useRemoveFromTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { assignment_id: string; employee_id: string; project_id: string; date: string; apply_to: string }) => {
      if (payload.apply_to === "remaining") {
        await supabase
          .from("project_assignments")
          .delete()
          .eq("employee_id", payload.employee_id)
          .eq("project_id", payload.project_id)
          .gte("date", payload.date);
      } else {
        await supabase.from("project_assignments").delete().eq("id", payload.assignment_id);
      }
      await supabase.from("daily_team_overrides").insert({
        employee_id: payload.employee_id,
        project_id: payload.project_id,
        date: payload.date,
        action: "removed" as any,
        reason: "Removed by manager",
        apply_to: payload.apply_to,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["daily-team"] });
      qc.invalidateQueries({ queryKey: ["schedule-assignments"] });
    },
  });
}
