
-- Helpers: resolve the company of a row via its parent
CREATE OR REPLACE FUNCTION public.company_of_project(_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT company_id FROM public.projects WHERE id = _id
$$;

CREATE OR REPLACE FUNCTION public.company_of_employee(_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT company_id FROM public.employees WHERE id = _id
$$;

CREATE OR REPLACE FUNCTION public.company_of_branch(_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT company_id FROM public.branches WHERE id = _id
$$;

CREATE OR REPLACE FUNCTION public.company_of_user(_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT company_id FROM public.users WHERE id = _id
$$;

CREATE OR REPLACE FUNCTION public.company_of_site_visit(_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT b.company_id FROM public.site_visits sv JOIN public.branches b ON b.id = sv.branch_id WHERE sv.id = _id
$$;

CREATE OR REPLACE FUNCTION public.company_of_maintenance_call(_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT b.company_id FROM public.maintenance_calls mc JOIN public.branches b ON b.id = mc.branch_id WHERE mc.id = _id
$$;

-- Build restrictive isolation policies. Pattern:
--   super_admin bypass OR row's company = caller's company
-- Restrictive => ANDed with all permissive policies, so this can only narrow access.

-- project_id-based
CREATE POLICY "tenant_isolation" ON public.project_assignments AS RESTRICTIVE FOR ALL
  USING (public.is_super_admin() OR public.company_of_project(project_id) = public.get_user_company_id())
  WITH CHECK (public.is_super_admin() OR public.company_of_project(project_id) = public.get_user_company_id());

CREATE POLICY "tenant_isolation" ON public.project_daily_logs AS RESTRICTIVE FOR ALL
  USING (public.is_super_admin() OR public.company_of_project(project_id) = public.get_user_company_id())
  WITH CHECK (public.is_super_admin() OR public.company_of_project(project_id) = public.get_user_company_id());

CREATE POLICY "tenant_isolation" ON public.project_work_sessions AS RESTRICTIVE FOR ALL
  USING (public.is_super_admin() OR public.company_of_project(project_id) = public.get_user_company_id())
  WITH CHECK (public.is_super_admin() OR public.company_of_project(project_id) = public.get_user_company_id());

CREATE POLICY "tenant_isolation" ON public.project_expenses AS RESTRICTIVE FOR ALL
  USING (public.is_super_admin() OR public.company_of_project(project_id) = public.get_user_company_id())
  WITH CHECK (public.is_super_admin() OR public.company_of_project(project_id) = public.get_user_company_id());

CREATE POLICY "tenant_isolation" ON public.project_day_work_locations AS RESTRICTIVE FOR ALL
  USING (public.is_super_admin() OR public.company_of_project(project_id) = public.get_user_company_id())
  WITH CHECK (public.is_super_admin() OR public.company_of_project(project_id) = public.get_user_company_id());

CREATE POLICY "tenant_isolation" ON public.driver_trip_legs AS RESTRICTIVE FOR ALL
  USING (public.is_super_admin() OR public.company_of_project(project_id) = public.get_user_company_id())
  WITH CHECK (public.is_super_admin() OR public.company_of_project(project_id) = public.get_user_company_id());

CREATE POLICY "tenant_isolation" ON public.assignment_audit_log AS RESTRICTIVE FOR ALL
  USING (public.is_super_admin() OR public.company_of_project(project_id) = public.get_user_company_id())
  WITH CHECK (public.is_super_admin() OR public.company_of_project(project_id) = public.get_user_company_id());

-- employee_id-based
CREATE POLICY "tenant_isolation" ON public.attendance_logs AS RESTRICTIVE FOR ALL
  USING (public.is_super_admin() OR public.company_of_employee(employee_id) = public.get_user_company_id())
  WITH CHECK (public.is_super_admin() OR public.company_of_employee(employee_id) = public.get_user_company_id());

CREATE POLICY "tenant_isolation" ON public.travel_pings AS RESTRICTIVE FOR ALL
  USING (public.is_super_admin() OR public.company_of_employee(employee_id) = public.get_user_company_id())
  WITH CHECK (public.is_super_admin() OR public.company_of_employee(employee_id) = public.get_user_company_id());

CREATE POLICY "tenant_isolation" ON public.timesheet_approvals AS RESTRICTIVE FOR ALL
  USING (public.is_super_admin() OR public.company_of_employee(employee_id) = public.get_user_company_id())
  WITH CHECK (public.is_super_admin() OR public.company_of_employee(employee_id) = public.get_user_company_id());

CREATE POLICY "tenant_isolation" ON public.employee_leave AS RESTRICTIVE FOR ALL
  USING (public.is_super_admin() OR public.company_of_employee(employee_id) = public.get_user_company_id())
  WITH CHECK (public.is_super_admin() OR public.company_of_employee(employee_id) = public.get_user_company_id());

CREATE POLICY "tenant_isolation" ON public.employee_notifications AS RESTRICTIVE FOR ALL
  USING (public.is_super_admin() OR public.company_of_employee(employee_id) = public.get_user_company_id())
  WITH CHECK (public.is_super_admin() OR public.company_of_employee(employee_id) = public.get_user_company_id());

CREATE POLICY "tenant_isolation" ON public.device_tokens AS RESTRICTIVE FOR ALL
  USING (public.is_super_admin() OR public.company_of_employee(employee_id) = public.get_user_company_id())
  WITH CHECK (public.is_super_admin() OR public.company_of_employee(employee_id) = public.get_user_company_id());

CREATE POLICY "tenant_isolation" ON public.daily_team_overrides AS RESTRICTIVE FOR ALL
  USING (public.is_super_admin() OR public.company_of_employee(employee_id) = public.get_user_company_id())
  WITH CHECK (public.is_super_admin() OR public.company_of_employee(employee_id) = public.get_user_company_id());

CREATE POLICY "tenant_isolation" ON public.idempotency_keys AS RESTRICTIVE FOR ALL
  USING (public.is_super_admin() OR public.company_of_employee(employee_id) = public.get_user_company_id())
  WITH CHECK (public.is_super_admin() OR public.company_of_employee(employee_id) = public.get_user_company_id());

-- user_id-based
CREATE POLICY "tenant_isolation" ON public.notifications AS RESTRICTIVE FOR ALL
  USING (public.is_super_admin() OR public.company_of_user(user_id) = public.get_user_company_id())
  WITH CHECK (public.is_super_admin() OR public.company_of_user(user_id) = public.get_user_company_id());

CREATE POLICY "tenant_isolation" ON public.system_audit_log AS RESTRICTIVE FOR ALL
  USING (public.is_super_admin() OR public.company_of_user(user_id) = public.get_user_company_id())
  WITH CHECK (public.is_super_admin() OR public.company_of_user(user_id) = public.get_user_company_id());

CREATE POLICY "tenant_isolation" ON public.user_roles AS RESTRICTIVE FOR ALL
  USING (public.is_super_admin() OR public.company_of_user(user_id) = public.get_user_company_id())
  WITH CHECK (public.is_super_admin() OR public.company_of_user(user_id) = public.get_user_company_id());

CREATE POLICY "tenant_isolation" ON public.report_presets AS RESTRICTIVE FOR ALL
  USING (public.is_super_admin() OR public.company_of_user(user_id) = public.get_user_company_id())
  WITH CHECK (public.is_super_admin() OR public.company_of_user(user_id) = public.get_user_company_id());

-- branch_id-based
CREATE POLICY "tenant_isolation" ON public.site_visits AS RESTRICTIVE FOR ALL
  USING (public.is_super_admin() OR public.company_of_branch(branch_id) = public.get_user_company_id())
  WITH CHECK (public.is_super_admin() OR public.company_of_branch(branch_id) = public.get_user_company_id());

CREATE POLICY "tenant_isolation" ON public.maintenance_calls AS RESTRICTIVE FOR ALL
  USING (public.is_super_admin() OR public.company_of_branch(branch_id) = public.get_user_company_id())
  WITH CHECK (public.is_super_admin() OR public.company_of_branch(branch_id) = public.get_user_company_id());

CREATE POLICY "tenant_isolation" ON public.offices AS RESTRICTIVE FOR ALL
  USING (public.is_super_admin() OR public.company_of_branch(branch_id) = public.get_user_company_id())
  WITH CHECK (public.is_super_admin() OR public.company_of_branch(branch_id) = public.get_user_company_id());

CREATE POLICY "tenant_isolation" ON public.public_holidays AS RESTRICTIVE FOR ALL
  USING (public.is_super_admin() OR public.company_of_branch(branch_id) = public.get_user_company_id())
  WITH CHECK (public.is_super_admin() OR public.company_of_branch(branch_id) = public.get_user_company_id());

-- site_visit_id-based
CREATE POLICY "tenant_isolation" ON public.site_visit_photos AS RESTRICTIVE FOR ALL
  USING (public.is_super_admin() OR public.company_of_site_visit(site_visit_id) = public.get_user_company_id())
  WITH CHECK (public.is_super_admin() OR public.company_of_site_visit(site_visit_id) = public.get_user_company_id());

CREATE POLICY "tenant_isolation" ON public.site_visit_work_sessions AS RESTRICTIVE FOR ALL
  USING (public.is_super_admin() OR public.company_of_site_visit(site_visit_id) = public.get_user_company_id())
  WITH CHECK (public.is_super_admin() OR public.company_of_site_visit(site_visit_id) = public.get_user_company_id());

-- maintenance_call_id-based
CREATE POLICY "tenant_isolation" ON public.maintenance_assignments AS RESTRICTIVE FOR ALL
  USING (public.is_super_admin() OR public.company_of_maintenance_call(maintenance_call_id) = public.get_user_company_id())
  WITH CHECK (public.is_super_admin() OR public.company_of_maintenance_call(maintenance_call_id) = public.get_user_company_id());

CREATE POLICY "tenant_isolation" ON public.maintenance_images AS RESTRICTIVE FOR ALL
  USING (public.is_super_admin() OR public.company_of_maintenance_call(maintenance_call_id) = public.get_user_company_id())
  WITH CHECK (public.is_super_admin() OR public.company_of_maintenance_call(maintenance_call_id) = public.get_user_company_id());

-- direct company_id
CREATE POLICY "tenant_isolation" ON public.pending_invitations AS RESTRICTIVE FOR ALL
  USING (public.is_super_admin() OR company_id = public.get_user_company_id())
  WITH CHECK (public.is_super_admin() OR company_id = public.get_user_company_id());
