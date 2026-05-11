import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type WorkLocation = "in_house" | "site";

export function useDayWorkLocation(projectId: string, date: string) {
  return useQuery({
    queryKey: ["day-work-location", projectId, date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_day_work_locations")
        .select("location")
        .eq("project_id", projectId)
        .eq("date", date)
        .maybeSingle();
      if (error) throw error;
      return (data?.location ?? null) as WorkLocation | null;
    },
    enabled: !!projectId && !!date,
  });
}

export function useSetDayWorkLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { projectId: string; date: string; location: WorkLocation }) => {
      const { error } = await supabase
        .from("project_day_work_locations")
        .upsert(
          { project_id: vars.projectId, date: vars.date, location: vars.location, updated_at: new Date().toISOString() },
          { onConflict: "project_id,date" },
        );
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["day-work-location", vars.projectId, vars.date] });
      qc.invalidateQueries({ queryKey: ["schedule-report-work-locations"] });
      qc.invalidateQueries({ queryKey: ["project-labor-breakdown"] });
    },
  });
}
