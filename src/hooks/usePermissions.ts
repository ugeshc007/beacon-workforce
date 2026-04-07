import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useMemo } from "react";

export interface RolePermission {
  id: string;
  role: string;
  module: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

export function useRolePermissions() {
  return useQuery({
    queryKey: ["role-permissions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("role_permissions")
        .select("*")
        .order("role")
        .order("module");
      if (error) throw error;
      return (data ?? []) as RolePermission[];
    },
  });
}

/** Returns the current user's permissions as a Map<module, RolePermission> */
export function useMyPermissions() {
  const { user } = useAuth();
  const { data: allPerms, isLoading } = useRolePermissions();

  const perms = useMemo(() => {
    const map = new Map<string, RolePermission>();
    if (!user?.role || !allPerms) return map;
    for (const p of allPerms) {
      if (p.role === user.role) map.set(p.module, p);
    }
    return map;
  }, [allPerms, user?.role]);

  return { permissions: perms, isLoading };
}

/** Check if the current user can perform an action on a module */
export function useCanAccess(module: string, action: "can_view" | "can_create" | "can_edit" | "can_delete" = "can_view") {
  const { user } = useAuth();
  const { permissions, isLoading } = useMyPermissions();

  // Admins always have full access
  if (user?.role === "admin") return { allowed: true, isLoading };

  const perm = permissions.get(module);
  return { allowed: perm?.[action] ?? false, isLoading };
}

export function useUpdatePermission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      field,
      value,
    }: {
      id: string;
      field: "can_view" | "can_create" | "can_edit" | "can_delete";
      value: boolean;
    }) => {
      const updatePayload: { can_view?: boolean; can_create?: boolean; can_edit?: boolean; can_delete?: boolean; updated_at: string } = { updated_at: new Date().toISOString() };
      updatePayload[field] = value;
      const { error } = await supabase
        .from("role_permissions")
        .update(updatePayload)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["role-permissions"] }),
  });
}
