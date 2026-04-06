import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert } from "@/integrations/supabase/types";

export function useCreateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (expense: TablesInsert<"project_expenses">) => {
      const { data, error } = await supabase
        .from("project_expenses")
        .insert(expense)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["project-expenses", vars.project_id] });
      qc.invalidateQueries({ queryKey: ["project-costs", vars.project_id] });
      qc.invalidateQueries({ queryKey: ["project-stats", vars.project_id] });
    },
  });
}

export function useApproveExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      expenseId,
      projectId,
      status,
      notes,
    }: {
      expenseId: string;
      projectId: string;
      status: "approved" | "rejected";
      notes?: string;
    }) => {
      const { error } = await supabase
        .from("project_expenses")
        .update({
          status,
          approval_notes: notes ?? null,
        })
        .eq("id", expenseId);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["project-expenses", vars.projectId] });
      qc.invalidateQueries({ queryKey: ["project-costs", vars.projectId] });
      qc.invalidateQueries({ queryKey: ["project-stats", vars.projectId] });
    },
  });
}
