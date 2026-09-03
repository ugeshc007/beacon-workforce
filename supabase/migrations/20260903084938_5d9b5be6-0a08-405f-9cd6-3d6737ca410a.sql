ALTER TABLE public.project_day_work_locations
  ADD CONSTRAINT project_day_work_locations_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE public.project_day_work_locations
  ADD CONSTRAINT project_day_work_locations_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;