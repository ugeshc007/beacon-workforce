import { toLocalDateStr } from "@/lib/utils";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMobileAuth } from "@/hooks/useMobileAuth";
import { cacheData, getCachedData } from "@/lib/offline-queue";
import {
  WorkflowStep,
  WorkflowAction,
  deriveStepFromLog,
  getAvailableActions,
  getNextStep,
} from "@/lib/workflow-engine";

interface TodayAssignment {
  projectId: string;
  projectName: string;
  siteAddress: string | null;
  shiftStart: string | null;
  shiftEnd: string | null;
  siteLat: number | null;
  siteLng: number | null;
  siteRadius: number;
}

interface AttendanceLog {
  id: string;
  office_punch_in: string | null;
  travel_start_time: string | null;
  site_arrival_time: string | null;
  work_start_time: string | null;
  break_start_time: string | null;
  break_end_time: string | null;
  work_end_time: string | null;
  return_travel_start_time: string | null;
  office_arrival_time: string | null;
  office_punch_out: string | null;
}

export function useMobileWorkflow() {
  const { employee } = useMobileAuth();
  const [step, setStep] = useState<WorkflowStep>("idle");
  const [assignment, setAssignment] = useState<TodayAssignment | null>(null);
  const [attendanceLog, setAttendanceLog] = useState<AttendanceLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const today = toLocalDateStr(new Date());

  const fetchData = useCallback(async () => {
    if (!employee) return;
    setLoading(true);

    const cacheKeyAssignment = `assignment_${employee.id}_${today}`;
    const cacheKeyLog = `attendance_${employee.id}_${today}`;

    // OFFLINE: hydrate from cache
    if (!navigator.onLine) {
      const [cachedAssignment, cachedLog] = await Promise.all([
        getCachedData<TodayAssignment | null>(cacheKeyAssignment),
        getCachedData<AttendanceLog | null>(cacheKeyLog),
      ]);
      if (cachedAssignment) setAssignment(cachedAssignment.data);
      if (cachedLog) {
        setAttendanceLog(cachedLog.data);
        setStep(deriveStepFromLog(cachedLog.data));
      }
      setLoading(false);
      return;
    }

    try {
      // Fetch today's assignment
      const { data: assignments } = await supabase
        .from("project_assignments")
        .select("project_id, shift_start, shift_end, projects(name, site_address, site_latitude, site_longitude, site_gps_radius)")
        .eq("employee_id", employee.id)
        .eq("date", today)
        .limit(1);

      let assignmentValue: TodayAssignment | null = null;
      if (assignments && assignments.length > 0) {
        const a = assignments[0];
        const project = a.projects as any;
        assignmentValue = {
          projectId: a.project_id,
          projectName: project?.name || "Unknown",
          siteAddress: project?.site_address,
          shiftStart: a.shift_start,
          shiftEnd: a.shift_end,
          siteLat: project?.site_latitude,
          siteLng: project?.site_longitude,
          siteRadius: project?.site_gps_radius || 100,
        };
      }
      setAssignment(assignmentValue);
      cacheData(cacheKeyAssignment, assignmentValue).catch(() => {});

      // Fetch today's attendance log
      const { data: logs } = await supabase
        .from("attendance_logs")
        .select("id, office_punch_in, travel_start_time, site_arrival_time, work_start_time, break_start_time, break_end_time, work_end_time, return_travel_start_time, office_arrival_time, office_punch_out")
        .eq("employee_id", employee.id)
        .eq("date", today)
        .limit(1);

      const log = logs?.[0] || null;
      setAttendanceLog(log);
      setStep(deriveStepFromLog(log));
      cacheData(cacheKeyLog, log).catch(() => {});
    } catch (e) {
      console.error("Failed to fetch workflow data", e);
      // Fallback to cache on network error
      const [cachedAssignment, cachedLog] = await Promise.all([
        getCachedData<TodayAssignment | null>(cacheKeyAssignment),
        getCachedData<AttendanceLog | null>(cacheKeyLog),
      ]);
      if (cachedAssignment) setAssignment(cachedAssignment.data);
      if (cachedLog) {
        setAttendanceLog(cachedLog.data);
        setStep(deriveStepFromLog(cachedLog.data));
      }
    } finally {
      setLoading(false);
    }
  }, [employee, today]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const executeAction = async (action: WorkflowAction, payload?: Record<string, unknown>) => {
    if (!employee) return;
    setActionLoading(true);

    // Optimistically advance the step immediately for instant UI feedback
    const previousStep = step;
    const next = getNextStep(step, action);
    if (next) setStep(next);

    try {
      const edgeFunctionMap: Record<WorkflowAction, string> = {
        punch_in: "punch-in",
        start_travel: "start-travel",
        arrive_site: "arrive-site",
        start_work: "start-work",
        start_break: "start-break",
        end_break: "end-break",
        end_work: "end-work",
        start_return_travel: "start-return-travel",
        arrive_office: "arrive-office",
        punch_out: "punch-out",
      };

      const fnName = edgeFunctionMap[action];
      const body = {
        employee_id: employee.id,
        ...payload,
      };

      setActionLoading(false); // Release loading immediately after optimistic update

      const { data, error } = await supabase.functions.invoke(fnName, {
        body: JSON.stringify(body),
      });

      if (error) throw error;

      // Background refresh — don't block UI
      fetchData();

      return { success: true, data };
    } catch (e: any) {
      console.error(`Action ${action} failed:`, e);
      // Rollback optimistic update on failure
      setStep(previousStep);
      setActionLoading(false);
      return { success: false, error: e.message || "Action failed" };
    }
  };

  return {
    step,
    assignment,
    attendanceLog,
    availableActions: getAvailableActions(step),
    loading,
    actionLoading,
    executeAction,
    refresh: fetchData,
  };
}
