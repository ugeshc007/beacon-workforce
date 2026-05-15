
-- Remove duplicate open logs (keep earliest per employee/date with no punch_out)
DELETE FROM public.attendance_logs a
USING public.attendance_logs b
WHERE a.employee_id = b.employee_id
  AND a.date = b.date
  AND a.office_punch_out IS NULL
  AND b.office_punch_out IS NULL
  AND a.ctid <> b.ctid
  AND a.office_punch_in > b.office_punch_in;

-- Prevent race-condition duplicates going forward
CREATE UNIQUE INDEX IF NOT EXISTS attendance_logs_one_open_per_day
  ON public.attendance_logs (employee_id, date)
  WHERE office_punch_out IS NULL;
