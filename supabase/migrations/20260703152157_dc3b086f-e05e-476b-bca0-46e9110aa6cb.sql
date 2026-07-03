
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS last_app_version text,
  ADD COLUMN IF NOT EXISTS last_app_build integer,
  ADD COLUMN IF NOT EXISTS last_platform text,
  ADD COLUMN IF NOT EXISTS last_login_at timestamptz;
