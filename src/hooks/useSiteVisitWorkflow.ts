import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMobileAuth } from "@/hooks/useMobileAuth";
import { toLocalDateStr } from "@/lib/utils";
import { enqueueAction } from "@/lib/offline-queue";
import { syncPendingActions, onSyncChange } from "@/lib/offline-sync";
import { invokeEdge } from "@/lib/invoke-edge";
import {
  SiteVisitStep,
  SiteVisitAction,
  deriveSiteVisitStep,
  getSiteVisitActions,
  getNextSiteVisitStep,
} from "@/lib/site-visit-workflow-engine";

interface SessionRow {
  id: string;
  site_visit_id: string;
  attendance_log_id: string | null;
  travel_start_time: string | null;
  site_arrival_time: string | null;
  work_start_time: string | null;
  break_start_time: string | null;
  break_end_time: string | null;
  work_end_time: string | null;
  return_travel_start_time: string | null;
  office_arrival_time: string | null;
  total_work_minutes: number | null;
}

export function useSiteVisitWorkflow(siteVisitId: string | null) {
  const { employee } = useMobileAuth();
  const [session, setSession] = useState<SessionRow | null>(null);
  const [step, setStep] = useState<SiteVisitStep>("idle");
  const [loading, setLoading] = useState(true);
  const hasLoadedRef = useRef(false);
  const [actionLoading, setActionLoading] = useState(false);

  const today = toLocalDateStr(new Date());

  const fetchSession = useCallback(async () => {
    if (!employee || !siteVisitId) {
      hasLoadedRef.current = true;
    setLoading(false);
      return;
    }
    // Only show the blocking loader on the very first load; background
    // refreshes (sync finished, reconnect) must not flash the screen.
    if (!hasLoadedRef.current) setLoading(true);
    // Night-shift support: look for an open session from today OR yesterday.
    const yesterday = new Date(new Date(today + "T00:00:00").getTime() - 86_400_000)
      .toISOString()
      .split("T")[0];
    const { data } = await supabase
      .from("site_visit_work_sessions")
      .select("id, site_visit_id, attendance_log_id, travel_start_time, site_arrival_time, work_start_time, break_start_time, break_end_time, work_end_time, return_travel_start_time, total_work_minutes")
      .eq("employee_id", employee.id)
      .eq("site_visit_id", siteVisitId)
      .in("date", [today, yesterday])
      .is("work_end_time", null)
      .order("date", { ascending: false })
      .order("travel_start_time", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    let officeArrival: string | null = null;
    if (data?.attendance_log_id) {
      const { data: log } = await supabase
        .from("attendance_logs")
        .select("office_arrival_time")
        .eq("id", data.attendance_log_id)
        .maybeSingle();
      officeArrival = log?.office_arrival_time ?? null;
    }
    const merged: SessionRow | null = data ? { ...data, office_arrival_time: officeArrival } : null;
    setSession(merged);
    setStep(deriveSiteVisitStep(merged));
    hasLoadedRef.current = true;
    setLoading(false);
  }, [employee, siteVisitId, today]);

  useEffect(() => { fetchSession(); }, [fetchSession]);

  const executeAction = async (action: SiteVisitAction, payload?: Record<string, unknown>) => {
    if (!employee || !siteVisitId) return { success: false, error: "Not ready" };
    setActionLoading(true);

    const previousStep = step;
    const previousSession = session;
    const next = getNextSiteVisitStep(step, action);
    if (next) setStep(next);

    const nowIso = new Date().toISOString();
    const optimisticPatch: Partial<SessionRow> = (() => {
      switch (action) {
        case "start_travel": return { travel_start_time: nowIso };
        case "arrive_site": return { site_arrival_time: nowIso };
        case "start_survey": return { work_start_time: nowIso };
        case "start_break": return { break_start_time: nowIso };
        case "end_break": return { break_end_time: nowIso };
        case "end_visit": return { work_end_time: nowIso };
        case "start_return_travel": return { return_travel_start_time: nowIso };
        case "arrive_office": return { office_arrival_time: nowIso };
        default: return {};
      }
    })();
    setSession((prev) => ({
      ...(prev ?? { id: "", site_visit_id: siteVisitId, attendance_log_id: null, travel_start_time: null, site_arrival_time: null, work_start_time: null, break_start_time: null, break_end_time: null, work_end_time: null, return_travel_start_time: null, office_arrival_time: null, total_work_minutes: null }),
      ...optimisticPatch,
    }));

    const fnMap: Record<SiteVisitAction, string> = {
      start_travel: "sv-start-travel",
      arrive_site: "sv-arrive-site",
      start_survey: "sv-start-survey",
      start_break: "sv-start-break",
      end_break: "sv-end-break",
      end_visit: "sv-end-visit",
      start_return_travel: "sv-start-return-travel",
      arrive_office: "arrive-office",
    };
    const queueTypeMap: Record<SiteVisitAction, string> = {
      start_travel: "sv_start_travel",
      arrive_site: "sv_arrive_site",
      start_survey: "sv_start_survey",
      start_break: "sv_start_break",
      end_break: "sv_end_break",
      end_visit: "sv_end_visit",
      start_return_travel: "sv_start_return_travel",
      arrive_office: "arrive_office",
    };

    const body: Record<string, unknown> = {
      employee_id: employee.id,
      site_visit_id: siteVisitId,
      date: today,
      client_timestamp: nowIso,
      ...payload,
    };
    if (action === "arrive_office") body.attendance_log_id = session?.attendance_log_id;
    else if (action !== "start_travel" && session?.id) body.session_id = session.id;

    setActionLoading(false);

    if (!navigator.onLine) {
      try {
        await enqueueAction({ action_type: queueTypeMap[action], payload: body, timestamp: nowIso });
        return { success: true, queued: true };
      } catch (e) {
        console.error("Failed to enqueue offline sv action", e);
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
      if (isNetwork) {
        try {
          await enqueueAction({ action_type: queueTypeMap[action], payload: body, timestamp: nowIso });
          return { success: true, queued: true };
        } catch (qe) {
          console.error("Failed to enqueue after network error", qe);
        }
      }
      console.error(`Site visit action ${action} failed:`, e);
      setStep(previousStep);
      setSession(previousSession);
      return { success: false, error: msg };
    }
  };

  useEffect(() => {
    const onOnline = () => {
      syncPendingActions("hook:online").catch(console.error);
    };
    window.addEventListener("online", onOnline);
    let wasSyncing = false;
    const unsub = onSyncChange((_pending, syncing) => {
      if (wasSyncing && !syncing) fetchSession();
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
    availableActions: getSiteVisitActions(step),
    loading,
    actionLoading,
    executeAction,
    refresh: fetchSession,
  };
}
