-- Fix 1: Tighten "Branch users can view branch attendance" to require manager/admin role
-- Employees already have their own "Employees can read own attendance" policy
DROP POLICY IF EXISTS "Branch users can view branch attendance" ON attendance_logs;

CREATE POLICY "Branch managers can view branch attendance" ON attendance_logs
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM employees e
    WHERE e.id = attendance_logs.employee_id
      AND e.branch_id = get_user_branch_id()
  )
  AND EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN users u ON u.id = ur.user_id
    WHERE u.auth_id = auth.uid()
      AND ur.role IN ('admin', 'manager')
  )
);

-- Fix 2: Tighten daily-log-photos storage INSERT policy to require project assignment or manager role
-- First drop the existing permissive insert policy
DROP POLICY IF EXISTS "Authenticated users can upload daily log photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;

-- Recreate with proper authorization check
CREATE POLICY "Project members can upload daily log photos" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'daily-log-photos'
  AND (
    -- Admins/managers can upload
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN users u ON u.id = ur.user_id
      WHERE u.auth_id = auth.uid()
        AND ur.role IN ('admin', 'manager')
    )
    OR
    -- Employees with any project assignment can upload
    EXISTS (
      SELECT 1 FROM employees e
      JOIN project_assignments pa ON pa.employee_id = e.id
      WHERE e.auth_id = auth.uid()
    )
  )
);