import { isOnline } from "@/lib/connectivity";
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
  /** Session's own work start/end (used for a trustworthy card duration). */
  workStartTime: string | null;
  workEndTime: string | null;
  breakMinutes: number;
  assignedRole: string;
  workLocation: "in_house" | "site" | null;
  task: string | null;
  /** The assignment's own schedule date (may be yesterday for an overnight shift). */
  date: string;
  /** True when this assignment belongs to yesterday and is still running past midnight. */
  isOvernightCarry: boolean;
}


/** Returns ALL today's project assignments + their session state.
 *  Cached to device storage so the list still shows when the employee is
 *  offline; punch / work actions enqueue separately via the offline queue. */
function diffMinutes(from?: string | null, to?: string | null): number {
  if (!from || !to) return 0;
  const a = new Date(from).getTime();
  const b = new Date(to).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return 0;
  return Math.round((b - a) / 60000);
}

/** Trustworthy worked minutes for a project card: always derived from the
 *  session's own work start/end (minus its break) so a bad server-side
 *  total (e.g. computed from the shift punch-in after an out-of-order sync)
 *  can never show up as an inflated duration. */
export function projectWorkedMinutes(p: {
  workStartTime: string | null;
  workEndTime: string | null;
  breakMinutes: number;
  totalWorkMinutes: number | null;
}): number | null {
  if (p.workStartTime && p.workEndTime) {
    return Math.max(0, diffMinutes(p.workStartTime, p.workEndTime) - (p.breakMinutes || 0));
  }
  return p.totalWorkMinutes;
}

/** Grace period after an overnight shift's end time during which the
 *  assignment stays visible so the employee can still finish / punch out. */
const OVERNIGHT_GRACE_HOURS = 4;

function prevDateStr(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() - 1);
  return toLocalDateStr(d);
}

/** True when a shift's end time is earlier than its start time (crosses midnight). */
function isOvernightShift(start?: string | null, end?: string | null): boolean {
  if (!start || !end) return false;
  return end < start;
}

export function useTodayProjects() {
  const { employee } = useMobileAuth();
  const today = toLocalDateStr(new Date());
  const yesterday = prevDateStr(today);
  const cacheKey = employee ? `today_projects_v2_${employee.id}_${today}` : null;
  const qc = useQueryClient();

  // Realtime: instantly refresh when a new assignment is created/updated/deleted for this employee today.
  // Skip when offline (the WebSocket connect would just spam channel errors) and re-subscribe on reconnect.
  useEffect(() => {
    if (!employee) return;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    const subscribe = () => {
      if (!isOnline()) return;
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
  // the home list even without a fresh server fetch. Keyed off each
  // assignment's OWN date so overnight carry-overs read yesterday's cache.
  const overlaySessionCache = (list: TodayProject[]): TodayProject[] => {
    if (!employee) return list;
    return list.map((p) => {
      try {
        const raw = localStorage.getItem(`pws_${employee.id}_${p.projectId}_${p.date ?? today}`);
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
          workStartTime: cached.work_start_time ?? p.workStartTime,
          workEndTime: cached.work_end_time ?? p.workEndTime,
          breakMinutes: diffMinutes(cached.break_start_time, cached.break_end_time) || p.breakMinutes,
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
      if (!isOnline() && cacheKey) {
        const cached = await getCachedData<TodayProject[]>(cacheKey);
        return overlaySessionCache(cached?.data ?? []);
      }

      try {
        // Shift window: today + yesterday. Yesterday's rows are kept only when
        // they are genuinely still live (overnight shift inside its grace
        // window, an open project session, or an open attendance log).
        const { data: assignments, error: aErr } = await supabase
          .from("project_assignments")
          .select("id, date, project_id, shift_start, shift_end, assigned_role, work_location, task, projects(name, site_address, site_latitude, site_longitude, site_gps_radius)")
          .eq("employee_id", employee.id)
          .in("date", [yesterday, today]);
        if (aErr) throw aErr;

        const { data: overrides } = await supabase
          .from("daily_team_overrides")
          .select("project_id, date, action")
          .in("date", [yesterday, today])
          .eq("employee_id", employee.id);

        const cancelledKeys = new Set(
          (overrides ?? [])
            .filter((o) => o.action === "removed" || o.action === "absent")
            .map((o) => `${o.project_id}_${o.date}`)
        );

        const { data: sessions } = await supabase
          .from("project_work_sessions")
          .select("id, project_id, date, travel_start_time, site_arrival_time, work_start_time, break_start_time, break_end_time, work_end_time, total_work_minutes")
          .eq("employee_id", employee.id)
          .in("date", [yesterday, today]);

        const sessionByKey = new Map(
          (sessions ?? []).map((s) => [`${s.project_id}_${s.date}`, s])
        );

        const { data: logs } = await supabase
          .from("attendance_logs")
          .select("date, office_punch_out")
          .eq("employee_id", employee.id)
          .in("date", [yesterday, today]);
        const openLogDates = new Set(
          (logs ?? []).filter((l) => !l.office_punch_out).map((l) => l.date)
        );

        const nowMs = Date.now();
        const stillLiveFromYesterday = (a: {
          date: string;
          project_id: string;
          shift_start: string | null;
          shift_end: string | null;
        }): boolean => {
          const session = sessionByKey.get(`${a.project_id}_${a.date}`);
          // An unfinished session from yesterday must stay reachable.
          if (session && !session.work_end_time) return true;
          // Yesterday's shift is still open at the office level.
          if (openLogDates.has(a.date)) return true;
          // Overnight shift that has not yet passed its end time + grace.
          if (isOvernightShift(a.shift_start, a.shift_end) && a.shift_end) {
            const [h, m] = a.shift_end.split(":").map((n) => parseInt(n, 10));
            const end = new Date(`${today}T00:00:00`);
            end.setHours(h || 0, m || 0, 0, 0);
            return nowMs <= end.getTime() + OVERNIGHT_GRACE_HOURS * 3_600_000;
          }
          return false;
        };

        const filteredAssignments = (assignments ?? []).filter((a) => {
          if (cancelledKeys.has(`${a.project_id}_${a.date}`)) return false;
          if (a.date === today) return true;
          return stillLiveFromYesterday(a as never);
        });

        if (!filteredAssignments.length) {
          if (cacheKey) await cacheData(cacheKey, []);
          return [];
        }

        const projectIds = Array.from(new Set(filteredAssignments.map((a) => a.project_id)));
        const { data: dayLocs } = await supabase
          .from("project_day_work_locations")
          .select("project_id, date, location")
          .in("date", [yesterday, today])
          .in("project_id", projectIds);
        const dayLocByKey = new Map(
          (dayLocs ?? []).map((d) => [`${d.project_id}_${d.date}`, d.location as "in_house" | "site"])
        );

        let result: TodayProject[] = filteredAssignments.map((a) => {
          const project = a.projects as { name?: string; site_address?: string | null; site_latitude?: number | null; site_longitude?: number | null; site_gps_radius?: number | null } | null;
          const key = `${a.project_id}_${a.date}`;
          const session = sessionByKey.get(key);
          const explicitLoc = (a.work_location as "in_house" | "site" | null) ?? dayLocByKey.get(key) ?? null;
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
            workStartTime: session?.work_start_time ?? null,
            workEndTime: session?.work_end_time ?? null,
            breakMinutes: diffMinutes(session?.break_start_time, session?.break_end_time),
            assignedRole: a.assigned_role ?? "team_member",
            workLocation,
            task: (a as any).task ?? null,
            date: a.date,
            isOvernightCarry: a.date !== today,
          };
        });

        // Order: live/unfinished carry-overs first, then by shift start.
        result.sort((x, y) => {
          if (x.isOvernightCarry !== y.isOvernightCarry) return x.isOvernightCarry ? -1 : 1;
          return (x.shiftStart ?? "").localeCompare(y.shiftStart ?? "");
        });

        // Authoritative mobile fallback: the backend function returns the same
        // effective location used by workflow actions. This overwrites stale or
        // RLS-missed client inference (BG002 case: schedule says Site, project
        // has no GPS coords, old cache said In-House). Only applies to today's
        // rows — the function only resolves today's assignment.
        try {
          const effective = await invokeEdge<{
            assigned?: boolean;
            work_location?: "in_house" | "site" | null;
            project?: { id?: string | null } | null;
          }>("today-assignment", { employee_id: employee.id });
          if (effective?.assigned && effective.project?.id && effective.work_location) {
            result = result.map((project) => project.projectId === effective.project?.id && !project.isOvernightCarry
              ? { ...project, workLocation: effective.work_location ?? project.workLocation }
              : project);
          }
        } catch { /* direct table result remains the fallback */ }

        if (cacheKey) await cacheData(cacheKey, result);
        // Seed per-project work-location cache so useProjectWorkflow knows
        // in_house vs site even if the user opens the project card for the
        // first time while offline (otherwise it defaults to site/travel flow).
        // Keyed by the assignment's own date so overnight carry-overs match.
        try {
          result.forEach((r) => {
            // Always seed the cache so offline never falls back to the site
            // travel flow by accident. If no explicit work_location is set,
            // infer from the project: no site coords → in-house; otherwise site.
            const inferred = r.workLocation
              ?? (r.siteLat == null && r.siteLng == null ? "in_house" : "site");
            localStorage.setItem(
              `pwl_${employee.id}_${r.projectId}_${r.date}`,
              JSON.stringify(inferred),
            );
            localStorage.setItem(
              `pwl_v2_${employee.id}_${r.projectId}_${r.date}`,
              JSON.stringify(inferred),
            );
          });
        } catch { /* ignore */ }
        return overlaySessionCache(result);
      } catch (err) {
        // Network/auth failure → fall back to cached snapshot if we have one
        if (cacheKey) {
          const cached = await getCachedData<TodayProject[]>(cacheKey);
          if (cached) return overlaySessionCache(cached.data);
        }
        throw err;
      }
    },
  });
}

