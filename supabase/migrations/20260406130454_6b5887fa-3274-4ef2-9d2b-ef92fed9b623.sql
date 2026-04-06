
-- =============================================
-- BeBright Database Schema
-- =============================================

-- Create custom types
CREATE TYPE public.user_role AS ENUM ('admin', 'manager', 'supervisor');
CREATE TYPE public.skill_type AS ENUM ('technician', 'helper', 'supervisor');
CREATE TYPE public.project_status AS ENUM ('planned', 'assigned', 'in_progress', 'completed');
CREATE TYPE public.assignment_mode AS ENUM ('manual', 'auto', 'hybrid');
CREATE TYPE public.override_action AS ENUM ('absent', 'replaced', 'added', 'removed');
CREATE TYPE public.expense_category AS ENUM ('labor', 'overtime', 'travel', 'material', 'transport', 'equipment', 'misc');
CREATE TYPE public.expense_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE public.notification_priority AS ENUM ('low', 'normal', 'high', 'critical');
CREATE TYPE public.report_schedule AS ENUM ('none', 'daily', 'weekly', 'monthly');

-- =============================================
-- 1. BRANCHES
-- =============================================
CREATE TABLE public.branches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  manager_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 2. USERS (web portal users: admin/manager/supervisor)
-- =============================================
CREATE TABLE public.users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  auth_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  branch_id UUID REFERENCES public.branches(id),
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_login TIMESTAMPTZ,
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 3. USER_ROLES (separate table for roles)
-- =============================================
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role public.user_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Add manager FK on branches now that users exists
ALTER TABLE public.branches ADD CONSTRAINT fk_branches_manager FOREIGN KEY (manager_id) REFERENCES public.users(id);

-- =============================================
-- 4. EMPLOYEES (field workers)
-- =============================================
CREATE TABLE public.employees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  auth_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  employee_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  designation TEXT,
  skill_type public.skill_type NOT NULL DEFAULT 'helper',
  branch_id UUID NOT NULL REFERENCES public.branches(id),
  hourly_rate NUMERIC(10,2) NOT NULL DEFAULT 0,
  overtime_rate NUMERIC(10,2) NOT NULL DEFAULT 0,
  standard_hours_per_day NUMERIC(4,1) NOT NULL DEFAULT 8,
  is_active BOOLEAN NOT NULL DEFAULT true,
  join_date DATE,
  emergency_contact TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_employees_branch ON public.employees(branch_id);
CREATE INDEX idx_employees_skill ON public.employees(skill_type);
CREATE INDEX idx_employees_active ON public.employees(is_active);

-- =============================================
-- 5. EMPLOYEE_LEAVE
-- =============================================
CREATE TABLE public.employee_leave (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  approved_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.employee_leave ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_employee_leave_dates ON public.employee_leave(employee_id, start_date, end_date);

-- =============================================
-- 6. OFFICES
-- =============================================
CREATE TABLE public.offices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id UUID NOT NULL REFERENCES public.branches(id),
  name TEXT NOT NULL,
  address TEXT,
  latitude DECIMAL(10,7),
  longitude DECIMAL(10,7),
  gps_radius_meters INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.offices ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 7. PROJECT_TEMPLATES
-- =============================================
CREATE TABLE public.project_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  required_technicians INTEGER NOT NULL DEFAULT 0,
  required_helpers INTEGER NOT NULL DEFAULT 0,
  required_supervisors INTEGER NOT NULL DEFAULT 0,
  default_duration_days INTEGER,
  cost_categories JSONB DEFAULT '{}',
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.project_templates ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 8. PROJECTS
-- =============================================
CREATE TABLE public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  client_name TEXT,
  client_phone TEXT,
  client_email TEXT,
  site_address TEXT,
  site_latitude DECIMAL(10,7),
  site_longitude DECIMAL(10,7),
  site_gps_radius INTEGER NOT NULL DEFAULT 100,
  start_date DATE,
  end_date DATE,
  budget NUMERIC(12,2),
  project_value NUMERIC(12,2),
  status public.project_status NOT NULL DEFAULT 'planned',
  notes TEXT,
  required_technicians INTEGER NOT NULL DEFAULT 0,
  required_helpers INTEGER NOT NULL DEFAULT 0,
  required_supervisors INTEGER NOT NULL DEFAULT 0,
  branch_id UUID NOT NULL REFERENCES public.branches(id),
  created_by UUID REFERENCES public.users(id),
  template_id UUID REFERENCES public.project_templates(id),
  health_score INTEGER DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_projects_branch ON public.projects(branch_id);
CREATE INDEX idx_projects_status ON public.projects(status);
CREATE INDEX idx_projects_dates ON public.projects(start_date, end_date);

-- =============================================
-- 9. PROJECT_ASSIGNMENTS
-- =============================================
CREATE TABLE public.project_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  shift_start TIME,
  shift_end TIME,
  assignment_mode public.assignment_mode NOT NULL DEFAULT 'manual',
  is_locked BOOLEAN NOT NULL DEFAULT false,
  assigned_by UUID REFERENCES public.users(id),
  auto_score JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.project_assignments ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_assignments_project_date ON public.project_assignments(project_id, date);
CREATE INDEX idx_assignments_employee_date ON public.project_assignments(employee_id, date);
CREATE UNIQUE INDEX idx_assignments_unique ON public.project_assignments(employee_id, date);

-- =============================================
-- 10. ATTENDANCE_LOGS
-- =============================================
CREATE TABLE public.attendance_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id),
  date DATE NOT NULL,
  office_punch_in TIMESTAMPTZ,
  office_punch_in_lat DECIMAL(10,7),
  office_punch_in_lng DECIMAL(10,7),
  office_punch_in_valid BOOLEAN,
  office_punch_in_distance_m NUMERIC,
  office_punch_in_accuracy NUMERIC,
  office_punch_in_spoofed BOOLEAN DEFAULT false,
  office_punch_out TIMESTAMPTZ,
  travel_start_time TIMESTAMPTZ,
  travel_start_lat DECIMAL(10,7),
  travel_start_lng DECIMAL(10,7),
  site_arrival_time TIMESTAMPTZ,
  site_arrival_lat DECIMAL(10,7),
  site_arrival_lng DECIMAL(10,7),
  site_arrival_distance_m NUMERIC,
  site_arrival_valid BOOLEAN,
  work_start_time TIMESTAMPTZ,
  work_end_time TIMESTAMPTZ,
  break_start_time TIMESTAMPTZ,
  break_end_time TIMESTAMPTZ,
  break_minutes INTEGER DEFAULT 0,
  total_work_minutes INTEGER,
  overtime_minutes INTEGER DEFAULT 0,
  regular_cost NUMERIC(10,2),
  overtime_cost NUMERIC(10,2),
  is_manual_override BOOLEAN DEFAULT false,
  override_reason TEXT,
  override_by UUID REFERENCES public.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_attendance_employee_date ON public.attendance_logs(employee_id, date);
CREATE INDEX idx_attendance_project_date ON public.attendance_logs(project_id, date);
CREATE INDEX idx_attendance_date ON public.attendance_logs(date);

-- =============================================
-- 11. DAILY_TEAM_OVERRIDES
-- =============================================
CREATE TABLE public.daily_team_overrides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  employee_id UUID NOT NULL REFERENCES public.employees(id),
  action public.override_action NOT NULL,
  replacement_employee_id UUID REFERENCES public.employees(id),
  reason TEXT,
  apply_to TEXT NOT NULL DEFAULT 'today_only' CHECK (apply_to IN ('today_only', 'remaining_schedule')),
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.daily_team_overrides ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_overrides_project_date ON public.daily_team_overrides(project_id, date);

-- =============================================
-- 12. PROJECT_EXPENSES
-- =============================================
CREATE TABLE public.project_expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  category public.expense_category NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'AED',
  exchange_rate NUMERIC(10,4) NOT NULL DEFAULT 1,
  amount_aed NUMERIC(10,2),
  description TEXT,
  receipt_url TEXT,
  date DATE NOT NULL,
  added_by UUID REFERENCES public.users(id),
  status public.expense_status NOT NULL DEFAULT 'pending',
  approved_by UUID REFERENCES public.users(id),
  approval_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.project_expenses ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_expenses_project ON public.project_expenses(project_id);
CREATE INDEX idx_expenses_status ON public.project_expenses(status);

-- =============================================
-- 13. ASSIGNMENT_AUDIT_LOG
-- =============================================
CREATE TABLE public.assignment_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id),
  date DATE,
  changed_by UUID REFERENCES public.users(id),
  change_type TEXT NOT NULL,
  before_state JSONB,
  after_state JSONB,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.assignment_audit_log ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_assignment_audit_project ON public.assignment_audit_log(project_id);

-- =============================================
-- 14. SYSTEM_AUDIT_LOG
-- =============================================
CREATE TABLE public.system_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id),
  module TEXT NOT NULL,
  action TEXT NOT NULL,
  record_id TEXT,
  before_state JSONB,
  after_state JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.system_audit_log ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_system_audit_user ON public.system_audit_log(user_id);
CREATE INDEX idx_system_audit_module ON public.system_audit_log(module);
CREATE INDEX idx_system_audit_date ON public.system_audit_log(created_at);

-- =============================================
-- 15. NOTIFICATIONS
-- =============================================
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  reference_id TEXT,
  reference_type TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  priority public.notification_priority NOT NULL DEFAULT 'normal',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_notifications_user ON public.notifications(user_id, is_read);

-- =============================================
-- 16. SETTINGS
-- =============================================
CREATE TABLE public.settings (
  key VARCHAR NOT NULL PRIMARY KEY,
  value TEXT,
  is_encrypted BOOLEAN NOT NULL DEFAULT false,
  updated_by UUID REFERENCES public.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 17. REPORT_PRESETS
-- =============================================
CREATE TABLE public.report_presets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  report_type TEXT NOT NULL,
  filters JSONB DEFAULT '{}',
  schedule public.report_schedule NOT NULL DEFAULT 'none',
  email_recipients TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.report_presets ENABLE ROW LEVEL SECURITY;

-- =============================================
-- SECURITY DEFINER FUNCTION FOR ROLE CHECKS
-- =============================================
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.user_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Helper: get user's branch_id from auth.uid()
CREATE OR REPLACE FUNCTION public.get_user_branch_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT branch_id FROM public.users WHERE auth_id = auth.uid() LIMIT 1
$$;

-- Helper: check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.users u ON u.id = ur.user_id
    WHERE u.auth_id = auth.uid() AND ur.role = 'admin'
  )
$$;

-- Helper: get user id from auth id
CREATE OR REPLACE FUNCTION public.get_user_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.users WHERE auth_id = auth.uid() LIMIT 1
$$;

-- =============================================
-- RLS POLICIES
-- =============================================

-- BRANCHES: admins see all, others see own branch
CREATE POLICY "Admins can manage all branches" ON public.branches FOR ALL USING (public.is_admin());
CREATE POLICY "Users can view own branch" ON public.branches FOR SELECT USING (id = public.get_user_branch_id());

-- USERS: admins see all, others see same branch
CREATE POLICY "Admins can manage all users" ON public.users FOR ALL USING (public.is_admin());
CREATE POLICY "Users can view same branch users" ON public.users FOR SELECT USING (branch_id = public.get_user_branch_id());
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth_id = auth.uid());

-- USER_ROLES: admins manage, users can read own
CREATE POLICY "Admins can manage all roles" ON public.user_roles FOR ALL USING (public.is_admin());
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (user_id = public.get_user_id());

-- EMPLOYEES: admins see all, managers/supervisors see own branch
CREATE POLICY "Admins can manage all employees" ON public.employees FOR ALL USING (public.is_admin());
CREATE POLICY "Branch users can view branch employees" ON public.employees FOR SELECT USING (branch_id = public.get_user_branch_id());
CREATE POLICY "Branch managers can manage branch employees" ON public.employees FOR ALL USING (
  branch_id = public.get_user_branch_id()
  AND EXISTS (SELECT 1 FROM public.user_roles ur JOIN public.users u ON u.id = ur.user_id WHERE u.auth_id = auth.uid() AND ur.role IN ('manager', 'admin'))
);

-- EMPLOYEE_LEAVE: follows employee branch rules
CREATE POLICY "Admins can manage all leave" ON public.employee_leave FOR ALL USING (public.is_admin());
CREATE POLICY "Branch users can view branch leave" ON public.employee_leave FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.employees e WHERE e.id = employee_id AND e.branch_id = public.get_user_branch_id())
);
CREATE POLICY "Branch managers can manage branch leave" ON public.employee_leave FOR ALL USING (
  EXISTS (SELECT 1 FROM public.employees e WHERE e.id = employee_id AND e.branch_id = public.get_user_branch_id())
  AND EXISTS (SELECT 1 FROM public.user_roles ur JOIN public.users u ON u.id = ur.user_id WHERE u.auth_id = auth.uid() AND ur.role IN ('manager', 'admin'))
);

-- OFFICES: branch scoped
CREATE POLICY "Admins can manage all offices" ON public.offices FOR ALL USING (public.is_admin());
CREATE POLICY "Branch users can view branch offices" ON public.offices FOR SELECT USING (branch_id = public.get_user_branch_id());

-- PROJECT_TEMPLATES: all authenticated can read, admins/managers can manage
CREATE POLICY "Authenticated can view templates" ON public.project_templates FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can manage templates" ON public.project_templates FOR ALL USING (public.is_admin());

-- PROJECTS: branch scoped
CREATE POLICY "Admins can manage all projects" ON public.projects FOR ALL USING (public.is_admin());
CREATE POLICY "Branch users can view branch projects" ON public.projects FOR SELECT USING (branch_id = public.get_user_branch_id());
CREATE POLICY "Branch managers can manage branch projects" ON public.projects FOR ALL USING (
  branch_id = public.get_user_branch_id()
  AND EXISTS (SELECT 1 FROM public.user_roles ur JOIN public.users u ON u.id = ur.user_id WHERE u.auth_id = auth.uid() AND ur.role IN ('manager', 'admin'))
);

-- PROJECT_ASSIGNMENTS: branch scoped via project
CREATE POLICY "Admins can manage all assignments" ON public.project_assignments FOR ALL USING (public.is_admin());
CREATE POLICY "Branch users can view branch assignments" ON public.project_assignments FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.branch_id = public.get_user_branch_id())
);
CREATE POLICY "Branch managers can manage branch assignments" ON public.project_assignments FOR ALL USING (
  EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.branch_id = public.get_user_branch_id())
  AND EXISTS (SELECT 1 FROM public.user_roles ur JOIN public.users u ON u.id = ur.user_id WHERE u.auth_id = auth.uid() AND ur.role IN ('manager', 'admin'))
);
-- Employees can read own assignments (for Android app)
CREATE POLICY "Employees can read own assignments" ON public.project_assignments FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.employees e WHERE e.id = employee_id AND e.auth_id = auth.uid())
);

-- ATTENDANCE_LOGS: branch scoped + employee self-access
CREATE POLICY "Admins can manage all attendance" ON public.attendance_logs FOR ALL USING (public.is_admin());
CREATE POLICY "Branch users can view branch attendance" ON public.attendance_logs FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.employees e WHERE e.id = employee_id AND e.branch_id = public.get_user_branch_id())
);
CREATE POLICY "Branch managers can manage branch attendance" ON public.attendance_logs FOR ALL USING (
  EXISTS (SELECT 1 FROM public.employees e WHERE e.id = employee_id AND e.branch_id = public.get_user_branch_id())
  AND EXISTS (SELECT 1 FROM public.user_roles ur JOIN public.users u ON u.id = ur.user_id WHERE u.auth_id = auth.uid() AND ur.role IN ('manager', 'admin'))
);
CREATE POLICY "Employees can insert own attendance" ON public.attendance_logs FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.employees e WHERE e.id = employee_id AND e.auth_id = auth.uid())
);
CREATE POLICY "Employees can update own attendance" ON public.attendance_logs FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.employees e WHERE e.id = employee_id AND e.auth_id = auth.uid())
);
CREATE POLICY "Employees can read own attendance" ON public.attendance_logs FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.employees e WHERE e.id = employee_id AND e.auth_id = auth.uid())
);

-- DAILY_TEAM_OVERRIDES: branch scoped + employee read
CREATE POLICY "Admins can manage all overrides" ON public.daily_team_overrides FOR ALL USING (public.is_admin());
CREATE POLICY "Branch managers can manage branch overrides" ON public.daily_team_overrides FOR ALL USING (
  EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.branch_id = public.get_user_branch_id())
  AND EXISTS (SELECT 1 FROM public.user_roles ur JOIN public.users u ON u.id = ur.user_id WHERE u.auth_id = auth.uid() AND ur.role IN ('manager', 'admin'))
);
CREATE POLICY "Employees can read own overrides" ON public.daily_team_overrides FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.employees e WHERE e.id = employee_id AND e.auth_id = auth.uid())
);

-- PROJECT_EXPENSES: branch scoped via project
CREATE POLICY "Admins can manage all expenses" ON public.project_expenses FOR ALL USING (public.is_admin());
CREATE POLICY "Branch users can view branch expenses" ON public.project_expenses FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.branch_id = public.get_user_branch_id())
);
CREATE POLICY "Branch managers can manage branch expenses" ON public.project_expenses FOR ALL USING (
  EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.branch_id = public.get_user_branch_id())
  AND EXISTS (SELECT 1 FROM public.user_roles ur JOIN public.users u ON u.id = ur.user_id WHERE u.auth_id = auth.uid() AND ur.role IN ('manager', 'admin'))
);

-- ASSIGNMENT_AUDIT_LOG: read-only for branch users
CREATE POLICY "Admins can view all audit logs" ON public.assignment_audit_log FOR SELECT USING (public.is_admin());
CREATE POLICY "Branch users can view branch audit" ON public.assignment_audit_log FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.branch_id = public.get_user_branch_id())
);
CREATE POLICY "System can insert audit logs" ON public.assignment_audit_log FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- SYSTEM_AUDIT_LOG: admins only for read, system insert
CREATE POLICY "Admins can view system audit" ON public.system_audit_log FOR SELECT USING (public.is_admin());
CREATE POLICY "System can insert system audit" ON public.system_audit_log FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- NOTIFICATIONS: user can manage own
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING (user_id = public.get_user_id());
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING (user_id = public.get_user_id());
CREATE POLICY "System can insert notifications" ON public.notifications FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
-- Employees can read own notifications (for Android app)
CREATE POLICY "Employees can insert notifications" ON public.notifications FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.employees e WHERE e.auth_id = auth.uid())
);

-- SETTINGS: admins can manage, authenticated can read
CREATE POLICY "Admins can manage settings" ON public.settings FOR ALL USING (public.is_admin());
CREATE POLICY "Authenticated can read settings" ON public.settings FOR SELECT USING (auth.uid() IS NOT NULL AND is_encrypted = false);

-- REPORT_PRESETS: users manage own
CREATE POLICY "Users can manage own presets" ON public.report_presets FOR ALL USING (user_id = public.get_user_id());

-- =============================================
-- STORAGE: receipts bucket
-- =============================================
INSERT INTO storage.buckets (id, name, public) VALUES ('receipts', 'receipts', false);

CREATE POLICY "Authenticated users can upload receipts" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'receipts' AND auth.uid() IS NOT NULL);

CREATE POLICY "Branch users can view receipts" ON storage.objects
FOR SELECT USING (bucket_id = 'receipts' AND auth.uid() IS NOT NULL);

-- =============================================
-- REALTIME: enable for tables Android app subscribes to
-- =============================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_team_overrides;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_logs;
