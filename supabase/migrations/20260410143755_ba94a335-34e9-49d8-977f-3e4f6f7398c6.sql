
-- employees.auth_id: used in every RLS policy for employee self-access
CREATE INDEX IF NOT EXISTS idx_employees_auth_id ON public.employees USING btree (auth_id);

-- users.auth_id: used in every RLS policy via get_user_id(), get_user_branch_id(), is_admin()
CREATE INDEX IF NOT EXISTS idx_users_auth_id ON public.users USING btree (auth_id);

-- user_roles.user_id: used in has_role() and every manager/admin RLS check
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles USING btree (user_id);

-- projects.branch_id: used in branch-scoped RLS policies
CREATE INDEX IF NOT EXISTS idx_projects_branch_id ON public.projects USING btree (branch_id);

-- projects.status: used for filtering active projects
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects USING btree (status);

-- maintenance_calls.branch_id: used in branch RLS policies
CREATE INDEX IF NOT EXISTS idx_maintenance_calls_branch_id ON public.maintenance_calls USING btree (branch_id);

-- maintenance_calls.status: used for filtering
CREATE INDEX IF NOT EXISTS idx_maintenance_calls_status ON public.maintenance_calls USING btree (status);

-- employee_notifications.employee_id + is_read: used in RLS and unread count queries
CREATE INDEX IF NOT EXISTS idx_employee_notifications_employee ON public.employee_notifications USING btree (employee_id, is_read);

-- daily_team_overrides.employee_id: used in RLS employee self-access
CREATE INDEX IF NOT EXISTS idx_overrides_employee ON public.daily_team_overrides USING btree (employee_id);

-- project_daily_logs.project_id + date: used for project detail page
CREATE INDEX IF NOT EXISTS idx_daily_logs_project_date ON public.project_daily_logs USING btree (project_id, date);

-- project_expenses.project_id: used for project cost queries
CREATE INDEX IF NOT EXISTS idx_expenses_project ON public.project_expenses USING btree (project_id);

-- timesheet_approvals.employee_id + month: used for timesheet lookups
CREATE INDEX IF NOT EXISTS idx_timesheet_employee_month ON public.timesheet_approvals USING btree (employee_id, month);

-- travel_pings.attendance_log_id: used for travel map queries
CREATE INDEX IF NOT EXISTS idx_travel_pings_log ON public.travel_pings USING btree (attendance_log_id);

-- travel_pings.employee_id: used in RLS
CREATE INDEX IF NOT EXISTS idx_travel_pings_employee ON public.travel_pings USING btree (employee_id);

-- offices.branch_id: used in branch RLS
CREATE INDEX IF NOT EXISTS idx_offices_branch ON public.offices USING btree (branch_id);

-- role_permissions.role: used for permission lookups
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON public.role_permissions USING btree (role);
