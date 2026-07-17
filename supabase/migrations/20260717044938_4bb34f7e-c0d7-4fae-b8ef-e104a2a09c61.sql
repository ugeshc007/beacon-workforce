ALTER TABLE public.attendance_logs
  ADD COLUMN IF NOT EXISTS is_incomplete_process boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_absent boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS attendance_logs_absent_idx
  ON public.attendance_logs (employee_id, date)
  WHERE is_absent = true;