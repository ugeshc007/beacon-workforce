CREATE TABLE public.site_visit_work_sessions (
  id uuid primary key default gen_random_uuid(),
  site_visit_id uuid not null references public.site_visits(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  date date not null,
  attendance_log_id uuid references public.attendance_logs(id) on delete set null,
  travel_start_time timestamptz, travel_start_lat numeric, travel_start_lng numeric,
  site_arrival_time timestamptz, site_arrival_lat numeric, site_arrival_lng numeric,
  site_arrival_distance_m numeric, site_arrival_valid boolean,
  work_start_time timestamptz,
  break_start_time timestamptz, break_end_time timestamptz, break_minutes integer default 0,
  work_end_time timestamptz,
  total_work_minutes integer, overtime_minutes integer default 0,
  regular_cost numeric, overtime_cost numeric,
  status text not null default 'in_progress',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (site_visit_id, employee_id, date)
);

CREATE INDEX idx_svws_employee_date ON public.site_visit_work_sessions(employee_id, date);
CREATE INDEX idx_svws_site_visit ON public.site_visit_work_sessions(site_visit_id);

ALTER TABLE public.site_visit_work_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees view own sv sessions" ON public.site_visit_work_sessions
  FOR SELECT USING (EXISTS (SELECT 1 FROM employees e WHERE e.id = employee_id AND e.auth_id = auth.uid()));

CREATE POLICY "Employees insert own sv sessions" ON public.site_visit_work_sessions
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM employees e WHERE e.id = employee_id AND e.auth_id = auth.uid()));

CREATE POLICY "Employees update own sv sessions" ON public.site_visit_work_sessions
  FOR UPDATE USING (EXISTS (SELECT 1 FROM employees e WHERE e.id = employee_id AND e.auth_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM employees e WHERE e.id = employee_id AND e.auth_id = auth.uid()));

CREATE POLICY "Admins manage all sv sessions" ON public.site_visit_work_sessions
  FOR ALL USING (is_admin());

CREATE POLICY "Branch managers manage branch sv sessions" ON public.site_visit_work_sessions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM employees e WHERE e.id = employee_id AND e.branch_id = get_user_branch_id())
    AND EXISTS (SELECT 1 FROM user_roles ur JOIN users u ON u.id = ur.user_id
      WHERE u.auth_id = auth.uid() AND ur.role IN ('manager','admin'))
  );

CREATE POLICY "Branch users view branch sv sessions" ON public.site_visit_work_sessions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM employees e WHERE e.id = employee_id AND e.branch_id = get_user_branch_id())
    AND EXISTS (SELECT 1 FROM user_roles ur JOIN users u ON u.id = ur.user_id
      WHERE u.auth_id = auth.uid() AND ur.role IN ('admin','manager','team_leader'))
  );

CREATE TRIGGER set_svws_updated_at BEFORE UPDATE ON public.site_visit_work_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_pws_updated_at();