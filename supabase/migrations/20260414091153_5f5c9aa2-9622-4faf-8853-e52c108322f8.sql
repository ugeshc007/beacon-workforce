ALTER TABLE public.projects ADD COLUMN required_drivers integer NOT NULL DEFAULT 0;
ALTER TABLE public.project_templates ADD COLUMN required_drivers integer NOT NULL DEFAULT 0;