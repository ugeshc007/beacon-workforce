import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMobileAuth } from "@/hooks/useMobileAuth";
import { toLocalDateStr } from "@/lib/utils";
import { invokeEdge } from "@/lib/invoke-edge";
import { enqueueAction } from "@/lib/offline-queue";
import { syncPendingActions } from "@/lib/offline-sync";

async function invokeOrQueue(action_type: string, fnName: string, body: Record<string, unknown>) {
  const clientTimestamp = new Date().toISOString();
  const payload = { client_timestamp: clientTimestamp, ...body };
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    await enqueueAction({ action_type, payload, timestamp: clientTimestamp });
    return { queued: true };
  }
  try {
    return await invokeEdge(fnName, payload);
  } catch (e: any) {
    const msg = (e?.message || "").toLowerCase();
    const isNetwork = msg.includes("network") || msg.includes("fetch") || msg.includes("failed to") || msg.includes("timeout");
    if (isNetwork) {
      await enqueueAction({ action_type, payload, timestamp: clientTimestamp });
      setTimeout(() => { syncPendingActions().catch(() => {}); }, 5000);
      return { queued: true };
    }
    throw e;
  }
}

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
      return await invokeOrQueue("driver_start_trip", "driver-start-trip", { employee_id: employee?.id, ...vars });
    },
    onSuccess: invalidate,
  });

  const arriveSite = useMutation({
    mutationFn: async (vars: { leg_id: string; leg_type: DriverLegType; lat: number; lng: number }) => {
      return await invokeOrQueue("driver_arrive_site", "driver-arrive-site", { employee_id: employee?.id, ...vars });
    },
    onSuccess: invalidate,
  });

  const endLeg = useMutation({
    mutationFn: async (vars: { leg_id: string; lat: number; lng: number }) => {
      return await invokeOrQueue("driver_end_leg", "driver-end-leg", { employee_id: employee?.id, ...vars });
    },
    onSuccess: invalidate,
  });

  const legs = legsQ.data ?? [];
  const activeLeg = legs.find((l) => l.status !== "completed") ?? null;

  return { legs, activeLeg, isLoading: legsQ.isLoading, startTrip, arriveSite, endLeg };
}
