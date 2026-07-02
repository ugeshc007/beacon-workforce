
CREATE TABLE public.error_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'mobile',
  severity text NOT NULL DEFAULT 'error',
  category text,
  action text,
  error_code text,
  message text NOT NULL,
  context jsonb DEFAULT '{}'::jsonb,
  route text,
  app_version text,
  build_number text,
  platform text,
  user_agent text,
  network_state text,
  reviewed boolean NOT NULL DEFAULT false,
  reviewed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_error_logs_company_created ON public.error_logs(company_id, created_at DESC);
CREATE INDEX idx_error_logs_employee ON public.error_logs(employee_id, created_at DESC);
CREATE INDEX idx_error_logs_reviewed ON public.error_logs(company_id, reviewed, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.error_logs TO authenticated;
GRANT SELECT, INSERT ON public.error_logs TO anon;
GRANT ALL ON public.error_logs TO service_role;

ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated (employees included via auth) can INSERT their own errors
CREATE POLICY "Anyone can insert error logs"
  ON public.error_logs FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

-- Only admins/managers of the same company can view
CREATE POLICY "Admins view company error logs"
  ON public.error_logs FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin()
    OR (
      company_id = public.get_user_company_id()
      AND EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.users u ON u.id = ur.user_id
        WHERE u.auth_id = auth.uid() AND ur.role IN ('admin','manager')
      )
    )
  );

-- Only admins/managers can update (mark reviewed)
CREATE POLICY "Admins update company error logs"
  ON public.error_logs FOR UPDATE
  TO authenticated
  USING (
    public.is_super_admin()
    OR (
      company_id = public.get_user_company_id()
      AND EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.users u ON u.id = ur.user_id
        WHERE u.auth_id = auth.uid() AND ur.role IN ('admin','manager')
      )
    )
  );

-- Auto-fill company_id from the acting employee/user
CREATE OR REPLACE FUNCTION public.set_error_log_company_id()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    IF NEW.employee_id IS NOT NULL THEN
      SELECT company_id INTO NEW.company_id FROM public.employees WHERE id = NEW.employee_id;
    END IF;
    IF NEW.company_id IS NULL THEN
      NEW.company_id := public.get_user_company_id();
    END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_error_logs_company_id
  BEFORE INSERT ON public.error_logs
  FOR EACH ROW EXECUTE FUNCTION public.set_error_log_company_id();
