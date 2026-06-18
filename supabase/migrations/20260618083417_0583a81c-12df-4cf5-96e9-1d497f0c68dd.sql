
-- Helper: admin of a specific company (NOT super_admin — super admin handled by separate policy)
CREATE OR REPLACE FUNCTION public.is_company_admin(_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _company_id IS NOT NULL
     AND _company_id = public.get_user_company_id()
     AND EXISTS (
       SELECT 1 FROM public.user_roles ur
       JOIN public.users u ON u.id = ur.user_id
       WHERE u.auth_id = auth.uid() AND ur.role = 'admin'
     );
$$;

-- PROJECTS
DROP POLICY IF EXISTS "Admins can manage all projects" ON public.projects;
CREATE POLICY "Admins can manage company projects"
  ON public.projects FOR ALL
  USING (public.is_company_admin(company_id))
  WITH CHECK (public.is_company_admin(company_id));

-- EMPLOYEES
DROP POLICY IF EXISTS "Admins can manage all employees" ON public.employees;
CREATE POLICY "Admins can manage company employees"
  ON public.employees FOR ALL
  USING (public.is_company_admin(company_id))
  WITH CHECK (public.is_company_admin(company_id));

-- BRANCHES
DROP POLICY IF EXISTS "Admins can manage all branches" ON public.branches;
DROP POLICY IF EXISTS "Admins can delete branches" ON public.branches;
CREATE POLICY "Admins can manage company branches"
  ON public.branches FOR ALL
  USING (public.is_company_admin(company_id))
  WITH CHECK (public.is_company_admin(company_id));

-- COMPANY FEATURES
DROP POLICY IF EXISTS "Admins can manage all features" ON public.company_features;
CREATE POLICY "Admins can manage own company features"
  ON public.company_features FOR ALL
  USING (public.is_company_admin(company_id))
  WITH CHECK (public.is_company_admin(company_id));

-- COMPANY SETTINGS
DROP POLICY IF EXISTS "Admins can manage all company settings" ON public.company_settings;
CREATE POLICY "Admins can manage own company settings"
  ON public.company_settings FOR ALL
  USING (public.is_company_admin(company_id))
  WITH CHECK (public.is_company_admin(company_id));

-- USERS
DROP POLICY IF EXISTS "Admins can manage all users" ON public.users;
CREATE POLICY "Admins can manage company users"
  ON public.users FOR ALL
  USING (public.is_company_admin(company_id))
  WITH CHECK (public.is_company_admin(company_id));
