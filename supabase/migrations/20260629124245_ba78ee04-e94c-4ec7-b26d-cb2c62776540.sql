
-- 1. role_permissions: limit SELECT to admin OR rows matching one of caller's roles
DROP POLICY IF EXISTS "Authenticated users can view permissions" ON public.role_permissions;
CREATE POLICY "Users view own role permissions"
ON public.role_permissions FOR SELECT
TO authenticated
USING (
  public.is_admin()
  OR role IN (
    SELECT ur.role FROM public.user_roles ur
    JOIN public.users u ON u.id = ur.user_id
    WHERE u.auth_id = auth.uid()
  )
);

-- 2. skill_permissions: limit SELECT to admin OR caller's own custom_skill
DROP POLICY IF EXISTS "Authenticated can view skill permissions" ON public.skill_permissions;
CREATE POLICY "Users view own skill permissions"
ON public.skill_permissions FOR SELECT
TO authenticated
USING (
  public.is_admin()
  OR custom_skill_id IN (
    SELECT e.custom_skill_id FROM public.employees e
    WHERE e.auth_id = auth.uid() AND e.custom_skill_id IS NOT NULL
  )
);

-- 3. Lock down SECURITY DEFINER functions: revoke from PUBLIC/anon broadly,
-- then revoke from authenticated for admin/cron/trigger-only functions.
-- RLS-helpers (has_role, is_admin, get_user_*, company_of_*, employee_has_project_assignment)
-- remain executable by authenticated because RLS policies invoke them as the caller.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC, anon', r.proname, r.args);
  END LOOP;
END $$;

REVOKE EXECUTE ON FUNCTION public.update_absent_check_cron(text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.update_morning_briefing_cron(text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_employee_cascade(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_idempotency_keys() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.seed_skill_permissions() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_employee_sensitive_update() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.set_company_id_default() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.set_user_company_id_default() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.update_site_visits_updated_at() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.update_pws_updated_at() FROM authenticated;

GRANT EXECUTE ON FUNCTION public.resolve_tenant(text, text) TO anon, authenticated;
