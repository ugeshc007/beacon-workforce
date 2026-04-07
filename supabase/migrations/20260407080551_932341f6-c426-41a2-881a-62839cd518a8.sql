
-- ============================================================
-- 1. Replace employee UPDATE policy on attendance_logs
--    to restrict which columns employees can modify
-- ============================================================

-- Drop the existing overly permissive employee update policy
DROP POLICY IF EXISTS "Employees can update own attendance" ON public.attendance_logs;

-- Create a trigger function that prevents employees from modifying sensitive fields.
-- Managers/admins bypass this via their own ALL policies + service role.
CREATE OR REPLACE FUNCTION public.prevent_employee_sensitive_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only restrict non-admin/non-manager users
  IF NOT EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN users u ON u.id = ur.user_id
    WHERE u.auth_id = auth.uid()
      AND ur.role IN ('admin', 'manager')
  ) THEN
    -- Prevent changes to sensitive computed/payroll/audit fields
    NEW.total_work_minutes := OLD.total_work_minutes;
    NEW.overtime_minutes := OLD.overtime_minutes;
    NEW.regular_cost := OLD.regular_cost;
    NEW.overtime_cost := OLD.overtime_cost;
    NEW.is_manual_override := OLD.is_manual_override;
    NEW.override_reason := OLD.override_reason;
    NEW.override_by := OLD.override_by;
    NEW.office_punch_in_spoofed := OLD.office_punch_in_spoofed;
    NEW.office_punch_in_valid := OLD.office_punch_in_valid;
    NEW.office_punch_in_accuracy := OLD.office_punch_in_accuracy;
    NEW.office_punch_in_distance_m := OLD.office_punch_in_distance_m;
    NEW.site_arrival_valid := OLD.site_arrival_valid;
    NEW.site_arrival_distance_m := OLD.site_arrival_distance_m;
    NEW.employee_id := OLD.employee_id;
    NEW.date := OLD.date;
    NEW.project_id := OLD.project_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Attach trigger
DROP TRIGGER IF EXISTS trg_prevent_employee_sensitive_update ON public.attendance_logs;
CREATE TRIGGER trg_prevent_employee_sensitive_update
  BEFORE UPDATE ON public.attendance_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_employee_sensitive_update();

-- Re-create a simpler employee update policy (ownership check only; trigger handles field restriction)
CREATE POLICY "Employees can update own attendance"
ON public.attendance_logs
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM employees e
    WHERE e.id = attendance_logs.employee_id
      AND e.auth_id = auth.uid()
  )
);

-- ============================================================
-- 2. Fix receipt storage SELECT policy — use folder-based path
--    instead of fragile LIKE pattern matching
-- ============================================================

-- Drop the old weak policy
DROP POLICY IF EXISTS "Branch users can view receipts" ON storage.objects;

-- New policy: receipts are stored with path convention {project_id}/filename
-- Join on the first folder segment matching a project in the user's branch
CREATE POLICY "Branch users can view receipts"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'receipts'
  AND (
    is_admin()
    OR EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id::text = (storage.foldername(name))[1]
        AND p.branch_id = get_user_branch_id()
    )
  )
);
