import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMobileAuth } from "@/hooks/useMobileAuth";
import { toLocalDateStr } from "@/lib/utils";
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

  const today = toLocalDateStr(new Date());

  const fetchSession = useCallback(async () => {
    if (!employee || !projectId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("project_work_sessions")
      .select("id, project_id, travel_start_time, site_arrival_time, work_start_time, break_start_time, break_end_time, work_end_time, total_work_minutes")
      .eq("employee_id", employee.id)
      .eq("project_id", projectId)
      .eq("date", today)
      .maybeSingle();
    setSession(data ?? null);
    setStep(deriveProjectStep(data ?? null));
    setLoading(false);
  }, [employee, projectId, today]);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  const executeAction = async (action: ProjectAction, payload?: Record<string, unknown>) => {
    if (!employee || !projectId) return { success: false, error: "Not ready" };
    setActionLoading(true);

    const previousStep = step;
    const next = getNextProjectStep(step, action);
    if (next) setStep(next);

    try {
      const fnMap: Record<ProjectAction, string> = {
        start_travel: "project-start-travel",
        arrive_site: "project-arrive-site",
        start_work: "project-start-work",
        start_break: "project-start-break",
        end_break: "project-end-break",
        end_work: "project-end-work",
      };

      const body: Record<string, unknown> = {
        employee_id: employee.id,
        ...payload,
      };
      if (action === "start_travel") {
        body.project_id = projectId;
      } else {
        body.session_id = session?.id;
      }

      setActionLoading(false);
      const { data, error } = await supabase.functions.invoke(fnMap[action], { body });
      if (error) throw error;

      fetchSession();
      return { success: true, data };
    } catch (e) {
      const msg = (e as { message?: string })?.message || "Action failed";
      console.error(`Project action ${action} failed:`, e);
      setStep(previousStep);
      setActionLoading(false);
      return { success: false, error: msg };
    }
  };

  return {
    session,
    step,
    availableActions: getProjectActions(step),
    loading,
    actionLoading,
    executeAction,
    refresh: fetchSession,
  };
}
