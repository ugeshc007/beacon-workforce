ALTER TABLE public.project_daily_logs
  ADD COLUMN IF NOT EXISTS task_start_date date,
  ADD COLUMN IF NOT EXISTS task_end_date date;