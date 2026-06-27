
-- 1) custom_skills: tenant-scoped read
DROP POLICY IF EXISTS "Authenticated can view custom skills" ON public.custom_skills;
CREATE POLICY "Users view own company custom skills"
  ON public.custom_skills
  FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin()
    OR created_by IS NULL
    OR public.company_of_user(created_by) = public.get_user_company_id()
  );

-- 2) project_templates: tenant-scoped read
DROP POLICY IF EXISTS "Authenticated can view templates" ON public.project_templates;
CREATE POLICY "Users view own company templates"
  ON public.project_templates
  FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin()
    OR created_by IS NULL
    OR public.company_of_user(created_by) = public.get_user_company_id()
  );

-- 3) settings: admins only (global key/value table, no company_id)
DROP POLICY IF EXISTS "Authenticated can read settings" ON public.settings;
CREATE POLICY "Admins can read settings"
  ON public.settings
  FOR SELECT
  TO authenticated
  USING (public.is_admin() OR public.is_super_admin());

-- 4) SECURITY DEFINER hardening: revoke EXECUTE from anon/authenticated on
--    internal trigger/cron/cleanup helpers that should never be called from the API.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.seed_skill_permissions() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_employee_sensitive_update() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_company_id_default() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_user_company_id_default() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_site_visits_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_pws_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_idempotency_keys() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_absent_check_cron(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_morning_briefing_cron(text) FROM PUBLIC, anon, authenticated;

-- 5) Revoke anon EXECUTE on RLS helper + admin RPC functions
--    (authenticated must keep EXECUTE because RLS policies invoke them).
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_super_admin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_company_admin(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, user_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_company_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_branch_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.company_of_branch(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.company_of_employee(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.company_of_maintenance_call(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.company_of_project(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.company_of_site_visit(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.company_of_user(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.employee_has_project_assignment(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.delete_employee_cascade(uuid) FROM PUBLIC, anon;

-- resolve_tenant must remain callable by anon (used on login screen before auth).
GRANT EXECUTE ON FUNCTION public.resolve_tenant(text, text) TO anon, authenticated;
