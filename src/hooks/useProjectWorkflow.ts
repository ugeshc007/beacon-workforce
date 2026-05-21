import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMobileAuth } from "@/hooks/useMobileAuth";
import { toLocalDateStr } from "@/lib/utils";
import { enqueueAction } from "@/lib/offline-queue";
import { syncPendingActions } from "@/lib/offline-sync";
import { invokeEdge } from "@/lib/invoke-edge";
import { useDayWorkLocation } from "@/hooks/useDayWorkLocation";
import {
  ProjectStep,
  ProjectAction,
  deriveProjectStep,
  getProjectActions,
  getNextProjectStep,
} from "@/lib/project-workflow-engine";


interface SessionRow {
  id: string;
  project_id: string;
  travel_start_time: string | null;
  site_arrival_time: string | null;
  work_start_time: string | null;
  break_start_time: string | null;
  break_end_time: string | null;
  work_end_time: string | null;
  total_work_minutes: number | null;
}

export function useProjectWorkflow(projectId: string | null) {
  const { employee } = useMobileAuth();
  const [session, setSession] = useState<SessionRow | null>(null);
  const [step, setStep] = useState<ProjectStep>("idle");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [assignmentLocation, setAssignmentLocation] = useState<"in_house" | "site" | null>(null);

  const today = toLocalDateStr(new Date());
  const { data: dayWorkLocation } = useDayWorkLocation(projectId ?? "", today);

  // Per-employee per-day work location set on the schedule page takes priority
  // over the project-wide day location.
  useEffect(() => {
    if (!employee || !projectId) {
      setAssignmentLocation(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("project_assignments")
        .select("work_location")
        .eq("employee_id", employee.id)
        .eq("project_id", projectId)
        .eq("date", today)
        .maybeSingle();
      if (!cancelled) {
        setAssignmentLocation((data?.work_location as "in_house" | "site" | null) ?? null);
      }
    })();
    return () => { cancelled = true; };
  }, [employee, projectId, today]);

  const workLocation = assignmentLocation ?? dayWorkLocation ?? null;




  const sessionCacheKey = employee && projectId ? `pws_${employee.id}_${projectId}_${today}` : null;

  const fetchSession = useCallback(async () => {
    if (!employee || !projectId) {
      setLoading(false);
      return;
    }
    setLoading(true);

    // Offline → hydrate from localStorage cache, never overwrite with null
    if (!navigator.onLine) {
      try {
        const cached = sessionCacheKey ? localStorage.getItem(sessionCacheKey) : null;
        if (cached) {
          const parsed = JSON.parse(cached) as SessionRow;
          setSession(parsed);
          setStep(deriveProjectStep(parsed));
        }
      } catch { /* ignore */ }
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from("project_work_sessions")
      .select("id, project_id, travel_start_time, site_arrival_time, work_start_time, break_start_time, break_end_time, work_end_time, total_work_minutes")
      .eq("employee_id", employee.id)
      .eq("project_id", projectId)
      .eq("date", today)
      .maybeSingle();
    setSession(data ?? null);
    setStep(deriveProjectStep(data ?? null));
    if (sessionCacheKey) {
      try { localStorage.setItem(sessionCacheKey, JSON.stringify(data ?? null)); } catch { /* ignore */ }
    }
    setLoading(false);
  }, [employee, projectId, today, sessionCacheKey]);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  const executeAction = async (action: ProjectAction, payload?: Record<string, unknown>) => {
    if (!employee || !projectId) return { success: false, error: "Not ready" };
    setActionLoading(true);

    const previousStep = step;
    const previousSession = session;
    const next = getNextProjectStep(step, action, workLocation);
    if (next) setStep(next);

    // Optimistically advance session timestamps so the live timer keeps ticking
    // even while offline (until real server data replaces them on next refresh).
    const nowIso = new Date().toISOString();
    const optimisticPatch: Partial<SessionRow> = (() => {
      switch (action) {
        case "start_travel": return { travel_start_time: nowIso };
        case "arrive_site": return { site_arrival_time: nowIso };
        case "start_work": return { work_start_time: nowIso };
        case "start_break": return { break_start_time: nowIso };
        case "end_break": return { break_end_time: nowIso };
        case "end_work": return { work_end_time: nowIso };
        default: return {};
      }
    })();
    setSession((prev) => ({
      ...(prev ?? { id: "", project_id: projectId, travel_start_time: null, site_arrival_time: null, work_start_time: null, break_start_time: null, break_end_time: null, work_end_time: null, total_work_minutes: null }),
      ...optimisticPatch,
    }));

    const fnMap: Record<ProjectAction, string> = {
      start_travel: "project-start-travel",
      arrive_site: "project-arrive-site",
      start_work: "project-start-work",
      start_break: "project-start-break",
      end_break: "project-end-break",
      end_work: "project-end-work",
    };

    const queueTypeMap: Record<ProjectAction, string> = {
      start_travel: "project_start_travel",
      arrive_site: "project_arrive_site",
      start_work: "project_start_work",
      start_break: "project_start_break",
      end_break: "project_end_break",
      end_work: "project_end_work",
    };

    const body: Record<string, unknown> = {
      employee_id: employee.id,
      client_event_time: nowIso,
      ...payload,
    };
    if (action === "start_travel") {
      body.project_id = projectId;
    } else if (action === "start_work" && !session?.id) {
      // In-house mode: no session exists yet — server creates one from project_id.
      body.project_id = projectId;
    } else {
      body.session_id = session?.id;
    }


    setActionLoading(false);

    // Offline path — queue immediately, keep optimistic UI, sync later.
    if (!navigator.onLine) {
      try {
        await enqueueAction({
          action_type: queueTypeMap[action],
          payload: body,
          timestamp: nowIso,
        });
        return { success: true, queued: true };
      } catch (e) {
        console.error("Failed to enqueue offline action", e);
        setStep(previousStep);
        setSession(previousSession);
        return { success: false, error: "Could not save action offline" };
      }
    }

    try {
      const data = await invokeEdge(fnMap[action], body);
      fetchSession();
      return { success: true, data };
    } catch (e) {
      const msg = (e as { message?: string })?.message || "Action failed";
      const isNetwork = /Failed to fetch|NetworkError|network|timeout/i.test(msg);
      // Network blip — queue and keep optimistic state so the timer keeps running.
      if (isNetwork) {
        try {
          await enqueueAction({
            action_type: queueTypeMap[action],
            payload: body,
            timestamp: nowIso,
          });
          return { success: true, queued: true };
        } catch (qe) {
          console.error("Failed to enqueue after network error", qe);
        }
      }
      console.error(`Project action ${action} failed:`, e);
      setStep(previousStep);
      setSession(previousSession);
      return { success: false, error: msg };
    }
  };

  // When the device comes back online, flush any queued project actions
  // and refresh from the server so the timer state matches reality.
  useEffect(() => {
    const onOnline = () => {
      syncPendingActions()
        .catch(console.error)
        .finally(() => fetchSession());
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [fetchSession]);

  return {
    session,
    step,
    workLocation: workLocation ?? null,
    availableActions: getProjectActions(step, workLocation ?? null),
    loading,
    actionLoading,
    executeAction,
    refresh: fetchSession,
  };
}

