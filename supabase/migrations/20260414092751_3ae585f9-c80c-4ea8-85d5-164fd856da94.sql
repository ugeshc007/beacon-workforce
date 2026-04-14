DROP INDEX IF EXISTS idx_assignments_unique;
CREATE UNIQUE INDEX idx_assignments_unique ON public.project_assignments (employee_id, date, project_id, assigned_role);