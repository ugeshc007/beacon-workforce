
-- =====================================================================
-- 1. Companies table
-- =====================================================================
CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  logo_url text,
  primary_color text DEFAULT '#0EA5E9',
  accent_color text DEFAULT '#0F172A',
  currency text NOT NULL DEFAULT 'AED',
  timezone text NOT NULL DEFAULT 'Asia/Dubai',
  locale text NOT NULL DEFAULT 'en',
  contact_email text,
  contact_phone text,
  plan text NOT NULL DEFAULT 'standard',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT companies_slug_format CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,40}$'),
  CONSTRAINT companies_slug_reserved CHECK (slug NOT IN ('app','www','admin','api','auth','static','public','assets'))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.companies TO authenticated;
GRANT ALL ON public.companies TO service_role;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.company_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  key text NOT NULL,
  value text,
  is_encrypted boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_settings TO authenticated;
GRANT ALL ON public.company_settings TO service_role;
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.company_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  module text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  config jsonb DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, module)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_features TO authenticated;
GRANT ALL ON public.company_features TO service_role;
ALTER TABLE public.company_features ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.pending_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  email text NOT NULL,
  role public.user_role NOT NULL,
  branch_id uuid,
  invited_by uuid,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pending_invitations TO authenticated;
GRANT ALL ON public.pending_invitations TO service_role;
ALTER TABLE public.pending_invitations ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- 2. Seed BeBright + backfill
-- =====================================================================
INSERT INTO public.companies (id, name, slug, primary_color, accent_color, currency, timezone, contact_email)
VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid,
  'BeBright', 'bebright',
  '#0EA5E9', '#0F172A', 'AED', 'Asia/Dubai',
  'admin@bebright.global'
);

ALTER TABLE public.branches  ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE RESTRICT;
ALTER TABLE public.users     ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE RESTRICT;
ALTER TABLE public.employees ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE RESTRICT;
ALTER TABLE public.projects  ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE RESTRICT;

UPDATE public.branches  SET company_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE company_id IS NULL;
UPDATE public.users     SET company_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE company_id IS NULL;
UPDATE public.employees SET company_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE company_id IS NULL;
UPDATE public.projects  SET company_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE company_id IS NULL;

ALTER TABLE public.branches  ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.employees ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.projects  ALTER COLUMN company_id SET NOT NULL;
-- users.company_id stays nullable (super_admin has no tenant)

CREATE INDEX idx_branches_company  ON public.branches(company_id);
CREATE INDEX idx_users_company     ON public.users(company_id);
CREATE INDEX idx_employees_company ON public.employees(company_id);
CREATE INDEX idx_projects_company  ON public.projects(company_id);

-- =====================================================================
-- 3. Helper functions
-- =====================================================================
CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT company_id FROM public.users WHERE auth_id = auth.uid() LIMIT 1),
    (SELECT company_id FROM public.employees WHERE auth_id = auth.uid() LIMIT 1)
  )
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.users u ON u.id = ur.user_id
    WHERE u.auth_id = auth.uid() AND ur.role = 'super_admin'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.users u ON u.id = ur.user_id
    WHERE u.auth_id = auth.uid()
      AND ur.role IN ('admin', 'super_admin')
  )
$$;

-- =====================================================================
-- 4. RLS policies for new tables
-- =====================================================================
CREATE POLICY "Super admins manage companies" ON public.companies FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "Users view own company" ON public.companies FOR SELECT TO authenticated
  USING (id = public.get_user_company_id());
CREATE POLICY "Company admins update own company" ON public.companies FOR UPDATE TO authenticated
  USING (id = public.get_user_company_id() AND public.has_role(public.get_user_id(), 'admin'))
  WITH CHECK (id = public.get_user_company_id());

CREATE POLICY "Super admins manage all settings" ON public.company_settings FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "Users read own company settings" ON public.company_settings FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id());
CREATE POLICY "Company admins write own settings" ON public.company_settings FOR ALL TO authenticated
  USING (company_id = public.get_user_company_id() AND public.has_role(public.get_user_id(), 'admin'))
  WITH CHECK (company_id = public.get_user_company_id() AND public.has_role(public.get_user_id(), 'admin'));

CREATE POLICY "Super admins manage all features" ON public.company_features FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "Users read own company features" ON public.company_features FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id());
CREATE POLICY "Company admins write own features" ON public.company_features FOR ALL TO authenticated
  USING (company_id = public.get_user_company_id() AND public.has_role(public.get_user_id(), 'admin'))
  WITH CHECK (company_id = public.get_user_company_id() AND public.has_role(public.get_user_id(), 'admin'));

CREATE POLICY "Super admins manage invitations" ON public.pending_invitations FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "Company admins manage own invitations" ON public.pending_invitations FOR ALL TO authenticated
  USING (company_id = public.get_user_company_id() AND public.has_role(public.get_user_id(), 'admin'))
  WITH CHECK (company_id = public.get_user_company_id() AND public.has_role(public.get_user_id(), 'admin'));

-- =====================================================================
-- 5. Super-admin bypass on key existing tenant tables
-- =====================================================================
CREATE POLICY "Super admin full access" ON public.branches            FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "Super admin full access" ON public.users               FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "Super admin full access" ON public.employees           FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "Super admin full access" ON public.projects            FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "Super admin full access" ON public.offices             FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "Super admin full access" ON public.project_assignments FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "Super admin full access" ON public.attendance_logs     FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "Super admin full access" ON public.settings            FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- =====================================================================
-- 6. Auto-fill company_id triggers
-- =====================================================================
CREATE OR REPLACE FUNCTION public.set_company_id_default()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    NEW.company_id := public.get_user_company_id();
  END IF;
  IF NEW.company_id IS NULL THEN
    NEW.company_id := '00000000-0000-0000-0000-000000000001'::uuid;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_branches_set_company  BEFORE INSERT ON public.branches  FOR EACH ROW EXECUTE FUNCTION public.set_company_id_default();
CREATE TRIGGER trg_employees_set_company BEFORE INSERT ON public.employees FOR EACH ROW EXECUTE FUNCTION public.set_company_id_default();
CREATE TRIGGER trg_projects_set_company  BEFORE INSERT ON public.projects  FOR EACH ROW EXECUTE FUNCTION public.set_company_id_default();

CREATE OR REPLACE FUNCTION public.set_user_company_id_default()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    NEW.company_id := public.get_user_company_id();
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_users_set_company BEFORE INSERT ON public.users FOR EACH ROW EXECUTE FUNCTION public.set_user_company_id_default();

-- Seed default features for BeBright (every module enabled)
INSERT INTO public.company_features (company_id, module, enabled)
SELECT '00000000-0000-0000-0000-000000000001'::uuid, m, true
FROM unnest(ARRAY['dashboard','projects','maintenance','site_visits','employees','schedule','attendance','travel','timesheets','reports','settings']) AS m;
