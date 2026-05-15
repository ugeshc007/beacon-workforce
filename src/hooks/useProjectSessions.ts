import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ProjectWorkSession {
  id: string;
  attendance_log_id: string;
  project_id: string;
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
  projects?: { name: string | null } | null;
}

export function useProjectSessions(attendanceLogId: string | null | undefined) {
  return useQuery({
    queryKey: ["project-sessions", attendanceLogId],
    enabled: !!attendanceLogId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_work_sessions")
        .select("*, projects(name)")
        .eq("attendance_log_id", attendanceLogId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as ProjectWorkSession[];
    },
  });
}
