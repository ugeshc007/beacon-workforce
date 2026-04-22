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
  "gps_mode",
  "google_maps_api_key",
  "google_maps_enabled",
  "standard_work_hours",
  "overtime_multiplier",
  "friday_off",
  "weekly_off_day",
  "late_threshold_minutes",
  "break_duration_minutes",
  "travel_time_paid",
  "travel_delay_threshold_minutes",
  "office_punch_in_mandatory",
  "late_work_start_threshold_minutes",
  "notification_morning_briefing",
  "notification_absent_alert_delay",
  "notification_ot_warning_hours",
  "notification_absent_inapp",
  "notification_late_inapp",
  "notification_ot_inapp",
  "notification_shortage_inapp",
  "escalation_delay_minutes",
  "cron_absent_check_time",
  "cron_morning_briefing_time",
  "expense_approval_threshold",
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

export function useSystemAuditLog(filters?: { module?: string; dateFrom?: string; dateTo?: string }) {
  return useQuery({
    queryKey: ["system-audit-log", filters],
    queryFn: async () => {
      let q = supabase
        .from("system_audit_log")
        .select("*, users:user_id(name)")
        .order("created_at", { ascending: false })
        .limit(100);
      if (filters?.module && filters.module !== "all") q = q.eq("module", filters.module);
      if (filters?.dateFrom) q = q.gte("created_at", filters.dateFrom);
      if (filters?.dateTo) q = q.lte("created_at", filters.dateTo + "T23:59:59");
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAssignmentAuditLog(filters?: { dateFrom?: string; dateTo?: string }) {
  return useQuery({
    queryKey: ["assignment-audit-log", filters],
    queryFn: async () => {
      let q = supabase
        .from("assignment_audit_log")
        .select("*, projects:project_id(name), users:changed_by(name)")
        .order("created_at", { ascending: false })
        .limit(100);
      if (filters?.dateFrom) q = q.gte("created_at", filters.dateFrom);
      if (filters?.dateTo) q = q.lte("created_at", filters.dateTo + "T23:59:59");
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
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

// ─── Offices ────────────────────────────────────────────────
export function useOffices(branchId?: string) {
  return useQuery({
    queryKey: ["offices", branchId],
    enabled: !!branchId,
    queryFn: async () => {
      const q = supabase.from("offices").select("*").order("name");
      if (branchId) q.eq("branch_id", branchId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
}

export function useAllOffices() {
  return useQuery({
    queryKey: ["offices-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("offices").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateOffice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { branch_id: string; name: string; address?: string; latitude?: number; longitude?: number; gps_radius_meters?: number }) => {
      const { error } = await supabase.from("offices").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["offices"] });
      qc.invalidateQueries({ queryKey: ["offices-all"] });
      toast.success("Office created");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateOffice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string; name?: string; address?: string; latitude?: number | null; longitude?: number | null; gps_radius_meters?: number }) => {
      const { error } = await supabase.from("offices").update(payload).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["offices"] });
      qc.invalidateQueries({ queryKey: ["offices-all"] });
      toast.success("Office updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteOffice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("offices").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["offices"] });
      qc.invalidateQueries({ queryKey: ["offices-all"] });
      toast.success("Office deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteBranch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // Check for active employees
      const { count: empCount } = await supabase
        .from("employees")
        .select("id", { count: "exact", head: true })
        .eq("branch_id", id)
        .eq("is_active", true);
      if (empCount && empCount > 0) {
        throw new Error(`Cannot delete: ${empCount} active employee(s) belong to this branch`);
      }
      // Check for active projects
      const { count: projCount } = await supabase
        .from("projects")
        .select("id", { count: "exact", head: true })
        .eq("branch_id", id)
        .in("status", ["on_hold", "in_progress"]);
      if (projCount && projCount > 0) {
        throw new Error(`Cannot delete: ${projCount} active project(s) belong to this branch`);
      }
      const { error } = await supabase.from("branches").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["branches-full"] });
      qc.invalidateQueries({ queryKey: ["branches"] });
      toast.success("Branch deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
