import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMobileAuth } from "@/hooks/useMobileAuth";
import { toLocalDateStr } from "@/lib/utils";
import { cacheData, getCachedData } from "@/lib/offline-queue";

export interface UpcomingProject {
  assignmentId: string;
  date: string; // YYYY-MM-DD
  projectId: string;
  projectName: string;
  siteAddress: string | null;
  shiftStart: string | null;
  shiftEnd: string | null;
  assignedRole: string;
  workLocation: "in_house" | "site" | null;
  task: string | null;
}

/**
 * Returns assignments scheduled for the next `days` days, excluding today.
 * Used to show employees what's coming up tomorrow / later this week.
 */
export function useUpcomingProjects(days = 7) {
  const { employee } = useMobileAuth();
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const end = new Date(today);
  end.setDate(today.getDate() + days);

  const fromDate = toLocalDateStr(tomorrow);
  const toDate = toLocalDateStr(end);

  const cacheKey = employee ? `upcoming_projects_${employee.id}_${days}` : null;

  return useQuery({
    queryKey: ["upcoming-projects", employee?.id, fromDate, toDate],
    enabled: !!employee,
    refetchInterval: 60000,
    staleTime: 60_000,
    queryFn: async (): Promise<UpcomingProject[]> => {
      if (!employee) return [];

      // Offline → return last cached snapshot immediately
      if (typeof navigator !== "undefined" && !navigator.onLine && cacheKey) {
        const cached = await getCachedData<UpcomingProject[]>(cacheKey);
        if (cached) return cached.data;
        return [];
      }

      try {
        const { data: assignments, error } = await supabase
          .from("project_assignments")
          .select(
            "id, date, project_id, shift_start, shift_end, assigned_role, work_location, task, projects(name, site_address)"
          )
          .eq("employee_id", employee.id)
          .gte("date", fromDate)
          .lte("date", toDate)
          .order("date", { ascending: true });

        if (error) throw error;
        if (!assignments?.length) {
          if (cacheKey) await cacheData(cacheKey, []);
          return [];
        }

        const { data: overrides } = await supabase
          .from("daily_team_overrides")
          .select("project_id, date, action")
          .eq("employee_id", employee.id)
          .gte("date", fromDate)
          .lte("date", toDate);

        const cancelled = new Set(
          (overrides ?? [])
            .filter((o) => o.action === "removed" || o.action === "absent")
            .map((o) => `${o.date}__${o.project_id}`)
        );

        const result: UpcomingProject[] = assignments
          .filter((a) => !cancelled.has(`${a.date}__${a.project_id}`))
          .map((a) => {
            const project = a.projects as
              | { name?: string; site_address?: string | null }
              | null;
            return {
              assignmentId: a.id,
              date: a.date,
              projectId: a.project_id,
              projectName: project?.name ?? "Unknown",
              siteAddress: project?.site_address ?? null,
              shiftStart: a.shift_start,
              shiftEnd: a.shift_end,
              assignedRole: a.assigned_role ?? "team_member",
              workLocation: (a.work_location as "in_house" | "site" | null) ?? null,
              task: (a as any).task ?? null,
            };
          });

        if (cacheKey) await cacheData(cacheKey, result);
        return result;
      } catch (err) {
        if (cacheKey) {
          const cached = await getCachedData<UpcomingProject[]>(cacheKey);
          if (cached) return cached.data;
        }
        throw err;
      }
    },
  });
}
