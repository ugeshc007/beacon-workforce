
ALTER TABLE public.recurring_jobs
  ADD COLUMN project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;

CREATE INDEX idx_recurring_jobs_project ON public.recurring_jobs(project_id);
