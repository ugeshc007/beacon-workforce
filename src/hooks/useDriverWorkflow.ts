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

const legsCacheKey = (employeeId: string, date: string) => `driver_legs_${employeeId}_${date}`;

export function useDriverLegs(employeeId?: string, date?: string) {
  return useQuery({
    queryKey: ["driver-legs", employeeId, date],
    enabled: !!employeeId && !!date,
    refetchInterval: 15000,
    queryFn: async (): Promise<DriverLeg[]> => {
      // Offline → hydrate from localStorage so optimistic state survives remounts.
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        try {
          const raw = localStorage.getItem(legsCacheKey(employeeId!, date!));
          if (raw) return JSON.parse(raw) as DriverLeg[];
        } catch { /* ignore */ }
        return [];
      }

      // Night-shift support: include legs from today and yesterday.
      const yesterday = date
        ? new Date(new Date(date + "T00:00:00").getTime() - 86_400_000).toISOString().split("T")[0]
        : "";
      const { data, error } = await supabase
        .from("driver_trip_legs")
        .select("id, project_id, leg_number, travel_start_time, site_arrival_time, leg_type, leg_end_time, total_travel_minutes, total_onsite_minutes, status, projects(name)")
        .eq("driver_id", employeeId!)
        .in("date", [date!, yesterday])
        .order("leg_number");

      // Never let a failed read look like "no trips today" — that made the app
      // ask for a new project while trips were already running on the server.
      if (error) {
        // Fallback: retry without the embedded project name.
        const { data: plain, error: plainErr } = await supabase
          .from("driver_trip_legs")
          .select("id, project_id, leg_number, travel_start_time, site_arrival_time, leg_type, leg_end_time, total_travel_minutes, total_onsite_minutes, status")
          .eq("driver_id", employeeId!)
          .in("date", [date!, yesterday])
          .order("leg_number");
        if (plainErr) throw plainErr;
        const fallback: DriverLeg[] = (plain ?? []).map((l: any) => ({ ...l, project_name: "Project" }));
        try { localStorage.setItem(legsCacheKey(employeeId!, date!), JSON.stringify(fallback)); } catch { /* ignore */ }
        return fallback;
      }

      const mapped: DriverLeg[] = (data ?? []).map((l: any) => ({
        ...l,
        project_name: l.projects?.name ?? "Unknown",
      }));
      try { localStorage.setItem(legsCacheKey(employeeId!, date!), JSON.stringify(mapped)); } catch { /* ignore */ }
      return mapped;

    },
  });
}

export function useDriverWorkflow() {
  const { employee } = useMobileAuth();
  const today = toLocalDateStr(new Date());
  const qc = useQueryClient();
  const legsQ = useDriverLegs(employee?.id, today);

  const queryKey = ["driver-legs", employee?.id, today];

  const persist = (legs: DriverLeg[]) => {
    if (!employee?.id) return;
    try { localStorage.setItem(legsCacheKey(employee.id, today), JSON.stringify(legs)); } catch { /* ignore */ }
  };

  const invalidate = () => {
    qc.invalidateQueries({ queryKey });
    qc.invalidateQueries({ queryKey: ["mobile-workflow"] });
  };

  const startTrip = useMutation({
    mutationFn: async (vars: { project_id: string; lat: number; lng: number }) => {
      // Optimistic: append a new traveling leg so UI advances immediately offline too.
      const nowIso = new Date().toISOString();
      const current = qc.getQueryData<DriverLeg[]>(queryKey) ?? [];
      const optimistic: DriverLeg = {
        id: `tmp_${nowIso}`,
        project_id: vars.project_id,
        leg_number: (current.at(-1)?.leg_number ?? 0) + 1,
        travel_start_time: nowIso,
        site_arrival_time: null,
        leg_type: null,
        leg_end_time: null,
        total_travel_minutes: 0,
        total_onsite_minutes: 0,
        status: "traveling",
        project_name: undefined,
      };
      const next = [...current, optimistic];
      qc.setQueryData(queryKey, next);
      persist(next);
      return await invokeOrQueue("driver_start_trip", "driver-start-trip", { employee_id: employee?.id, ...vars });
    },
    onSuccess: invalidate,
  });

  const arriveSite = useMutation({
    mutationFn: async (vars: { leg_id: string; leg_type: DriverLegType; lat: number; lng: number }) => {
      const nowIso = new Date().toISOString();
      const current = qc.getQueryData<DriverLeg[]>(queryKey) ?? [];
      const next = current.map((l) =>
        l.id === vars.leg_id ? { ...l, site_arrival_time: nowIso, leg_type: vars.leg_type, status: "on_site" as DriverLegStatus } : l
      );
      qc.setQueryData(queryKey, next);
      persist(next);
      return await invokeOrQueue("driver_arrive_site", "driver-arrive-site", { employee_id: employee?.id, ...vars });
    },
    onSuccess: invalidate,
  });

  const endLeg = useMutation({
    mutationFn: async (vars: { leg_id: string; lat: number; lng: number }) => {
      const nowIso = new Date().toISOString();
      const current = qc.getQueryData<DriverLeg[]>(queryKey) ?? [];
      const next = current.map((l) =>
        l.id === vars.leg_id ? { ...l, leg_end_time: nowIso, status: "completed" as DriverLegStatus } : l
      );
      qc.setQueryData(queryKey, next);
      persist(next);
      return await invokeOrQueue("driver_end_leg", "driver-end-leg", { employee_id: employee?.id, ...vars });
    },
    onSuccess: invalidate,
  });

  const legs = legsQ.data ?? [];
  const activeLeg = legs.find((l) => l.status !== "completed") ?? null;

  return { legs, activeLeg, isLoading: legsQ.isLoading, startTrip, arriveSite, endLeg };
}
