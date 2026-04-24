import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMobileAuth } from "@/hooks/useMobileAuth";
import { toLocalDateStr } from "@/lib/utils";
import { enqueueAction } from "@/lib/offline-queue";
import { syncPendingActions } from "@/lib/offline-sync";
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
  travel_start_time: string | null;
  site_arrival_time: string | null;
  work_start_time: string | null;
  break_start_time: string | null;
  break_end_time: string | null;
  work_end_time: string | null;
  return_travel_start_time: string | null;
  total_work_minutes: number | null;
}

export function useSiteVisitWorkflow(siteVisitId: string | null) {
  const { employee } = useMobileAuth();
  const [session, setSession] = useState<SessionRow | null>(null);
  const [step, setStep] = useState<SiteVisitStep>("idle");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const today = toLocalDateStr(new Date());

  const fetchSession = useCallback(async () => {
    if (!employee || !siteVisitId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("site_visit_work_sessions")
      .select("id, site_visit_id, travel_start_time, site_arrival_time, work_start_time, break_start_time, break_end_time, work_end_time, return_travel_start_time, total_work_minutes")
      .eq("employee_id", employee.id)
      .eq("site_visit_id", siteVisitId)
      .eq("date", today)
      .maybeSingle();
    setSession(data ?? null);
    setStep(deriveSiteVisitStep(data ?? null));
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
        default: return {};
      }
    })();
    setSession((prev) => ({
      ...(prev ?? { id: "", site_visit_id: siteVisitId, travel_start_time: null, site_arrival_time: null, work_start_time: null, break_start_time: null, break_end_time: null, work_end_time: null, return_travel_start_time: null, total_work_minutes: null }),
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
    };
    const queueTypeMap: Record<SiteVisitAction, string> = {
      start_travel: "sv_start_travel",
      arrive_site: "sv_arrive_site",
      start_survey: "sv_start_survey",
      start_break: "sv_start_break",
      end_break: "sv_end_break",
      end_visit: "sv_end_visit",
      start_return_travel: "sv_start_return_travel",
    };

    const body: Record<string, unknown> = {
      employee_id: employee.id,
      client_event_time: nowIso,
      ...payload,
    };
    if (action === "start_travel") body.site_visit_id = siteVisitId;
    else body.session_id = session?.id;

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
      const { data, error } = await supabase.functions.invoke(fnMap[action], { body });
      if (error) throw error;
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
      syncPendingActions().catch(console.error).finally(() => fetchSession());
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
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
