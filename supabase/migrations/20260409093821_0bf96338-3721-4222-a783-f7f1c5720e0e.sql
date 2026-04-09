
CREATE OR REPLACE FUNCTION public.delete_employee_cascade(emp_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow admins/managers
  IF NOT EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN users u ON u.id = ur.user_id
    WHERE u.auth_id = auth.uid()
      AND ur.role IN ('admin', 'manager')
  ) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  DELETE FROM project_assignments WHERE employee_id = emp_id;
  DELETE FROM attendance_logs WHERE employee_id = emp_id;
  DELETE FROM employee_leave WHERE employee_id = emp_id;
  DELETE FROM project_daily_logs WHERE employee_id = emp_id;
  DELETE FROM maintenance_assignments WHERE employee_id = emp_id;
  DELETE FROM timesheet_approvals WHERE employee_id = emp_id;
  DELETE FROM daily_team_overrides WHERE employee_id = emp_id;
  DELETE FROM daily_team_overrides WHERE replacement_employee_id = emp_id;
  DELETE FROM employees WHERE id = emp_id;
END;
$$;
