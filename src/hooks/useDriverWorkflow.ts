import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMobileAuth } from "@/hooks/useMobileAuth";
import { toLocalDateStr } from "@/lib/utils";

export type DriverLegType = "drop_off" | "pick_up" | "wait";
export type DriverLegStatus = "traveling" | "on_site" | "completed";

export interface DriverLeg {
  id: string;
  project_id: string;
  leg_number: number;
  travel_start_time: string | null;
  site_arrival_time: string | null;
  leg_type: DriverLegType | null;
  leg_end_time: string | null;
  total_travel_minutes: number;
  total_onsite_minutes: number;
  status: DriverLegStatus;
  project_name?: string;
}

export function useDriverLegs(employeeId?: string, date?: string) {
  return useQuery({
    queryKey: ["driver-legs", employeeId, date],
    enabled: !!employeeId && !!date,
    refetchInterval: 15000,
    queryFn: async (): Promise<DriverLeg[]> => {
      const { data } = await supabase
        .from("driver_trip_legs")
        .select("id, project_id, leg_number, travel_start_time, site_arrival_time, leg_type, leg_end_time, total_travel_minutes, total_onsite_minutes, status, projects(name)")
        .eq("driver_id", employeeId!)
        .eq("date", date!)
        .order("leg_number");
      return (data ?? []).map((l: any) => ({
        ...l,
        project_name: l.projects?.name ?? "Unknown",
      }));
    },
  });
}

export function useDriverWorkflow() {
  const { employee } = useMobileAuth();
  const today = toLocalDateStr(new Date());
  const qc = useQueryClient();
  const legsQ = useDriverLegs(employee?.id, today);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["driver-legs", employee?.id, today] });
    qc.invalidateQueries({ queryKey: ["mobile-workflow"] });
  };

  const startTrip = useMutation({
    mutationFn: async (vars: { project_id: string; lat: number; lng: number }) => {
      const { data, error } = await supabase.functions.invoke("driver-start-trip", {
        body: { employee_id: employee?.id, ...vars },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: invalidate,
  });

  const arriveSite = useMutation({
    mutationFn: async (vars: { leg_id: string; leg_type: DriverLegType; lat: number; lng: number }) => {
      const { data, error } = await supabase.functions.invoke("driver-arrive-site", {
        body: { employee_id: employee?.id, ...vars },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: invalidate,
  });

  const endLeg = useMutation({
    mutationFn: async (vars: { leg_id: string; lat: number; lng: number }) => {
      const { data, error } = await supabase.functions.invoke("driver-end-leg", {
        body: { employee_id: employee?.id, ...vars },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: invalidate,
  });

  const legs = legsQ.data ?? [];
  const activeLeg = legs.find((l) => l.status !== "completed") ?? null;

  return { legs, activeLeg, isLoading: legsQ.isLoading, startTrip, arriveSite, endLeg };
}
