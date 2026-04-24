-- Create project_work_sessions table for per-project time tracking
CREATE TABLE public.project_work_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  attendance_log_id UUID REFERENCES public.attendance_logs(id) ON DELETE SET NULL,

  travel_start_time TIMESTAMPTZ,
  travel_start_lat NUMERIC,
  travel_start_lng NUMERIC,

  site_arrival_time TIMESTAMPTZ,
  site_arrival_lat NUMERIC,
  site_arrival_lng NUMERIC,
  site_arrival_distance_m NUMERIC,
  site_arrival_valid BOOLEAN,

  work_start_time TIMESTAMPTZ,
  break_start_time TIMESTAMPTZ,
  break_end_time TIMESTAMPTZ,
  work_end_time TIMESTAMPTZ,

  return_travel_start_time TIMESTAMPTZ,
  return_travel_start_lat NUMERIC,
  return_travel_start_lng NUMERIC,

  break_minutes INTEGER DEFAULT 0,
  total_work_minutes INTEGER,
  regular_cost NUMERIC,
  overtime_cost NUMERIC,
  overtime_minutes INTEGER DEFAULT 0,

  status TEXT NOT NULL DEFAULT 'in_progress',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enforce: only ONE in-progress session per employee at a time
CREATE UNIQUE INDEX idx_one_active_session_per_employee
  ON public.project_work_sessions (employee_id)
  WHERE work_end_time IS NULL;

CREATE INDEX idx_pws_employee_date ON public.project_work_sessions (employee_id, date);
CREATE INDEX idx_pws_project_date ON public.project_work_sessions (project_id, date);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_pws_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_pws_updated_at
BEFORE UPDATE ON public.project_work_sessions
FOR EACH ROW EXECUTE FUNCTION public.update_pws_updated_at();

-- Enable RLS
ALTER TABLE public.project_work_sessions ENABLE ROW LEVEL SECURITY;

-- Employees can view/insert/update their own sessions
CREATE POLICY "Employees view own work sessions"
ON public.project_work_sessions FOR SELECT
USING (EXISTS (SELECT 1 FROM employees e WHERE e.id = project_work_sessions.employee_id AND e.auth_id = auth.uid()));

CREATE POLICY "Employees insert own work sessions"
ON public.project_work_sessions FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM employees e WHERE e.id = project_work_sessions.employee_id AND e.auth_id = auth.uid()));

CREATE POLICY "Employees update own work sessions"
ON public.project_work_sessions FOR UPDATE
USING (EXISTS (SELECT 1 FROM employees e WHERE e.id = project_work_sessions.employee_id AND e.auth_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM employees e WHERE e.id = project_work_sessions.employee_id AND e.auth_id = auth.uid()));

-- Admins manage all
CREATE POLICY "Admins manage all work sessions"
ON public.project_work_sessions FOR ALL
USING (is_admin());

-- Branch managers manage branch sessions
CREATE POLICY "Branch managers manage branch sessions"
ON public.project_work_sessions FOR ALL
USING (
  EXISTS (SELECT 1 FROM employees e WHERE e.id = project_work_sessions.employee_id AND e.branch_id = get_user_branch_id())
  AND EXISTS (SELECT 1 FROM user_roles ur JOIN users u ON u.id = ur.user_id WHERE u.auth_id = auth.uid() AND ur.role IN ('manager','admin'))
);

-- Branch users (incl team_leader) can view branch sessions
CREATE POLICY "Branch users view branch sessions"
ON public.project_work_sessions FOR SELECT
USING (
  EXISTS (SELECT 1 FROM employees e WHERE e.id = project_work_sessions.employee_id AND e.branch_id = get_user_branch_id())
  AND EXISTS (SELECT 1 FROM user_roles ur JOIN users u ON u.id = ur.user_id WHERE u.auth_id = auth.uid() AND ur.role IN ('admin','manager','team_leader'))
);