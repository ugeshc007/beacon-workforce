import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMobileAuth } from "@/hooks/useMobileAuth";
import { useTodayProjects } from "@/hooks/useTodayProjects";

export interface AvailableProject {
  id: string;
  name: string;
  siteAddress: string | null;
  status: string;
}

/**
 * Returns active projects in the employee's branch that the employee is NOT
 * already assigned to today. Used to let an employee voluntarily pick up
 * additional work after their scheduled assignments are done.
 */
export function useAvailableProjects() {
  const { employee } = useMobileAuth();
  const { data: todayProjects } = useTodayProjects();

  return useQuery({
    queryKey: ["available-projects", employee?.id, (todayProjects ?? []).map((p) => p.projectId).join(",")],
    enabled: !!employee,
    queryFn: async (): Promise<AvailableProject[]> => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, site_address, status")
        .in("status", ["in_progress", "on_hold"])
        .order("name");

      if (error) throw error;

      const assignedIds = new Set((todayProjects ?? []).map((p) => p.projectId));
      return (data ?? [])
        .filter((p) => !assignedIds.has(p.id))
        .map((p) => ({
          id: p.id,
          name: p.name,
          siteAddress: p.site_address,
          status: p.status,
        }));
    },
  });
}
