import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

export type CustomSkill = Tables<"custom_skills">;

export function useCustomSkills(activeOnly = false) {
  return useQuery({
    queryKey: ["custom_skills", { activeOnly }],
    queryFn: async () => {
      let q = supabase.from("custom_skills").select("*").order("name");
      if (activeOnly) q = q.eq("is_active", true);
      const { data, error } = await q;
      if (error) throw error;
      return data as CustomSkill[];
    },
  });
}

export function useCreateCustomSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: TablesInsert<"custom_skills">) => {
      const { data, error } = await supabase.from("custom_skills").insert(payload).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["custom_skills"] }),
  });
}

export function useUpdateCustomSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: { id: string } & Partial<CustomSkill>) => {
      const { error } = await supabase.from("custom_skills").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["custom_skills"] }),
  });
}

export function useDeleteCustomSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("custom_skills").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["custom_skills"] }),
  });
}
