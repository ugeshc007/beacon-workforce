import { toLocalDateStr } from "@/lib/utils";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMobileAuth } from "@/hooks/useMobileAuth";
import { cacheData, getCachedData, enqueueAction } from "@/lib/offline-queue";
import { invokeEdge } from "@/lib/invoke-edge";
import { syncPendingActions } from "@/lib/offline-sync";
import { toast } from "@/hooks/use-toast";
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

      // Fetch the LATEST attendance log for today.
      // Employees can have multiple shifts/day (e.g. day shift + night shift),
      // so we order by punch-in desc and take the most recent log to derive
      // the current step. Otherwise the UI would stay stuck on a closed log.
      const { data: logs } = await supabase
        .from("attendance_logs")
        .select("id, office_punch_in, travel_start_time, site_arrival_time, work_start_time, break_start_time, break_end_time, work_end_time, return_travel_start_time, office_arrival_time, office_punch_out")
        .eq("employee_id", employee.id)
        .eq("date", today)
        .order("office_punch_in", { ascending: false, nullsFirst: false })
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
    const previousLog = attendanceLog;
    let next = getNextStep(step, action);
    // For in-house break end, return to punched_in (no work_start_time set)
    if (action === "end_break" && !attendanceLog?.work_start_time) {
      next = "punched_in";
    }
    if (next) setStep(next);

    // Optimistically patch attendance log + cache so the UI survives remounts/refresh
    // (otherwise an offline action would be reverted by the next cache hydration).
    const nowIso = new Date().toISOString();
    const logPatch: Partial<AttendanceLog> = (() => {
      switch (action) {
        case "punch_in": return { office_punch_in: nowIso };
        case "start_travel": return { travel_start_time: nowIso };
        case "arrive_site": return { site_arrival_time: nowIso };
        case "start_work": return { work_start_time: nowIso };
        case "start_break": return { break_start_time: nowIso, break_end_time: null };
        case "end_break": return { break_end_time: nowIso };
        case "end_work": return { work_end_time: nowIso };
        case "start_return_travel": return { return_travel_start_time: nowIso };
        case "arrive_office": return { office_arrival_time: nowIso };
        case "punch_out": return { office_punch_out: nowIso };
        default: return {};
      }
    })();
    const optimisticLog: AttendanceLog = {
      ...(attendanceLog ?? {
        id: "",
        office_punch_in: null, travel_start_time: null, site_arrival_time: null,
        work_start_time: null, break_start_time: null, break_end_time: null,
        work_end_time: null, return_travel_start_time: null,
        office_arrival_time: null, office_punch_out: null,
      }),
      ...logPatch,
    };
    setAttendanceLog(optimisticLog);
    cacheData(`attendance_${employee.id}_${today}`, optimisticLog).catch(() => {});

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
    const clientTimestamp = nowIso;
    const body = {
      employee_id: employee.id,
      client_timestamp: clientTimestamp,
      ...payload,
    };

    // If offline → queue immediately, don't even try the network call
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      await enqueueAction({ action_type: action, payload: body, timestamp: clientTimestamp });
      setActionLoading(false);
      toast({ title: "Saved offline", description: "Will sync when you're back online." });
      return { success: true, queued: true };
    }

    setActionLoading(false);
    try {
      const data = await invokeEdge(fnName, body);
      fetchData();
      return { success: true, data };
    } catch (e: any) {
      // Network-style failure → queue for later. Keep optimistic step.
      const msg = (e?.message || "").toLowerCase();
      const isNetwork = msg.includes("network") || msg.includes("fetch") || msg.includes("failed to") || msg.includes("timeout");
      if (isNetwork || typeof navigator !== "undefined" && !navigator.onLine) {
        await enqueueAction({ action_type: action, payload: body, timestamp: clientTimestamp });
        toast({ title: "Saved offline", description: "Will sync when connection returns." });
        // Try a background sync attempt shortly in case the blip cleared
        setTimeout(() => { syncPendingActions().catch(() => {}); }, 5000);
        return { success: true, queued: true };
      }
      // Real validation error → rollback step and surface to caller
      console.error(`Action ${action} failed:`, e);
      setStep(previousStep);
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
