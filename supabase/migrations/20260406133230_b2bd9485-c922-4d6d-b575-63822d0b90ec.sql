CREATE TABLE public.timesheet_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  month text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by uuid REFERENCES public.users(id),
  approval_notes text,
  total_hours numeric DEFAULT 0,
  total_ot_hours numeric DEFAULT 0,
  total_regular_cost numeric DEFAULT 0,
  total_ot_cost numeric DEFAULT 0,
  days_worked integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(employee_id, month)
);

ALTER TABLE public.timesheet_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all approvals"
  ON public.timesheet_approvals FOR ALL
  USING (is_admin());

CREATE POLICY "Branch managers can manage branch approvals"
  ON public.timesheet_approvals FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM employees e
      WHERE e.id = timesheet_approvals.employee_id
      AND e.branch_id = get_user_branch_id()
    )
    AND EXISTS (
      SELECT 1 FROM user_roles ur JOIN users u ON u.id = ur.user_id
      WHERE u.auth_id = auth.uid() AND ur.role IN ('manager', 'admin')
    )
  );

CREATE POLICY "Branch users can view branch approvals"
  ON public.timesheet_approvals FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM employees e
      WHERE e.id = timesheet_approvals.employee_id
      AND e.branch_id = get_user_branch_id()
    )
  );