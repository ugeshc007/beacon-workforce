import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMobileAuth } from "@/hooks/useMobileAuth";
import { toLocalDateStr } from "@/lib/utils";
import { deriveProjectStep, ProjectStep } from "@/lib/project-workflow-engine";
import { cacheData, getCachedData } from "@/lib/offline-queue";


export interface TodayProject {
  assignmentId: string;
  projectId: string;
  projectName: string;
  siteAddress: string | null;
  siteLat: number | null;
  siteLng: number | null;
  siteRadius: number;
  shiftStart: string | null;
  shiftEnd: string | null;
  sessionId: string | null;
  step: ProjectStep;
  totalWorkMinutes: number | null;
  assignedRole: string;
  workLocation: "in_house" | "site" | null;
  task: string | null;
}

/** Returns ALL today's project assignments + their session state.
 *  Cached to device storage so the list still shows when the employee is
 *  offline; punch / work actions enqueue separately via the offline queue. */
export function useTodayProjects() {
  const { employee } = useMobileAuth();
  const today = toLocalDateStr(new Date());
  const cacheKey = employee ? `today_projects_${employee.id}_${today}` : null;
  const qc = useQueryClient();

  // Realtime: instantly refresh when a new assignment is created/updated/deleted for this employee today
  useEffect(() => {
    if (!employee) return;
    const channel = supabase
      .channel(`today-assignments-${employee.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "project_assignments", filter: `employee_id=eq.${employee.id}` },
        () => qc.invalidateQueries({ queryKey: ["today-projects", employee.id, today] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [employee, today, qc]);

  return useQuery({
    queryKey: ["today-projects", employee?.id, today],
    enabled: !!employee,
    refetchInterval: 30000,

    // Don't drop the cached value while offline retries spin
    staleTime: 60_000,
    queryFn: async (): Promise<TodayProject[]> => {
      if (!employee) return [];

      // Offline → return last cached snapshot immediately
      if (!navigator.onLine && cacheKey) {
        const cached = await getCachedData<TodayProject[]>(cacheKey);
        if (cached) return cached.data;
        return [];
      }

      try {
        const { data: assignments, error: aErr } = await supabase
          .from("project_assignments")
          .select("id, project_id, shift_start, shift_end, assigned_role, work_location, task, projects(name, site_address, site_latitude, site_longitude, site_gps_radius)")
          .eq("employee_id", employee.id)
          .eq("date", today);
        if (aErr) throw aErr;

        const { data: overrides } = await supabase
          .from("daily_team_overrides")
          .select("project_id, action")
          .eq("date", today)
          .eq("employee_id", employee.id);

        const cancelledProjectIds = new Set(
          (overrides ?? [])
            .filter((o) => o.action === "removed" || o.action === "absent")
            .map((o) => o.project_id)
        );

        const filteredAssignments = (assignments ?? []).filter(
          (a) => !cancelledProjectIds.has(a.project_id)
        );

        if (!filteredAssignments.length) {
          if (cacheKey) await cacheData(cacheKey, []);
          return [];
        }

        const { data: sessions } = await supabase
          .from("project_work_sessions")
          .select("id, project_id, travel_start_time, site_arrival_time, work_start_time, break_start_time, break_end_time, work_end_time, total_work_minutes")
          .eq("employee_id", employee.id)
          .eq("date", today);

        const sessionByProject = new Map(
          (sessions ?? []).map((s) => [s.project_id, s])
        );

        const projectIds = filteredAssignments.map((a) => a.project_id);
        const { data: dayLocs } = await supabase
          .from("project_day_work_locations")
          .select("project_id, location")
          .eq("date", today)
          .in("project_id", projectIds);
        const dayLocByProject = new Map((dayLocs ?? []).map((d) => [d.project_id, d.location as "in_house" | "site"]));

        const result: TodayProject[] = filteredAssignments.map((a) => {
          const project = a.projects as { name?: string; site_address?: string | null; site_latitude?: number | null; site_longitude?: number | null; site_gps_radius?: number | null } | null;
          const session = sessionByProject.get(a.project_id);
          return {
            assignmentId: a.id,
            projectId: a.project_id,
            projectName: project?.name ?? "Unknown",
            siteAddress: project?.site_address ?? null,
            siteLat: project?.site_latitude ?? null,
            siteLng: project?.site_longitude ?? null,
            siteRadius: project?.site_gps_radius ?? 100,
            shiftStart: a.shift_start,
            shiftEnd: a.shift_end,
            sessionId: session?.id ?? null,
            step: deriveProjectStep(session ?? null),
            totalWorkMinutes: session?.total_work_minutes ?? null,
            assignedRole: a.assigned_role ?? "team_member",
            workLocation: (a.work_location as "in_house" | "site" | null) ?? dayLocByProject.get(a.project_id) ?? null,
          };
        });

        if (cacheKey) await cacheData(cacheKey, result);
        return result;
      } catch (err) {
        // Network/auth failure → fall back to cached snapshot if we have one
        if (cacheKey) {
          const cached = await getCachedData<TodayProject[]>(cacheKey);
          if (cached) return cached.data;
        }
        throw err;
      }
    },
  });
}
