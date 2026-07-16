ALTER TABLE public.project_work_sessions
  ADD COLUMN IF NOT EXISTS office_arrival_time timestamptz,
  ADD COLUMN IF NOT EXISTS office_arrival_lat numeric,
  ADD COLUMN IF NOT EXISTS office_arrival_lng numeric,
  ADD COLUMN IF NOT EXISTS office_arrival_distance_m numeric,
  ADD COLUMN IF NOT EXISTS office_arrival_valid boolean;