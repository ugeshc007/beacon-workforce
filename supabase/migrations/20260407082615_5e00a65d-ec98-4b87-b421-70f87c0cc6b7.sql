-- ============================================================
-- 1. Fix malformed receipts SELECT policy
--    Was using storage.foldername(p.name) instead of the
--    storage object's name column
-- ============================================================

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

-- ============================================================
-- 2. Restrict employee data: replace broad branch SELECT with
--    a role-scoped policy so only managers/admins/supervisors
--    can see all employee fields. Employees can read own record.
-- ============================================================

DROP POLICY IF EXISTS "Branch users can view branch employees" ON public.employees;

-- Role holders in the branch can view all branch employees
CREATE POLICY "Branch role users can view branch employees"
ON public.employees
FOR SELECT
TO authenticated
USING (
  branch_id = get_user_branch_id()
  AND EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN users u ON u.id = ur.user_id
    WHERE u.auth_id = auth.uid()
      AND ur.role IN ('admin', 'manager', 'supervisor')
  )
);

-- Employees can view their own record
CREATE POLICY "Employees can view own record"
ON public.employees
FOR SELECT
TO authenticated
USING (auth_id = auth.uid());