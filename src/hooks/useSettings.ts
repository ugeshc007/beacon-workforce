import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface SettingsMap {
  [key: string]: string;
}

const SETTING_KEYS = [
  "company_name",
  "company_email",
  "company_phone",
  "currency",
  "timezone",
  "gps_office_radius",
  "gps_site_radius",
  "gps_accuracy_threshold",
  "gps_spoof_detection",
  "standard_work_hours",
  "overtime_multiplier",
  "friday_off",
  "late_threshold_minutes",
  "break_duration_minutes",
  "travel_time_paid",
  "notification_morning_briefing",
  "notification_absent_alert_delay",
  "notification_ot_warning_hours",
  "cron_absent_check_time",
  "cron_morning_briefing_time",
];

export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("settings")
        .select("key, value")
        .in("key", SETTING_KEYS);
      if (error) throw error;
      const map: SettingsMap = {};
      for (const row of data ?? []) {
        map[row.key] = row.value ?? "";
      }
      return map;
    },
  });
}

export function useSaveSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (settings: SettingsMap) => {
      const rows = Object.entries(settings).map(([key, value]) => ({
        key,
        value,
        is_encrypted: false,
      }));
      for (const row of rows) {
        const { error } = await supabase
          .from("settings")
          .upsert(row, { onConflict: "key" });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings"] });
      toast.success("Settings saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useBranchList() {
  return useQuery({
    queryKey: ["branches-full"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("branches")
        .select("*")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateBranch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (branch: { name: string; city?: string; address?: string }) => {
      const { error } = await supabase.from("branches").insert(branch);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["branches-full"] });
      toast.success("Branch created");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateBranch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name: string; city?: string; address?: string }) => {
      const { error } = await supabase.from("branches").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["branches-full"] });
      toast.success("Branch updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
