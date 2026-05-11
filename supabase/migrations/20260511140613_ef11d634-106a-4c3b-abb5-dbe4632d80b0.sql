ALTER TABLE public.project_assignments
ADD COLUMN IF NOT EXISTS work_location public.work_location_type;

CREATE INDEX IF NOT EXISTS idx_project_assignments_work_location
ON public.project_assignments(project_id, date, work_location);