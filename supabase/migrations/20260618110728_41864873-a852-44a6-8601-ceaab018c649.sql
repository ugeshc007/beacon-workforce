
-- Enums
DO $$ BEGIN
  CREATE TYPE public.recurring_frequency AS ENUM ('daily','weekly','monthly','custom');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.recurring_status AS ENUM ('active','paused','ended');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.recurring_occurrence_status AS ENUM ('scheduled','skipped','done','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 1) recurring_jobs
CREATE TABLE public.recurring_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  client_name text NOT NULL,
  site_name text,
  address text,
  lat double precision,
  lng double precision,
  frequency public.recurring_frequency NOT NULL DEFAULT 'weekly',
  days_of_week int[] DEFAULT '{}',           -- 0=Sun .. 6=Sat
  day_of_month int,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  start_time time NOT NULL DEFAULT '08:00',
  end_time time NOT NULL DEFAULT '12:00',
  break_minutes int NOT NULL DEFAULT 0,
  headcount int NOT NULL DEFAULT 1,
  required_skills text[] DEFAULT '{}',
  color text DEFAULT '#0EA5E9',
  notes text,
  skip_holidays boolean NOT NULL DEFAULT true,
  status public.recurring_status NOT NULL DEFAULT 'active',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.recurring_jobs TO authenticated;
GRANT ALL ON public.recurring_jobs TO service_role;
ALTER TABLE public.recurring_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rj_select_same_company"
  ON public.recurring_jobs FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id());

CREATE POLICY "rj_admin_manager_write"
  ON public.recurring_jobs FOR ALL TO authenticated
  USING (
    company_id = public.get_user_company_id()
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.users u ON u.id = ur.user_id
      WHERE u.auth_id = auth.uid() AND ur.role IN ('admin','manager','super_admin')
    )
  )
  WITH CHECK (
    company_id = public.get_user_company_id()
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.users u ON u.id = ur.user_id
      WHERE u.auth_id = auth.uid() AND ur.role IN ('admin','manager','super_admin')
    )
  );

CREATE INDEX idx_recurring_jobs_company ON public.recurring_jobs(company_id);
CREATE INDEX idx_recurring_jobs_status  ON public.recurring_jobs(status);

-- updated_at trigger
CREATE TRIGGER trg_recurring_jobs_updated_at
  BEFORE UPDATE ON public.recurring_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_pws_updated_at();

-- company default
CREATE TRIGGER trg_recurring_jobs_company_default
  BEFORE INSERT ON public.recurring_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_company_id_default();

-- 2) recurring_job_employees
CREATE TABLE public.recurring_job_employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recurring_job_id uuid NOT NULL REFERENCES public.recurring_jobs(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  role text,
  is_lead boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (recurring_job_id, employee_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.recurring_job_employees TO authenticated;
GRANT ALL ON public.recurring_job_employees TO service_role;
ALTER TABLE public.recurring_job_employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rje_select_company"
  ON public.recurring_job_employees FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.recurring_jobs rj
    WHERE rj.id = recurring_job_id AND rj.company_id = public.get_user_company_id()
  ));

CREATE POLICY "rje_admin_manager_write"
  ON public.recurring_job_employees FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.recurring_jobs rj
      WHERE rj.id = recurring_job_id AND rj.company_id = public.get_user_company_id()
    )
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.users u ON u.id = ur.user_id
      WHERE u.auth_id = auth.uid() AND ur.role IN ('admin','manager','super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.recurring_jobs rj
      WHERE rj.id = recurring_job_id AND rj.company_id = public.get_user_company_id()
    )
  );

CREATE INDEX idx_rje_job ON public.recurring_job_employees(recurring_job_id);
CREATE INDEX idx_rje_emp ON public.recurring_job_employees(employee_id);

-- 3) recurring_job_occurrences
CREATE TABLE public.recurring_job_occurrences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recurring_job_id uuid NOT NULL REFERENCES public.recurring_jobs(id) ON DELETE CASCADE,
  occurrence_date date NOT NULL,
  status public.recurring_occurrence_status NOT NULL DEFAULT 'scheduled',
  project_assignment_id uuid REFERENCES public.project_assignments(id) ON DELETE SET NULL,
  notes text,
  generated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (recurring_job_id, occurrence_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.recurring_job_occurrences TO authenticated;
GRANT ALL ON public.recurring_job_occurrences TO service_role;
ALTER TABLE public.recurring_job_occurrences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rjo_select_company"
  ON public.recurring_job_occurrences FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.recurring_jobs rj
    WHERE rj.id = recurring_job_id AND rj.company_id = public.get_user_company_id()
  ));

CREATE POLICY "rjo_admin_manager_write"
  ON public.recurring_job_occurrences FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.recurring_jobs rj
      WHERE rj.id = recurring_job_id AND rj.company_id = public.get_user_company_id()
    )
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.users u ON u.id = ur.user_id
      WHERE u.auth_id = auth.uid() AND ur.role IN ('admin','manager','super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.recurring_jobs rj
      WHERE rj.id = recurring_job_id AND rj.company_id = public.get_user_company_id()
    )
  );

CREATE TRIGGER trg_rjo_updated_at
  BEFORE UPDATE ON public.recurring_job_occurrences
  FOR EACH ROW EXECUTE FUNCTION public.update_pws_updated_at();

CREATE INDEX idx_rjo_job_date ON public.recurring_job_occurrences(recurring_job_id, occurrence_date);
CREATE INDEX idx_rjo_date ON public.recurring_job_occurrences(occurrence_date);
