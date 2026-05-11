
CREATE TYPE public.driver_leg_type AS ENUM ('drop_off', 'pick_up', 'wait');
CREATE TYPE public.driver_leg_status AS ENUM ('traveling', 'on_site', 'completed');

CREATE TABLE public.driver_trip_legs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL,
  date date NOT NULL,
  project_id uuid NOT NULL,
  attendance_log_id uuid,
  leg_number int NOT NULL DEFAULT 1,
  travel_start_time timestamptz,
  travel_start_lat numeric,
  travel_start_lng numeric,
  site_arrival_time timestamptz,
  site_arrival_lat numeric,
  site_arrival_lng numeric,
  leg_type public.driver_leg_type,
  leg_end_time timestamptz,
  leg_end_lat numeric,
  leg_end_lng numeric,
  total_travel_minutes int DEFAULT 0,
  total_onsite_minutes int DEFAULT 0,
  status public.driver_leg_status NOT NULL DEFAULT 'traveling',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_dtl_driver_date ON public.driver_trip_legs(driver_id, date);
CREATE INDEX idx_dtl_project_date ON public.driver_trip_legs(project_id, date);

ALTER TABLE public.driver_trip_legs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all driver legs"
ON public.driver_trip_legs FOR ALL
USING (is_admin());

CREATE POLICY "Branch managers manage branch driver legs"
ON public.driver_trip_legs FOR ALL
USING (
  EXISTS (SELECT 1 FROM employees e WHERE e.id = driver_id AND e.branch_id = get_user_branch_id())
  AND EXISTS (SELECT 1 FROM user_roles ur JOIN users u ON u.id = ur.user_id
    WHERE u.auth_id = auth.uid() AND ur.role IN ('manager','admin','team_leader'))
);

CREATE POLICY "Branch users view branch driver legs"
ON public.driver_trip_legs FOR SELECT
USING (
  EXISTS (SELECT 1 FROM employees e WHERE e.id = driver_id AND e.branch_id = get_user_branch_id())
);

CREATE POLICY "Drivers manage own legs"
ON public.driver_trip_legs FOR ALL
USING (EXISTS (SELECT 1 FROM employees e WHERE e.id = driver_id AND e.auth_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM employees e WHERE e.id = driver_id AND e.auth_id = auth.uid()));

CREATE TRIGGER trg_dtl_updated_at
BEFORE UPDATE ON public.driver_trip_legs
FOR EACH ROW EXECUTE FUNCTION public.update_pws_updated_at();
