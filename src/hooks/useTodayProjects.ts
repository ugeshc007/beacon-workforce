import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMobileAuth } from "@/hooks/useMobileAuth";
import { toLocalDateStr } from "@/lib/utils";
import { deriveProjectStep, ProjectStep } from "@/lib/project-workflow-engine";
import { cacheData, getCachedData } from "@/lib/offline-queue";
import { invokeEdge } from "@/lib/invoke-edge";


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
  const cacheKey = employee ? `today_projects_v2_${employee.id}_${today}` : null;
  const qc = useQueryClient();

  // Realtime: instantly refresh when a new assignment is created/updated/deleted for this employee today.
  // Skip when offline (the WebSocket connect would just spam channel errors) and re-subscribe on reconnect.
  useEffect(() => {
    if (!employee) return;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    const subscribe = () => {
      if (typeof navigator !== "undefined" && navigator.onLine === false) return;
      if (channel) return;
      channel = supabase
        .channel(`today-assignments-${employee.id}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "project_assignments", filter: `employee_id=eq.${employee.id}` },
          () => qc.invalidateQueries({ queryKey: ["today-projects", employee.id, today] }),
        )
        .subscribe();
    };
    const teardown = () => {
      if (channel) {
        supabase.removeChannel(channel);
        channel = null;
      }
    };
    subscribe();
    const onOnline = () => { subscribe(); qc.invalidateQueries({ queryKey: ["today-projects", employee.id, today] }); };
    const onOffline = () => teardown();
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      teardown();
    };
  }, [employee, today, qc]);

  // Overlay optimistic per-project session state (written by useProjectWorkflow
  // when actions are enqueued offline) so completed/working steps show up on
  // the home list even without a fresh server fetch.
  const overlaySessionCache = (list: TodayProject[]): TodayProject[] => {
    if (!employee) return list;
    return list.map((p) => {
      try {
        const raw = localStorage.getItem(`pws_${employee.id}_${p.projectId}_${today}`);
        if (!raw) return p;
        const cached = JSON.parse(raw) as {
          id?: string;
          travel_start_time?: string | null;
          site_arrival_time?: string | null;
          work_start_time?: string | null;
          break_start_time?: string | null;
          break_end_time?: string | null;
          work_end_time?: string | null;
          total_work_minutes?: number | null;
        } | null;
        if (!cached) return p;
        const derived = deriveProjectStep(cached);
        // Only advance forward; never regress a step the server already reported.
        const order: ProjectStep[] = ["idle", "traveling", "at_site", "working", "on_break", "completed"];
        const next = order.indexOf(derived) > order.indexOf(p.step) ? derived : p.step;
        return {
          ...p,
          sessionId: p.sessionId ?? cached.id ?? null,
          step: next,
          totalWorkMinutes: cached.total_work_minutes ?? p.totalWorkMinutes,
        };
      } catch {
        return p;
      }
    });
  };

  return useQuery({
    queryKey: ["today-projects", employee?.id, today],
    enabled: !!employee,
    refetchInterval: 30000,

    // Always re-check the backend on mobile home; cached snapshots are only for offline/error fallback.
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnReconnect: "always",
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<TodayProject[]> => {
      if (!employee) return [];

      // Offline → return last cached snapshot immediately, with per-project
      // session cache overlaid so offline-completed projects show as done.
      if (!navigator.onLine && cacheKey) {
        const cached = await getCachedData<TodayProject[]>(cacheKey);
        return overlaySessionCache(cached?.data ?? []);
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

        let result: TodayProject[] = filteredAssignments.map((a) => {
          const project = a.projects as { name?: string; site_address?: string | null; site_latitude?: number | null; site_longitude?: number | null; site_gps_radius?: number | null } | null;
          const session = sessionByProject.get(a.project_id);
          const explicitLoc = (a.work_location as "in_house" | "site" | null) ?? dayLocByProject.get(a.project_id) ?? null;
          // Fallback inference: no site coords → in-house; otherwise site.
          // Prevents the travel flow from ever appearing for pure in-house jobs
          // where the scheduler never set work_location explicitly.
          const hasCoords = project?.site_latitude != null && project?.site_longitude != null;
          const workLocation: "in_house" | "site" = explicitLoc ?? (hasCoords ? "site" : "in_house");
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
            workLocation,
            task: (a as any).task ?? null,
          };
        });

        // Authoritative mobile fallback: the backend function returns the same
        // effective location used by workflow actions. This overwrites stale or
        // RLS-missed client inference (BG002 case: schedule says Site, project
        // has no GPS coords, old cache said In-House).
        try {
          const effective = await invokeEdge<{
            assigned?: boolean;
            work_location?: "in_house" | "site" | null;
            project?: { id?: string | null } | null;
          }>("today-assignment", { employee_id: employee.id });
          if (effective?.assigned && effective.project?.id && effective.work_location) {
            result = result.map((project) => project.projectId === effective.project?.id
              ? { ...project, workLocation: effective.work_location ?? project.workLocation }
              : project);
          }
        } catch { /* direct table result remains the fallback */ }

        if (cacheKey) await cacheData(cacheKey, result);
        // Seed per-project work-location cache so useProjectWorkflow knows
        // in_house vs site even if the user opens the project card for the
        // first time while offline (otherwise it defaults to site/travel flow).
        try {
          result.forEach((r) => {
            // Always seed the cache so offline never falls back to the site
            // travel flow by accident. If no explicit work_location is set,
            // infer from the project: no site coords → in-house; otherwise site.
            const inferred = r.workLocation
              ?? (r.siteLat == null && r.siteLng == null ? "in_house" : "site");
            localStorage.setItem(
              `pwl_${employee.id}_${r.projectId}_${today}`,
              JSON.stringify(inferred),
            );
            localStorage.setItem(
              `pwl_v2_${employee.id}_${r.projectId}_${today}`,
              JSON.stringify(inferred),
            );
          });
        } catch { /* ignore */ }
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
