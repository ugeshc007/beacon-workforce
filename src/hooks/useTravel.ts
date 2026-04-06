import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TravelLog {
  id: string;
  employee_id: string;
  employee_name: string;
  employee_code: string;
  project_id: string | null;
  project_name: string;
  date: string;
  travel_start_time: string | null;
  travel_start_lat: number | null;
  travel_start_lng: number | null;
  site_arrival_time: string | null;
  site_arrival_lat: number | null;
  site_arrival_lng: number | null;
  site_arrival_distance_m: number | null;
  site_arrival_valid: boolean | null;
  duration_minutes: number | null;
  shift_start: string | null;
  expected_arrival: string | null;
  is_delayed: boolean;
}

function todayUAE(): string {
  const now = new Date();
  const uae = new Date(now.getTime() + 4 * 60 * 60 * 1000);
  return uae.toISOString().split("T")[0];
}

export function useTravelLogs(filters: { date: string; projectId?: string; search?: string; delayOnly?: boolean }) {
  return useQuery({
    queryKey: ["travel-logs", filters],
    queryFn: async () => {
      let query = supabase
        .from("attendance_logs")
        .select("id, employee_id, project_id, date, travel_start_time, travel_start_lat, travel_start_lng, site_arrival_time, site_arrival_lat, site_arrival_lng, site_arrival_distance_m, site_arrival_valid, employees(name, employee_code), projects(name)")
        .eq("date", filters.date)
        .not("travel_start_time", "is", null)
        .order("travel_start_time", { ascending: true });

      if (filters.projectId && filters.projectId !== "all") {
        query = query.eq("project_id", filters.projectId);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Get assignments with shift_start for expected arrival calc
      const { data: assignments } = await supabase
        .from("project_assignments")
        .select("employee_id, shift_start")
        .eq("date", filters.date);

      const shiftMap = new Map((assignments ?? []).map((a) => [a.employee_id, a.shift_start]));

      // Get delay threshold from settings
      const { data: settings } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "travel_delay_threshold_minutes")
        .maybeSingle();
      const delayThreshold = parseInt(settings?.value ?? "30", 10);

      let results: TravelLog[] = (data ?? []).map((row: any) => {
        const emp = row.employees;
        const proj = row.projects;
        const shiftStart = shiftMap.get(row.employee_id);

        let durationMin: number | null = null;
        if (row.travel_start_time && row.site_arrival_time) {
          durationMin = Math.round((new Date(row.site_arrival_time).getTime() - new Date(row.travel_start_time).getTime()) / 60000);
        }

        // Expected arrival = shift_start or travel_start + threshold
        let expectedArrival: string | null = null;
        let isDelayed = false;

        if (row.travel_start_time) {
          const travelStart = new Date(row.travel_start_time);
          expectedArrival = new Date(travelStart.getTime() + delayThreshold * 60000).toISOString();

          if (row.site_arrival_time) {
            isDelayed = new Date(row.site_arrival_time).getTime() > new Date(expectedArrival).getTime();
          } else {
            // Still traveling — check if exceeded threshold
            isDelayed = Date.now() > new Date(expectedArrival).getTime();
          }
        }

        return {
          id: row.id,
          employee_id: row.employee_id,
          employee_name: emp?.name ?? "Unknown",
          employee_code: emp?.employee_code ?? "",
          project_id: row.project_id,
          project_name: proj?.name ?? "—",
          date: row.date,
          travel_start_time: row.travel_start_time,
          travel_start_lat: row.travel_start_lat ? Number(row.travel_start_lat) : null,
          travel_start_lng: row.travel_start_lng ? Number(row.travel_start_lng) : null,
          site_arrival_time: row.site_arrival_time,
          site_arrival_lat: row.site_arrival_lat ? Number(row.site_arrival_lat) : null,
          site_arrival_lng: row.site_arrival_lng ? Number(row.site_arrival_lng) : null,
          site_arrival_distance_m: row.site_arrival_distance_m ? Number(row.site_arrival_distance_m) : null,
          site_arrival_valid: row.site_arrival_valid,
          duration_minutes: durationMin,
          shift_start: shiftStart ?? null,
          expected_arrival: expectedArrival,
          is_delayed: isDelayed,
        };
      });

      if (filters.search) {
        const s = filters.search.toLowerCase();
        results = results.filter((r) => r.employee_name.toLowerCase().includes(s) || r.employee_code.toLowerCase().includes(s));
      }
      if (filters.delayOnly) {
        results = results.filter((r) => r.is_delayed);
      }

      return results;
    },
    refetchInterval: 30000,
  });
}

/** Employees currently traveling (for dashboard map) */
export function useTravelingNow() {
  const today = todayUAE();
  return useQuery({
    queryKey: ["traveling-now", today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_logs")
        .select("id, employee_id, travel_start_time, travel_start_lat, travel_start_lng, site_arrival_time, employees(name), projects(name, site_latitude, site_longitude)")
        .eq("date", today)
        .not("travel_start_time", "is", null)
        .is("site_arrival_time", null);

      if (error) throw error;

      return (data ?? []).map((row: any) => ({
        employee_id: row.employee_id,
        employee_name: row.employees?.name ?? "Unknown",
        project_name: row.projects?.name ?? "Unknown",
        lat: row.travel_start_lat ? Number(row.travel_start_lat) : null,
        lng: row.travel_start_lng ? Number(row.travel_start_lng) : null,
        dest_lat: row.projects?.site_latitude ? Number(row.projects.site_latitude) : null,
        dest_lng: row.projects?.site_longitude ? Number(row.projects.site_longitude) : null,
        travel_start: row.travel_start_time,
      }));
    },
    refetchInterval: 15000,
  });
}
