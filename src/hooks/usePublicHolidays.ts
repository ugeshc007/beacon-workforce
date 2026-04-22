import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

export type PublicHoliday = Tables<"public_holidays"> & {
  branches?: { name: string } | null;
};

export function usePublicHolidays() {
  return useQuery({
    queryKey: ["public_holidays"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("public_holidays")
        .select("*, branches(name)")
        .order("date", { ascending: false });
      if (error) throw error;
      return data as PublicHoliday[];
    },
  });
}

export function useCreatePublicHoliday() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: TablesInsert<"public_holidays">) => {
      const { error } = await supabase.from("public_holidays").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["public_holidays"] });
      toast.success("Holiday added");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdatePublicHoliday() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: { id: string } & Partial<PublicHoliday>) => {
      const { branches: _b, ...rest } = patch as any;
      const { error } = await supabase.from("public_holidays").update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["public_holidays"] });
      toast.success("Holiday updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeletePublicHoliday() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("public_holidays").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["public_holidays"] });
      toast.success("Holiday deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
