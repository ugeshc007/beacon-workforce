
-- 1. Fix attendance employee UPDATE: add WITH CHECK to prevent employee_id reassignment
DROP POLICY IF EXISTS "Employees can update own attendance" ON public.attendance_logs;
CREATE POLICY "Employees can update own attendance"
ON public.attendance_logs
FOR UPDATE
TO authenticated
USING (EXISTS (SELECT 1 FROM employees e WHERE e.id = attendance_logs.employee_id AND e.auth_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM employees e WHERE e.id = attendance_logs.employee_id AND e.auth_id = auth.uid()));

-- 2. Fix notifications INSERT: scope managers to same-branch target users
DROP POLICY IF EXISTS "Managers can insert notifications" ON public.notifications;
CREATE POLICY "Managers can insert notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN users u ON u.id = ur.user_id
    WHERE u.auth_id = auth.uid()
      AND ur.role IN ('admin', 'manager')
  )
  AND EXISTS (
    SELECT 1 FROM users target
    WHERE target.id = notifications.user_id
      AND target.branch_id = get_user_branch_id()
  )
);

-- 3. Fix receipts storage SELECT: use object name, not p.name
DROP POLICY IF EXISTS "Branch users can view receipts" ON storage.objects;
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

-- 4. Fix audit log INSERT policies: enforce changed_by = calling user
DROP POLICY IF EXISTS "Managers can insert audit logs" ON public.assignment_audit_log;
CREATE POLICY "Managers can insert audit logs"
ON public.assignment_audit_log
FOR INSERT
TO authenticated
WITH CHECK (
  changed_by = get_user_id()
  AND EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN users u ON u.id = ur.user_id
    WHERE u.auth_id = auth.uid()
      AND ur.role IN ('admin', 'manager', 'supervisor')
  )
);

DROP POLICY IF EXISTS "Managers can insert system audit" ON public.system_audit_log;
CREATE POLICY "Managers can insert system audit"
ON public.system_audit_log
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = get_user_id()
  AND EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN users u ON u.id = ur.user_id
    WHERE u.auth_id = auth.uid()
      AND ur.role IN ('admin', 'manager', 'supervisor')
  )
);
