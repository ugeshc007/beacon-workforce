ALTER TABLE public.site_visit_work_sessions
  ADD COLUMN IF NOT EXISTS return_travel_start_time timestamptz,
  ADD COLUMN IF NOT EXISTS return_travel_start_lat numeric,
  ADD COLUMN IF NOT EXISTS return_travel_start_lng numeric,
  ADD COLUMN IF NOT EXISTS return_travel_start_accuracy numeric;