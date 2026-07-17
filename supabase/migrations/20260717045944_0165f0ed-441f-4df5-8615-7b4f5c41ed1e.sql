
-- Remove the 44 bulk-closed stale attendance shifts so admins can re-enter them
-- manually after confirming with each employee whether they actually worked or forgot.
-- Delete dependent project work sessions first.
DELETE FROM public.project_work_sessions
WHERE attendance_log_id IN (
  SELECT id FROM public.attendance_logs
  WHERE auto_closed_by_user = true
    AND notes LIKE '%Bulk-closed%'
);

DELETE FROM public.attendance_logs
WHERE auto_closed_by_user = true
  AND notes LIKE '%Bulk-closed%';
