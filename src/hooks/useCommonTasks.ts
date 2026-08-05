import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type CommonTaskStatus = "in_progress" | "completed";

export interface CommonTaskSession {
  id: string;
  common_task_id: string;
  employee_id: string;
  attendance_log_id: string | null;
  date: string;
  work_start_time: string | null;
  break_start_time: string | null;
  break_end_time: string | null;
  work_end_time: string | null;
  break_minutes: number | null;
  total_work_minutes: number | null;
  overtime_minutes: number | null;
  status: string;
  notes: string | null;
  employees?: { name: string; employee_code: string } | null;
}

export interface CommonTask {
  id: string;
  company_id: string;
  branch_id: string | null;
  title: string;
  description: string | null;
  priority: string;
  max_headcount: number;
  status: CommonTaskStatus;
  is_seeded: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  common_task_sessions?: CommonTaskSession[];
}

/** Dubai-local calendar date (YYYY-MM-DD) */
export function uaeToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai" }).format(new Date());
}

const SESSION_SELECT =
  "*, common_task_sessions(id, common_task_id, employee_id, attendance_log_id, date, work_start_time, break_start_time, break_end_time, work_end_time, break_minutes, total_work_minutes, overtime_minutes, status, notes, employees(name, employee_code))";

/** Admin list — all common tasks with their logged sessions. */
export function useCommonTasks(filters: { search?: string; status?: string } = {}) {
  return useQuery({
    queryKey: ["common-tasks", filters],
    queryFn: async () => {
      let query = supabase
        .from("common_tasks")
        .select(SESSION_SELECT)
        .order("created_at", { ascending: false });

      if (filters.status && filters.status !== "all") {
        query = query.eq("status", filters.status as CommonTaskStatus);
      }

      const { data, error } = await query;
      if (error) throw error;

      let rows = (data ?? []) as unknown as CommonTask[];
      if (filters.search) {
        const s = filters.search.toLowerCase();
        rows = rows.filter(
          (t) =>
            t.title.toLowerCase().includes(s) ||
            (t.description ?? "").toLowerCase().includes(s)
        );
      }
      return rows;
    },
  });
}

export function useCreateCommonTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      title: string;
      description?: string | null;
      priority: string;
      max_headcount: number;
      branch_id?: string | null;
    }) => {
      const { data: me } = await supabase.rpc("get_user_company_id");
      const { data: userId } = await supabase.rpc("get_user_id");
      const { error } = await supabase.from("common_tasks").insert({
        title: payload.title,
        description: payload.description || null,
        priority: payload.priority,
        max_headcount: payload.max_headcount,
        branch_id: payload.branch_id || null,
        company_id: me as string,
        created_by: (userId as string) ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["common-tasks"] }),
  });
}

export function useUpdateCommonTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CommonTask> & { id: string }) => {
      const { error } = await supabase
        .from("common_tasks")
        .update(updates as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["common-tasks"] });
      qc.invalidateQueries({ queryKey: ["available-common-tasks"] });
    },
  });
}

export function useDeleteCommonTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("common_tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["common-tasks"] }),
  });
}

// ── Mobile side ──

export interface AvailableCommonTask extends CommonTask {
  activeCount: number;
  isFull: boolean;
  mySession: CommonTaskSession | null;
}

/** In-progress tasks an employee can pick up today, with live headcount. */
export function useAvailableCommonTasks(employeeId: string | undefined) {
  return useQuery({
    queryKey: ["available-common-tasks", employeeId],
    enabled: !!employeeId,
    queryFn: async () => {
      const today = uaeToday();
      const { data, error } = await supabase
        .from("common_tasks")
        .select(SESSION_SELECT)
        .eq("status", "in_progress")
        .order("title");
      if (error) throw error;

      return ((data ?? []) as unknown as CommonTask[]).map((t) => {
        const todays = (t.common_task_sessions ?? []).filter((s) => s.date === today);
        const activeCount = todays.filter((s) => !s.work_end_time).length;
        const mySession =
          todays.find((s) => s.employee_id === employeeId && !s.work_end_time) ?? null;
        return {
          ...t,
          activeCount,
          isFull: !mySession && activeCount >= t.max_headcount,
          mySession,
        } as AvailableCommonTask;
      });
    },
  });
}

/** The employee's currently open common-task session (if any). */
export function useMyCommonTaskSession(employeeId: string | undefined) {
  return useQuery({
    queryKey: ["my-common-task-session", employeeId],
    enabled: !!employeeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("common_task_sessions")
        .select("*, common_tasks(title)")
        .eq("employee_id", employeeId!)
        .eq("date", uaeToday())
        .is("work_end_time", null)
        .order("created_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      return (data?.[0] ?? null) as unknown as
        | (CommonTaskSession & { common_tasks?: { title: string } | null })
        | null;
    },
  });
}

function invalidateSessions(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["available-common-tasks"] });
  qc.invalidateQueries({ queryKey: ["my-common-task-session"] });
  qc.invalidateQueries({ queryKey: ["common-tasks"] });
}

export function useStartCommonTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      taskId,
      employeeId,
      attendanceLogId,
    }: {
      taskId: string;
      employeeId: string;
      attendanceLogId?: string | null;
    }) => {
      const today = uaeToday();

      // Headcount guard — re-check live so two phones can't both take the last slot.
      const { data: task, error: taskErr } = await supabase
        .from("common_tasks")
        .select("max_headcount, status")
        .eq("id", taskId)
        .single();
      if (taskErr) throw taskErr;
      if (task.status !== "in_progress") throw new Error("This task is already completed.");

      const { data: open, error: openErr } = await supabase
        .from("common_task_sessions")
        .select("id, employee_id")
        .eq("common_task_id", taskId)
        .eq("date", today)
        .is("work_end_time", null);
      if (openErr) throw openErr;

      const mine = (open ?? []).find((s) => s.employee_id === employeeId);
      if (mine) return mine.id;
      if ((open ?? []).length >= task.max_headcount) {
        throw new Error("This task is already at full headcount today.");
      }

      const { data, error } = await supabase
        .from("common_task_sessions")
        .insert({
          common_task_id: taskId,
          employee_id: employeeId,
          attendance_log_id: attendanceLogId || null,
          date: today,
          work_start_time: new Date().toISOString(),
          status: "working",
        })
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: () => invalidateSessions(qc),
  });
}

const MAX_BREAK_MINUTES = 60;

export function useCommonTaskBreak() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ sessionId, action }: { sessionId: string; action: "start" | "end" }) => {
      const { data: s, error: readErr } = await supabase
        .from("common_task_sessions")
        .select("break_start_time, break_minutes")
        .eq("id", sessionId)
        .single();
      if (readErr) throw readErr;

      if (action === "start") {
        // Multiple breaks allowed, capped at 1 hour total per session.
        if ((s.break_minutes ?? 0) >= MAX_BREAK_MINUTES) {
          throw new Error(`Break limit of ${MAX_BREAK_MINUTES} minutes already used`);
        }
        const { error } = await supabase
          .from("common_task_sessions")
          .update({
            break_start_time: new Date().toISOString(),
            break_end_time: null,
            status: "on_break",
          })
          .eq("id", sessionId);
        if (error) throw error;
        return;
      }

      const now = new Date();
      const started = s.break_start_time ? new Date(s.break_start_time) : null;
      const added = started ? Math.max(0, Math.round((now.getTime() - started.getTime()) / 60000)) : 0;

      const { error } = await supabase
        .from("common_task_sessions")
        .update({
          break_end_time: now.toISOString(),
          break_minutes: Math.min(MAX_BREAK_MINUTES, (s.break_minutes ?? 0) + added),
          status: "working",
        })
        .eq("id", sessionId);
      if (error) throw error;
    },

    onSuccess: () => invalidateSessions(qc),
  });
}

export function useEndCommonTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ sessionId, notes }: { sessionId: string; notes?: string }) => {
      const { data: s, error: readErr } = await supabase
        .from("common_task_sessions")
        .select("work_start_time, break_start_time, break_end_time, break_minutes, employee_id")
        .eq("id", sessionId)
        .single();
      if (readErr) throw readErr;

      const now = new Date();

      // Auto-close a dangling break so the deduction is never lost.
      let breakMinutes = s.break_minutes ?? 0;
      let breakEnd = s.break_end_time;
      if (s.break_start_time && !s.break_end_time) {
        breakMinutes += Math.max(
          0,
          Math.round((now.getTime() - new Date(s.break_start_time).getTime()) / 60000)
        );
        breakEnd = now.toISOString();
      }

      const gross = s.work_start_time
        ? Math.max(0, Math.round((now.getTime() - new Date(s.work_start_time).getTime()) / 60000))
        : 0;
      const total = Math.max(0, gross - breakMinutes);

      // Overtime against the employee's standard day.
      const { data: emp } = await supabase
        .from("employees")
        .select("standard_hours_per_day, hourly_rate, overtime_rate")
        .eq("id", s.employee_id)
        .single();
      const standardMinutes = Math.round(((emp?.standard_hours_per_day ?? 8) as number) * 60);
      const overtime = Math.max(0, total - standardMinutes);
      const regular = total - overtime;

      const { error } = await supabase
        .from("common_task_sessions")
        .update({
          work_end_time: now.toISOString(),
          break_end_time: breakEnd,
          break_minutes: breakMinutes,
          total_work_minutes: total,
          overtime_minutes: overtime,
          regular_cost: ((emp?.hourly_rate ?? 0) as number) * (regular / 60),
          overtime_cost: ((emp?.overtime_rate ?? 0) as number) * (overtime / 60),
          status: "completed",
          notes: notes ?? null,
        })
        .eq("id", sessionId);
      if (error) throw error;
      return total;
    },
    onSuccess: () => invalidateSessions(qc),
  });
}
