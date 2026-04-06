-- Create role_permissions table for custom permission matrix
CREATE TABLE public.role_permissions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  role user_role NOT NULL,
  module text NOT NULL,
  can_view boolean NOT NULL DEFAULT false,
  can_create boolean NOT NULL DEFAULT false,
  can_edit boolean NOT NULL DEFAULT false,
  can_delete boolean NOT NULL DEFAULT false,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid,
  UNIQUE(role, module)
);

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all permissions"
  ON public.role_permissions FOR ALL
  USING (is_admin());

CREATE POLICY "Authenticated users can view permissions"
  ON public.role_permissions FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Seed default permissions
INSERT INTO public.role_permissions (role, module, can_view, can_create, can_edit, can_delete) VALUES
  ('admin', 'dashboard', true, true, true, true),
  ('admin', 'projects', true, true, true, true),
  ('admin', 'employees', true, true, true, true),
  ('admin', 'schedule', true, true, true, true),
  ('admin', 'attendance', true, true, true, true),
  ('admin', 'timesheets', true, true, true, true),
  ('admin', 'reports', true, true, true, true),
  ('admin', 'settings', true, true, true, true),
  ('manager', 'dashboard', true, true, true, false),
  ('manager', 'projects', true, true, true, false),
  ('manager', 'employees', true, true, true, false),
  ('manager', 'schedule', true, true, true, false),
  ('manager', 'attendance', true, true, true, false),
  ('manager', 'timesheets', true, true, true, false),
  ('manager', 'reports', true, false, false, false),
  ('manager', 'settings', true, false, false, false),
  ('supervisor', 'dashboard', true, false, false, false),
  ('supervisor', 'projects', true, false, false, false),
  ('supervisor', 'employees', true, false, false, false),
  ('supervisor', 'schedule', true, false, false, false),
  ('supervisor', 'attendance', true, true, true, false),
  ('supervisor', 'timesheets', true, false, false, false),
  ('supervisor', 'reports', false, false, false, false),
  ('supervisor', 'settings', false, false, false, false);