import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ProjectWorkSession {
  id: string;
  attendance_log_id: string;
  employee_id: string;
  project_id: string;
  date: string;
  status: string | null;
  travel_start_time: string | null;
  travel_start_lat: number | null;
  travel_start_lng: number | null;
  site_arrival_time: string | null;
  site_arrival_lat: number | null;
  site_arrival_lng: number | null;
  site_arrival_distance_m: number | null;
  site_arrival_valid: boolean | null;
  work_start_time: string | null;
  break_start_time: string | null;
  break_end_time: string | null;
  break_minutes: number | null;
  work_end_time: string | null;
  return_travel_start_time: string | null;
  total_work_minutes: number | null;
  overtime_minutes: number | null;
  work_location?: "in_house" | "site" | null;
  projects?: {
    name: string | null;
    site_latitude?: number | null;
    site_longitude?: number | null;
  } | null;
}

export function useProjectSessions(attendanceLogId: string | null | undefined) {
  return useQuery({
    queryKey: ["project-sessions", attendanceLogId],
    enabled: !!attendanceLogId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_work_sessions")
        .select("*, projects(name, site_latitude, site_longitude)")
        .eq("attendance_log_id", attendanceLogId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      const sessions = (data ?? []) as unknown as ProjectWorkSession[];
      const projectIds = Array.from(new Set(sessions.map((s) => s.project_id).filter(Boolean)));
      const employeeId = sessions[0]?.employee_id;
      const sessionDate = sessions[0]?.date;
      if (!employeeId || !sessionDate || projectIds.length === 0) return sessions;

      const [{ data: assignments }, { data: dayLocs }] = await Promise.all([
        supabase
          .from("project_assignments")
          .select("project_id, work_location")
          .eq("employee_id", employeeId)
          .eq("date", sessionDate)
          .in("project_id", projectIds),
        supabase
          .from("project_day_work_locations")
          .select("project_id, location")
          .eq("date", sessionDate)
          .in("project_id", projectIds),
      ]);

      const assignmentLocByProject = new Map<string, "in_house" | "site">();
      for (const assignment of assignments ?? []) {
        if (assignment.work_location && !assignmentLocByProject.has(assignment.project_id)) {
          assignmentLocByProject.set(assignment.project_id, assignment.work_location as "in_house" | "site");
        }
      }
      const dayLocByProject = new Map(
        (dayLocs ?? []).map((d: any) => [d.project_id, d.location as "in_house" | "site"]),
      );

      return sessions.map((session) => {
        const explicitLoc = assignmentLocByProject.get(session.project_id) ?? dayLocByProject.get(session.project_id) ?? null;
        const project = session.projects;
        const hasCoords = project?.site_latitude != null && project?.site_longitude != null;
        return {
          ...session,
          work_location: explicitLoc ?? (hasCoords ? "site" : "in_house"),
        };
      });
    },
  });
}
