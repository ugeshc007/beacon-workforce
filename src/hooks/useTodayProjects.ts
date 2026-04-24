import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMobileAuth } from "@/hooks/useMobileAuth";
import { toLocalDateStr } from "@/lib/utils";
import { deriveProjectStep, ProjectStep } from "@/lib/project-workflow-engine";

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
}

/** Returns ALL today's project assignments + their session state */
export function useTodayProjects() {
  const { employee } = useMobileAuth();
  const today = toLocalDateStr(new Date());

  return useQuery({
    queryKey: ["today-projects", employee?.id, today],
    enabled: !!employee,
    refetchInterval: 30000,
    queryFn: async (): Promise<TodayProject[]> => {
      if (!employee) return [];

      const { data: assignments } = await supabase
        .from("project_assignments")
        .select("id, project_id, shift_start, shift_end, projects(name, site_address, site_latitude, site_longitude, site_gps_radius)")
        .eq("employee_id", employee.id)
        .eq("date", today);

      if (!assignments?.length) return [];

      const { data: sessions } = await supabase
        .from("project_work_sessions")
        .select("id, project_id, travel_start_time, site_arrival_time, work_start_time, break_start_time, break_end_time, work_end_time, total_work_minutes")
        .eq("employee_id", employee.id)
        .eq("date", today);

      const sessionByProject = new Map(
        (sessions ?? []).map((s) => [s.project_id, s])
      );

      return assignments.map((a) => {
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
        };
      });
    },
  });
}
