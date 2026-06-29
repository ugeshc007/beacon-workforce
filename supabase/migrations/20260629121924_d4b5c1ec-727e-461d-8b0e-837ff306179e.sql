-- Prevent duplicate active work sessions per employee (race-condition guard).
-- A user can only have ONE in-progress project session and ONE in-progress site-visit session at a time.

CREATE UNIQUE INDEX IF NOT EXISTS pws_one_active_per_employee
  ON public.project_work_sessions (employee_id)
  WHERE work_end_time IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS svws_one_active_per_employee
  ON public.site_visit_work_sessions (employee_id)
  WHERE work_end_time IS NULL;