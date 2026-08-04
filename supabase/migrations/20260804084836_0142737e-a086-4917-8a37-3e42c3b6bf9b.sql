-- Status enum
CREATE TYPE public.common_task_status AS ENUM ('in_progress', 'completed');

-- ── common_tasks ──
CREATE TABLE public.common_tasks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  priority text NOT NULL DEFAULT 'normal',
  max_headcount integer NOT NULL DEFAULT 5,
  status public.common_task_status NOT NULL DEFAULT 'in_progress',
  is_seeded boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.common_tasks TO authenticated;
GRANT ALL ON public.common_tasks TO service_role;

ALTER TABLE public.common_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can view common tasks"
  ON public.common_tasks FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id() OR public.is_super_admin());

CREATE POLICY "Admins can insert common tasks"
  ON public.common_tasks FOR INSERT TO authenticated
  WITH CHECK (
    company_id = public.get_user_company_id()
    AND (
      public.has_role(public.get_user_id(), 'admin')
      OR public.has_role(public.get_user_id(), 'manager')
      OR public.is_super_admin()
    )
  );

CREATE POLICY "Admins can update common tasks"
  ON public.common_tasks FOR UPDATE TO authenticated
  USING (
    company_id = public.get_user_company_id()
    AND (
      public.has_role(public.get_user_id(), 'admin')
      OR public.has_role(public.get_user_id(), 'manager')
      OR public.is_super_admin()
    )
  );

CREATE POLICY "Admins can delete common tasks"
  ON public.common_tasks FOR DELETE TO authenticated
  USING (
    company_id = public.get_user_company_id()
    AND (
      public.has_role(public.get_user_id(), 'admin')
      OR public.has_role(public.get_user_id(), 'manager')
      OR public.is_super_admin()
    )
  );

CREATE TRIGGER trg_common_tasks_updated_at
  BEFORE UPDATE ON public.common_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_pws_updated_at();

CREATE INDEX idx_common_tasks_company_status ON public.common_tasks(company_id, status);

-- ── common_task_sessions ──
CREATE TABLE public.common_task_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  common_task_id uuid NOT NULL REFERENCES public.common_tasks(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  attendance_log_id uuid REFERENCES public.attendance_logs(id) ON DELETE SET NULL,
  date date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Dubai')::date,
  work_start_time timestamptz,
  break_start_time timestamptz,
  break_end_time timestamptz,
  work_end_time timestamptz,
  break_minutes integer DEFAULT 0,
  total_work_minutes integer,
  overtime_minutes integer,
  regular_cost numeric,
  overtime_cost numeric,
  status text NOT NULL DEFAULT 'working',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.common_task_sessions TO authenticated;
GRANT ALL ON public.common_task_sessions TO service_role;

ALTER TABLE public.common_task_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees can view own common task sessions"
  ON public.common_task_sessions FOR SELECT TO authenticated
  USING (
    employee_id IN (SELECT id FROM public.employees WHERE auth_id = auth.uid())
    OR public.company_of_employee(employee_id) = public.get_user_company_id()
    OR public.is_super_admin()
  );

CREATE POLICY "Employees can insert own common task sessions"
  ON public.common_task_sessions FOR INSERT TO authenticated
  WITH CHECK (
    employee_id IN (SELECT id FROM public.employees WHERE auth_id = auth.uid())
    OR (
      public.company_of_employee(employee_id) = public.get_user_company_id()
      AND (
        public.has_role(public.get_user_id(), 'admin')
        OR public.has_role(public.get_user_id(), 'manager')
      )
    )
  );

CREATE POLICY "Employees can update own common task sessions"
  ON public.common_task_sessions FOR UPDATE TO authenticated
  USING (
    employee_id IN (SELECT id FROM public.employees WHERE auth_id = auth.uid())
    OR (
      public.company_of_employee(employee_id) = public.get_user_company_id()
      AND (
        public.has_role(public.get_user_id(), 'admin')
        OR public.has_role(public.get_user_id(), 'manager')
      )
    )
  );

CREATE POLICY "Admins can delete common task sessions"
  ON public.common_task_sessions FOR DELETE TO authenticated
  USING (
    public.company_of_employee(employee_id) = public.get_user_company_id()
    AND (
      public.has_role(public.get_user_id(), 'admin')
      OR public.has_role(public.get_user_id(), 'manager')
      OR public.is_super_admin()
    )
  );

CREATE TRIGGER trg_common_task_sessions_updated_at
  BEFORE UPDATE ON public.common_task_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_pws_updated_at();

CREATE INDEX idx_cts_task ON public.common_task_sessions(common_task_id, date);
CREATE INDEX idx_cts_employee_date ON public.common_task_sessions(employee_id, date);

-- ── Seed Warehouse / Showroom tasks per company ──
INSERT INTO public.common_tasks (company_id, title, description, priority, max_headcount, is_seeded)
SELECT c.id, 'Warehouse Arrangements', 'Warehouse organisation, stock arrangement and general upkeep.', 'normal', 10, true
FROM public.companies c;

INSERT INTO public.common_tasks (company_id, title, description, priority, max_headcount, is_seeded)
SELECT c.id, 'Showroom Arrangements', 'Showroom setup, display arrangement and presentation work.', 'normal', 10, true
FROM public.companies c;