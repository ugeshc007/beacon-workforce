import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface MaintenanceCall {
  id: string;
  company_name: string;
  contact_number: string | null;
  location: string | null;
  scope: string | null;
  permit_required: boolean;
  priority: "emergency" | "high" | "normal" | "low";
  status: "open" | "scheduled" | "in_progress" | "completed" | "closed";
  scheduled_date: string | null;
  notes: string | null;
  branch_id: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface MaintenanceAssignment {
  id: string;
  maintenance_call_id: string;
  employee_id: string;
  date: string;
  shift_start: string | null;
  shift_end: string | null;
  assigned_by: string | null;
  created_at: string;
  employees?: { name: string; employee_code: string; skill_type: string } | null;
}

interface Filters {
  search?: string;
  status?: string;
  priority?: string;
}

export function useMaintenanceCalls(filters: Filters = {}) {
  return useQuery({
    queryKey: ["maintenance-calls", filters],
    queryFn: async () => {
      let query = supabase
        .from("maintenance_calls")
        .select("*")
        .order("created_at", { ascending: false });

      if (filters.status && filters.status !== "all") {
        query = query.eq("status", filters.status as any);
      }
      if (filters.priority && filters.priority !== "all") {
        query = query.eq("priority", filters.priority as any);
      }

      const { data, error } = await query;
      if (error) throw error;

      let results = (data ?? []) as unknown as MaintenanceCall[];
      if (filters.search) {
        const s = filters.search.toLowerCase();
        results = results.filter(
          (c) =>
            c.company_name.toLowerCase().includes(s) ||
            c.location?.toLowerCase().includes(s) ||
            c.scope?.toLowerCase().includes(s)
        );
      }
      return results;
    },
  });
}

export function useMaintenanceCall(id: string | null) {
  return useQuery({
    queryKey: ["maintenance-call", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maintenance_calls")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data as unknown as MaintenanceCall;
    },
  });
}

export function useCreateMaintenanceCall() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (call: Omit<MaintenanceCall, "id" | "created_at" | "updated_at">) => {
      const { error } = await supabase.from("maintenance_calls").insert(call as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["maintenance-calls"] }),
  });
}

export function useUpdateMaintenanceCall() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<MaintenanceCall> & { id: string }) => {
      const { error } = await supabase
        .from("maintenance_calls")
        .update({ ...updates, updated_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["maintenance-calls"] });
      qc.invalidateQueries({ queryKey: ["maintenance-call"] });
    },
  });
}

export function useDeleteMaintenanceCall() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("maintenance_calls").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["maintenance-calls"] }),
  });
}

export function useMaintenanceAssignments(callId: string | null) {
  return useQuery({
    queryKey: ["maintenance-assignments", callId],
    enabled: !!callId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maintenance_assignments")
        .select("*, employees(name, employee_code, skill_type)")
        .eq("maintenance_call_id", callId!)
        .order("date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as MaintenanceAssignment[];
    },
  });
}

export function useAssignToMaintenance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      maintenance_call_id: string;
      employee_id: string;
      date: string;
      shift_start?: string;
      shift_end?: string;
    }) => {
      const { error } = await supabase.from("maintenance_assignments").insert(payload as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["maintenance-assignments"] }),
  });
}

export function useRemoveFromMaintenance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("maintenance_assignments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["maintenance-assignments"] }),
  });
}

// ── Maintenance Images ──

export interface MaintenanceImage {
  id: string;
  maintenance_call_id: string;
  file_path: string;
  caption: string | null;
  uploaded_by: string | null;
  created_at: string;
  users?: { name: string } | null;
  signedUrl?: string;
}

export function useMaintenanceImages(callId: string | null) {
  return useQuery({
    queryKey: ["maintenance-images", callId],
    enabled: !!callId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maintenance_images")
        .select("*, users:uploaded_by(name)")
        .eq("maintenance_call_id", callId!)
        .order("created_at", { ascending: false });
      if (error) throw error;

      // Generate signed URLs for all images
      const images = (data ?? []) as unknown as MaintenanceImage[];
      const withUrls = await Promise.all(
        images.map(async (img) => {
          const { data: urlData } = await supabase.storage
            .from("maintenance-images")
            .createSignedUrl(img.file_path, 3600);
          return { ...img, signedUrl: urlData?.signedUrl ?? "" };
        })
      );
      return withUrls;
    },
  });
}

export function useUploadMaintenanceImage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      callId,
      file,
      caption,
      uploadedBy,
    }: {
      callId: string;
      file: File;
      caption?: string;
      uploadedBy?: string;
    }) => {
      const ext = file.name.split(".").pop();
      const path = `${callId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from("maintenance-images")
        .upload(path, file, { upsert: false });
      if (uploadErr) throw uploadErr;

      const { error: dbErr } = await supabase.from("maintenance_images").insert({
        maintenance_call_id: callId,
        file_path: path,
        caption: caption || null,
        uploaded_by: uploadedBy || null,
      } as any);
      if (dbErr) throw dbErr;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["maintenance-images"] }),
  });
}

export function useDeleteMaintenanceImage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, filePath }: { id: string; filePath: string }) => {
      await supabase.storage.from("maintenance-images").remove([filePath]);
      const { error } = await supabase.from("maintenance_images").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["maintenance-images"] }),
  });
}
