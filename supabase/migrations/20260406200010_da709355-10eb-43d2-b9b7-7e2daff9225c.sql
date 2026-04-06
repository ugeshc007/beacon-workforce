
-- ============================================================
-- 1. Fix notifications INSERT policies
-- ============================================================
-- Drop the overly permissive policies
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Employees can insert notifications" ON public.notifications;

-- Only managers/admins can insert notifications (for client-side).
-- Edge functions use service_role and bypass RLS entirely.
CREATE POLICY "Managers can insert notifications"
ON public.notifications FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN users u ON u.id = ur.user_id
    WHERE u.auth_id = auth.uid()
      AND ur.role IN ('admin', 'manager')
  )
);

-- ============================================================
-- 2. Fix audit log INSERT policies
-- ============================================================
-- assignment_audit_log: enforce changed_by = current user
DROP POLICY IF EXISTS "System can insert audit logs" ON public.assignment_audit_log;
CREATE POLICY "Managers can insert audit logs"
ON public.assignment_audit_log FOR INSERT
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

-- system_audit_log: enforce user_id = current user
DROP POLICY IF EXISTS "System can insert system audit" ON public.system_audit_log;
CREATE POLICY "Managers can insert system audit"
ON public.system_audit_log FOR INSERT
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

-- ============================================================
-- 3. Fix receipts storage policies
-- ============================================================
DROP POLICY IF EXISTS "Branch users can view receipts" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload receipts" ON storage.objects;

-- SELECT: Only users in the same branch as the project owning the receipt
CREATE POLICY "Branch users can view receipts"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'receipts'
  AND (
    is_admin()
    OR EXISTS (
      SELECT 1 FROM project_expenses pe
      JOIN projects p ON p.id = pe.project_id
      WHERE pe.receipt_url LIKE '%' || name || '%'
        AND p.branch_id = get_user_branch_id()
    )
  )
);

-- INSERT: Only managers/admins in their branch can upload
CREATE POLICY "Branch managers can upload receipts"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'receipts'
  AND (
    is_admin()
    OR EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN users u ON u.id = ur.user_id
      WHERE u.auth_id = auth.uid()
        AND ur.role IN ('admin', 'manager')
    )
  )
);
