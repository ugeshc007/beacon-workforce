-- Allow supervisors to manage assignments in their branch
CREATE POLICY "Branch supervisors can manage branch assignments"
ON public.project_assignments
FOR ALL
TO authenticated
USING (
  (EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = project_assignments.project_id
    AND p.branch_id = get_user_branch_id()
  ))
  AND
  (EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN users u ON u.id = ur.user_id
    WHERE u.auth_id = auth.uid()
    AND ur.role IN ('supervisor', 'manager', 'admin')
  ))
)
WITH CHECK (
  (EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = project_assignments.project_id
    AND p.branch_id = get_user_branch_id()
  ))
  AND
  (EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN users u ON u.id = ur.user_id
    WHERE u.auth_id = auth.uid()
    AND ur.role IN ('supervisor', 'manager', 'admin')
  ))
);