import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMobileAuth } from "@/hooks/useMobileAuth";
import { toLocalDateStr } from "@/lib/utils";
import { enqueueAction } from "@/lib/offline-queue";
import { syncPendingActions, onSyncChange } from "@/lib/offline-sync";
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

export function useProjectWorkflow(projectId: string | null, dateOverride?: string | null) {
  const { employee } = useMobileAuth();
  const [session, setSession] = useState<SessionRow | null>(null);
  const [step, setStep] = useState<ProjectStep>("idle");
  const [loading, setLoading] = useState(true);
  const [locationLoading, setLocationLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [assignmentLocation, setAssignmentLocation] = useState<"in_house" | "site" | null>(null);

  const today = dateOverride || toLocalDateStr(new Date());
  const { data: dayWorkLocation, isLoading: dayWorkLocationLoading } = useDayWorkLocation(projectId ?? "", today);
  const workLocCacheKey = employee && projectId ? `pwl_v2_${employee.id}_${projectId}_${today}` : null;


  // Per-employee per-day work location set on the schedule page takes priority
  // over the project-wide day location. Cache it so offline reloads keep the
  // in-house vs site distinction (otherwise we'd fall back to travel flow).
  useEffect(() => {
    if (!employee || !projectId) {
      setAssignmentLocation(null);
      setLocationLoading(false);
      return;
    }
    setLocationLoading(true);
    // Offline → hydrate from cache, don't try the network
    if (!navigator.onLine) {
      try {
        const cached = workLocCacheKey ? localStorage.getItem(workLocCacheKey) : null;
        if (cached) setAssignmentLocation(JSON.parse(cached));
      } catch { /* ignore */ }
      setLocationLoading(false);
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
        const loc = (data?.work_location as "in_house" | "site" | null) ?? null;
        setAssignmentLocation(loc);
        if (workLocCacheKey) {
          try { localStorage.setItem(workLocCacheKey, JSON.stringify(loc)); } catch { /* ignore */ }
        }
        setLocationLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [employee, projectId, today, workLocCacheKey]);

  // Fallback: if no explicit location is set for the assignment or day,
  // check the project itself — no site coords means in-house (no travel flow).
  const [projectHasCoords, setProjectHasCoords] = useState<boolean | null>(null);
  useEffect(() => {
    if (!projectId || !navigator.onLine) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("projects")
        .select("site_latitude, site_longitude")
        .eq("id", projectId)
        .maybeSingle();
      if (!cancelled) {
        setProjectHasCoords(data?.site_latitude != null && data?.site_longitude != null);
      }
    })();
    return () => { cancelled = true; };
  }, [projectId]);
  const inferredLocation: "in_house" | "site" | null =
    projectHasCoords === null ? null : (projectHasCoords ? "site" : "in_house");
  const workLocation = assignmentLocation ?? dayWorkLocation ?? inferredLocation ?? null;




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
        case "start_break": return { break_start_time: nowIso, break_end_time: null };
        case "end_break": return { break_end_time: nowIso };
        case "end_work": return { work_end_time: nowIso };
        default: return {};
      }
    })();
    const optimisticSession: SessionRow = {
      ...(session ?? { id: "", project_id: projectId, travel_start_time: null, site_arrival_time: null, work_start_time: null, break_start_time: null, break_end_time: null, work_end_time: null, total_work_minutes: null }),
      ...optimisticPatch,
    };
    setSession(optimisticSession);
    if (sessionCacheKey) {
      try { localStorage.setItem(sessionCacheKey, JSON.stringify(optimisticSession)); } catch { /* ignore */ }
    }

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
      project_id: projectId,
      date: today,
      client_timestamp: nowIso,
      ...payload,
    };

    if (action !== "start_travel") {
      // Follow-up actions need the server session id. If the previous step was
      // queued offline, keep project_id + date in the payload so the sync
      // engine can resolve the session after replaying the earlier action.
      let sid = session?.id;
      if (!sid && employee && projectId && navigator.onLine) {
        try {
          const { data: row } = await supabase
            .from("project_work_sessions")
            .select("id")
            .eq("employee_id", employee.id)
            .eq("project_id", projectId)
            .eq("date", today)
            .is("work_end_time", null)
            .maybeSingle();
          sid = row?.id ?? undefined;
          if (sid) setSession((prev) => prev ? { ...prev, id: sid! } : prev);
        } catch { /* ignore */ }
      }
      if (sid) {
        body.session_id = sid;
      } else if (action === "start_work" && workLocation === "in_house") {
        // In-house mode starts by creating the project session from project_id.
      } else if (!navigator.onLine) {
        // Offline site flow: session_id will be resolved during sync.
      } else {
        setActionLoading(false);
        setStep(previousStep);
        setSession(previousSession);
        return { success: false, error: "Session not ready yet. Please try again in a moment." };
      }
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
      // Capture the server-issued session_id immediately (in-house start_work)
      // so the next action has a valid id without waiting on fetchSession.
      const newSid = (data as { session_id?: string } | undefined)?.session_id;
      if (newSid) {
        setSession((prev) => prev ? { ...prev, id: newSid } : prev);
      }
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
  // IMPORTANT: never overwrite optimistic state before the offline queue
  // has finished replaying — otherwise the UI snaps back to "idle" because
  // the server still has no session row for today's queued actions.
  useEffect(() => {
    const onOnline = () => {
      // Kick a sync (no-op if one is already running via initAutoSync).
      syncPendingActions("hook:online").catch(console.error);
    };
    window.addEventListener("online", onOnline);
    // Refetch only when the sync engine reports idle (syncing=false).
    // This runs regardless of which caller kicked off the sync.
    let wasSyncing = false;
    const unsub = onSyncChange((_pending, syncing) => {
      if (wasSyncing && !syncing) {
        fetchSession();
      }
      wasSyncing = syncing;
    });
    return () => {
      window.removeEventListener("online", onOnline);
      unsub();
    };
  }, [fetchSession]);


  return {
    session,
    step,
    workLocation: workLocation ?? null,
    availableActions: getProjectActions(step, workLocation ?? null),
    loading: loading || locationLoading || dayWorkLocationLoading,
    actionLoading,
    executeAction,
    refresh: fetchSession,
  };
}

