
-- 1. Update get_user_branch_id to also check employees table
CREATE OR REPLACE FUNCTION public.get_user_branch_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT branch_id FROM public.users WHERE auth_id = auth.uid() LIMIT 1),
    (SELECT branch_id FROM public.employees WHERE auth_id = auth.uid() LIMIT 1)
  )
$$;

-- 2. Create employee_notifications table
CREATE TABLE IF NOT EXISTS public.employee_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'info',
  title text NOT NULL,
  message text,
  reference_id text,
  reference_type text,
  priority text NOT NULL DEFAULT 'normal',
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.employee_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees can view own notifications"
  ON public.employee_notifications FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM employees e WHERE e.id = employee_notifications.employee_id AND e.auth_id = auth.uid()
  ));

CREATE POLICY "Employees can mark own notifications read"
  ON public.employee_notifications FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM employees e WHERE e.id = employee_notifications.employee_id AND e.auth_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM employees e WHERE e.id = employee_notifications.employee_id AND e.auth_id = auth.uid()
  ));

CREATE POLICY "Admins can manage all employee notifications"
  ON public.employee_notifications FOR ALL
  USING (is_admin());

CREATE POLICY "Managers can insert branch employee notifications"
  ON public.employee_notifications FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees e WHERE e.id = employee_notifications.employee_id AND e.branch_id = get_user_branch_id()
    )
    AND EXISTS (
      SELECT 1 FROM user_roles ur JOIN users u ON u.id = ur.user_id
      WHERE u.auth_id = auth.uid() AND ur.role IN ('admin', 'manager')
    )
  );

-- 3. Create travel_pings table for background GPS during travel
CREATE TABLE IF NOT EXISTS public.travel_pings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_log_id uuid NOT NULL REFERENCES public.attendance_logs(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  lat numeric NOT NULL,
  lng numeric NOT NULL,
  accuracy numeric,
  pinged_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.travel_pings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees can insert own travel pings"
  ON public.travel_pings FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM employees e WHERE e.id = travel_pings.employee_id AND e.auth_id = auth.uid()
  ));

CREATE POLICY "Employees can view own travel pings"
  ON public.travel_pings FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM employees e WHERE e.id = travel_pings.employee_id AND e.auth_id = auth.uid()
  ));

CREATE POLICY "Admins can view all travel pings"
  ON public.travel_pings FOR SELECT
  USING (is_admin());

CREATE POLICY "Branch managers can view branch travel pings"
  ON public.travel_pings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM employees e WHERE e.id = travel_pings.employee_id AND e.branch_id = get_user_branch_id()
    )
    AND EXISTS (
      SELECT 1 FROM user_roles ur JOIN users u ON u.id = ur.user_id
      WHERE u.auth_id = auth.uid() AND ur.role IN ('admin', 'manager')
    )
  );

-- Enable realtime for employee_notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.employee_notifications;
