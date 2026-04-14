import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type DailyLogStatus = "on_hold" | "pending" | "in_progress" | "completed";

export interface DailyLog {
  id: string;
  project_id: string;
  date: string;
  description: string;
  completion_pct: number | null;
  issues: string | null;
  photo_urls: string[];
  posted_by: string | null;
  employee_id: string | null;
  status: DailyLogStatus;
  created_at: string;
  updated_at: string;
  users?: { name: string } | null;
}

export function useDailyLogs(projectId: string | null) {
  return useQuery({
    queryKey: ["daily-logs", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_daily_logs")
        .select("*, users(name)")
        .eq("project_id", projectId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as DailyLog[];
    },
  });
}

export function useCreateDailyLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (log: {
      project_id: string;
      description: string;
      date?: string;
      completion_pct?: number | null;
      issues?: string | null;
      photo_urls?: string[];
      posted_by?: string | null;
      employee_id?: string | null;
      status?: string;
    }) => {
      const { error } = await supabase.from("project_daily_logs").insert(log as any);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["daily-logs", vars.project_id] });
    },
  });
}

export function useUpdateDailyLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, projectId, ...updates }: {
      id: string;
      projectId: string;
      description?: string;
      completion_pct?: number | null;
      issues?: string | null;
      photo_urls?: string[];
      status?: string;
    }) => {
      const { error } = await supabase.from("project_daily_logs").update(updates as any).eq("id", id);
      if (error) throw error;
      return projectId;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["daily-logs", vars.projectId] });
    },
  });
}

export function useDeleteDailyLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, projectId }: { id: string; projectId: string }) => {
      const { error } = await supabase.from("project_daily_logs").delete().eq("id", id);
      if (error) throw error;
      return projectId;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["daily-logs", vars.projectId] });
    },
  });
}

export async function uploadDailyLogPhoto(file: File, projectId: string): Promise<string> {
  const ext = file.name.split(".").pop();
  const path = `${projectId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("daily-log-photos").upload(path, file);
  if (error) throw error;
  const { data } = supabase.storage.from("daily-log-photos").getPublicUrl(path);
  return data.publicUrl;
}
