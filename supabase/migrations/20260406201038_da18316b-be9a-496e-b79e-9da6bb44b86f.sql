
-- ============================================================
-- 1. Add UPDATE/DELETE policies for receipts storage bucket
-- ============================================================
-- UPDATE: Only admins and managers can update receipt files
CREATE POLICY "Branch managers can update receipts"
ON storage.objects FOR UPDATE
TO authenticated
USING (
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

-- DELETE: Only admins can delete receipt files
CREATE POLICY "Admins can delete receipts"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'receipts'
  AND is_admin()
);

-- ============================================================
-- 2. Add restrictive INSERT policy on user_roles to prevent
--    privilege escalation by non-admin users
-- ============================================================
-- This uses a RESTRICTIVE policy so even if permissive policies
-- match, this must ALSO pass. It ensures only existing admins
-- can insert new role assignments.
CREATE POLICY "Only admins can assign roles"
ON public.user_roles AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (
  is_admin()
);

-- Also add restrictive UPDATE policy
CREATE POLICY "Only admins can update roles"
ON public.user_roles AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());
