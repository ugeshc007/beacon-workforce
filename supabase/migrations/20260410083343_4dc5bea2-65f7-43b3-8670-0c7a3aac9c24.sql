
-- 1. Add mobile-app columns to attendance_logs
ALTER TABLE public.attendance_logs
  ADD COLUMN IF NOT EXISTS verification_type text,
  ADD COLUMN IF NOT EXISTS travel_start_accuracy numeric,
  ADD COLUMN IF NOT EXISTS site_arrival_accuracy numeric,
  ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_idempotency
  ON public.attendance_logs (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- 2. Create device_tokens table for FCM push notifications
CREATE TABLE IF NOT EXISTS public.device_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  fcm_token text NOT NULL,
  device_info text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(employee_id, fcm_token)
);

ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;

-- Employees can manage their own tokens
CREATE POLICY "Employees can manage own tokens"
  ON public.device_tokens FOR ALL
  USING (EXISTS (
    SELECT 1 FROM employees e WHERE e.id = device_tokens.employee_id AND e.auth_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM employees e WHERE e.id = device_tokens.employee_id AND e.auth_id = auth.uid()
  ));

-- Admins can view all tokens (for sending notifications)
CREATE POLICY "Admins can view all tokens"
  ON public.device_tokens FOR SELECT
  USING (is_admin());

-- 3. Allow employees to view projects they are assigned to
CREATE POLICY "Employees can view assigned projects"
  ON public.projects FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM project_assignments pa
    JOIN employees e ON e.id = pa.employee_id
    WHERE pa.project_id = projects.id AND e.auth_id = auth.uid()
  ));

-- 4. Insert GPS map confirmation setting
INSERT INTO public.settings (key, value, is_encrypted)
VALUES ('gps_allow_map_confirmation', 'true', false)
ON CONFLICT (key) DO NOTHING;
