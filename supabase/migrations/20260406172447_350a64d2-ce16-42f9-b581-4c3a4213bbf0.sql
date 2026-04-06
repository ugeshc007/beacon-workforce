-- Drop the old constraint that blocks multi-project same-day assignments
DROP INDEX IF EXISTS idx_assignments_unique;

-- Create new constraint: one assignment per employee per project per day
CREATE UNIQUE INDEX idx_assignments_unique ON public.project_assignments (employee_id, date, project_id);