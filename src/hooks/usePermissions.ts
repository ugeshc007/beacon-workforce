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

export interface SkillPermission {
  id: string;
  custom_skill_id: string;
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

export function useSkillPermissions() {
  return useQuery({
    queryKey: ["skill-permissions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("skill_permissions")
        .select("*")
        .order("module");
      if (error) throw error;
      return (data ?? []) as SkillPermission[];
    },
  });
}

/** Returns the current user's effective permissions (role AND skill — strict mode) */
export function useMyPermissions() {
  const { user } = useAuth();
  const { data: rolePerms, isLoading: l1 } = useRolePermissions();
  const { data: skillPerms, isLoading: l2 } = useSkillPermissions();

  // Get current employee's custom_skill_id (if logged in as employee)
  const { data: myEmployee } = useQuery({
    queryKey: ["my-employee-skill", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("employees")
        .select("custom_skill_id")
        .eq("auth_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const perms = useMemo(() => {
    const map = new Map<string, RolePermission>();
    if (!user?.role || !rolePerms) return map;

    const mySkillId = (myEmployee as any)?.custom_skill_id as string | null | undefined;

    for (const p of rolePerms) {
      if (p.role !== user.role) continue;

      // If user has a custom skill, AND its perm with the role perm (strict)
      if (mySkillId && skillPerms) {
        const sp = skillPerms.find((s) => s.custom_skill_id === mySkillId && s.module === p.module);
        if (sp) {
          map.set(p.module, {
            ...p,
            can_view: p.can_view && sp.can_view,
            can_create: p.can_create && sp.can_create,
            can_edit: p.can_edit && sp.can_edit,
            can_delete: p.can_delete && sp.can_delete,
          });
          continue;
        }
      }
      map.set(p.module, p);
    }
    return map;
  }, [rolePerms, skillPerms, user?.role, myEmployee]);

  return { permissions: perms, isLoading: l1 || l2 };
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

export function useUpdateSkillPermission() {
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
        .from("skill_permissions")
        .update(updatePayload)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["skill-permissions"] }),
  });
}
