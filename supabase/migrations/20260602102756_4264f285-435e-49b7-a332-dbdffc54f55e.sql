ALTER TABLE public.project_daily_logs
  ADD COLUMN IF NOT EXISTS assigned_employee_ids uuid[] NOT NULL DEFAULT '{}'::uuid[];

CREATE INDEX IF NOT EXISTS idx_daily_logs_assigned_employees
  ON public.project_daily_logs USING gin (assigned_employee_ids);