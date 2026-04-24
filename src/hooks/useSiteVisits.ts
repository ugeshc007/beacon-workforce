import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type SiteVisit = Tables<"site_visits"> & {
  assigned_employee?: { id: string; name: string; employee_code: string } | null;
  branches?: { name: string } | null;
};

export type SiteVisitPhoto = Tables<"site_visit_photos">;

export function useSiteVisits(filters?: {
  search?: string;
  status?: string;
  employeeId?: string;
  page?: number;
  pageSize?: number;
}) {
  const page = filters?.page ?? 0;
  const pageSize = filters?.pageSize ?? 25;

  return useQuery({
    queryKey: ["site-visits", filters],
    queryFn: async () => {
      let query = supabase
        .from("site_visits")
        .select("*, assigned_employee:employees!site_visits_assigned_employee_id_fkey(id,name,employee_code), branches(name)", { count: "exact" });

      if (filters?.search) {
        const s = `%${filters.search}%`;
        query = query.or(`client_name.ilike.${s},client_contact.ilike.${s},site_address.ilike.${s},project_type.ilike.${s}`);
      }
      if (filters?.status && filters.status !== "all") {
        query = query.eq("status", filters.status as SiteVisit["status"]);
      }
      if (filters?.employeeId && filters.employeeId !== "all") {
        query = query.eq("assigned_employee_id", filters.employeeId);
      }

      query = query.order("visit_date", { ascending: false }).range(page * pageSize, (page + 1) * pageSize - 1);

      const { data, count, error } = await query;
      if (error) throw error;
      return { data: (data ?? []) as SiteVisit[], count: count ?? 0 };
    },
  });
}

export function useSiteVisit(id: string | null) {
  return useQuery({
    queryKey: ["site-visit", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_visits")
        .select("*, assigned_employee:employees!site_visits_assigned_employee_id_fkey(id,name,employee_code), branches(name)")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data as SiteVisit | null;
    },
  });
}

export function useSiteVisitPhotos(siteVisitId: string | null) {
  return useQuery({
    queryKey: ["site-visit-photos", siteVisitId],
    enabled: !!siteVisitId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_visit_photos")
        .select("*")
        .eq("site_visit_id", siteVisitId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as SiteVisitPhoto[];
    },
  });
}

export function useCreateSiteVisit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: TablesInsert<"site_visits">) => {
      const { data, error } = await supabase.from("site_visits").insert(payload).select("*").single();
      if (error) throw error;
      return data as SiteVisit;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["site-visits"] }),
  });
}

export function useUpdateSiteVisit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: { id: string } & TablesUpdate<"site_visits">) => {
      const { data, error } = await supabase.from("site_visits").update(patch).eq("id", id).select("*").single();
      if (error) throw error;
      return data as SiteVisit;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["site-visits"] });
      qc.invalidateQueries({ queryKey: ["site-visit", vars.id] });
    },
  });
}

export function useDeleteSiteVisit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("site_visits").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["site-visits"] }),
  });
}

export function useUploadSiteVisitPhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ siteVisitId, file, caption }: { siteVisitId: string; file: File; caption?: string }) => {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${siteVisitId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("site-visit-photos").upload(path, file, { contentType: file.type });
      if (upErr) throw upErr;

      const { data: userRow } = await supabase.from("users").select("id").eq("auth_id", (await supabase.auth.getUser()).data.user?.id ?? "").maybeSingle();

      const { data, error } = await supabase
        .from("site_visit_photos")
        .insert({ site_visit_id: siteVisitId, file_path: path, caption: caption ?? null, uploaded_by: userRow?.id ?? null })
        .select("*")
        .single();
      if (error) throw error;
      return data as SiteVisitPhoto;
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["site-visit-photos", vars.siteVisitId] }),
  });
}

export function useDeleteSiteVisitPhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, filePath, siteVisitId }: { id: string; filePath: string; siteVisitId: string }) => {
      await supabase.storage.from("site-visit-photos").remove([filePath]);
      const { error } = await supabase.from("site_visit_photos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["site-visit-photos", vars.siteVisitId] }),
  });
}

/** Get a signed URL for a private photo */
export async function getSiteVisitPhotoUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from("site-visit-photos").createSignedUrl(path, 3600);
  if (error) return null;
  return data.signedUrl;
}

/** Convert a completed site visit into a project */
export function useConvertSiteVisitToProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (visit: SiteVisit) => {
      const projectPayload: TablesInsert<"projects"> = {
        branch_id: visit.branch_id,
        name: `${visit.client_name} - ${visit.project_type ?? "Site Visit"}`,
        client_name: visit.client_name,
        client_phone: visit.client_contact,
        client_email: visit.client_email,
        site_address: visit.site_address,
        site_latitude: visit.site_latitude,
        site_longitude: visit.site_longitude,
        notes: [visit.scope_brief, visit.recommendations, visit.employee_notes].filter(Boolean).join("\n\n"),
        status: "on_hold",
      };
      const { data: proj, error: projErr } = await supabase.from("projects").insert(projectPayload).select("*").single();
      if (projErr) throw projErr;

      const { error: updErr } = await supabase
        .from("site_visits")
        .update({ status: "converted", converted_to_project_id: proj.id })
        .eq("id", visit.id);
      if (updErr) throw updErr;

      return proj;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["site-visits"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

/** Mobile: get site visits assigned to current employee */
export function useMySiteVisits(employeeId: string | null) {
  return useQuery({
    queryKey: ["my-site-visits", employeeId],
    enabled: !!employeeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_visits")
        .select("*")
        .eq("assigned_employee_id", employeeId!)
        .order("visit_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SiteVisit[];
    },
  });
}

/** Mobile: today's visits for an employee + their workflow sessions, ordered for sequential execution */
export function useMyTodaySiteVisits(employeeId: string | null) {
  return useQuery({
    queryKey: ["my-today-site-visits", employeeId],
    enabled: !!employeeId,
    refetchInterval: 30000,
    queryFn: async () => {
      const today = new Date();
      const localDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      const { data: visits, error } = await supabase
        .from("site_visits")
        .select("*")
        .eq("assigned_employee_id", employeeId!)
        .eq("visit_date", localDate)
        .order("created_at", { ascending: true });
      if (error) throw error;

      const { data: sessions } = await supabase
        .from("site_visit_work_sessions")
        .select("id, site_visit_id, travel_start_time, site_arrival_time, work_start_time, break_start_time, break_end_time, work_end_time")
        .eq("employee_id", employeeId!)
        .eq("date", localDate);

      const sessionByVisit = new Map<string, NonNullable<typeof sessions>[number]>();
      (sessions ?? []).forEach((s) => sessionByVisit.set(s.site_visit_id, s));

      // Determine which visit (if any) is currently active
      const activeSession = (sessions ?? []).find((s) => !s.work_end_time);

      return ((visits ?? []) as SiteVisit[]).map((v) => {
        const sess = sessionByVisit.get(v.id) ?? null;
        const isCompleted = !!sess?.work_end_time || v.status === "completed";
        const isActive = activeSession?.site_visit_id === v.id;
        const isLocked = !!activeSession && !isActive && !isCompleted;
        return { visit: v, session: sess, isCompleted, isActive, isLocked };
      });
    },
  });
}
