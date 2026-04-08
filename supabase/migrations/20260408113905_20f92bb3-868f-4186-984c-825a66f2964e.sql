
-- Rename enum values
ALTER TYPE public.user_role RENAME VALUE 'supervisor' TO 'team_leader';
ALTER TYPE public.skill_type RENAME VALUE 'supervisor' TO 'team_leader';

-- Recreate the project_assignments policy that references 'supervisor'
DROP POLICY IF EXISTS "Branch supervisors can manage branch assignments" ON public.project_assignments;

CREATE POLICY "Branch team leaders can manage branch assignments"
ON public.project_assignments
FOR ALL
TO authenticated
USING (
  (EXISTS ( SELECT 1 FROM projects p WHERE p.id = project_assignments.project_id AND p.branch_id = get_user_branch_id()))
  AND (EXISTS ( SELECT 1 FROM user_roles ur JOIN users u ON u.id = ur.user_id WHERE u.auth_id = auth.uid() AND ur.role = ANY (ARRAY['team_leader'::user_role, 'manager'::user_role, 'admin'::user_role])))
)
WITH CHECK (
  (EXISTS ( SELECT 1 FROM projects p WHERE p.id = project_assignments.project_id AND p.branch_id = get_user_branch_id()))
  AND (EXISTS ( SELECT 1 FROM user_roles ur JOIN users u ON u.id = ur.user_id WHERE u.auth_id = auth.uid() AND ur.role = ANY (ARRAY['team_leader'::user_role, 'manager'::user_role, 'admin'::user_role])))
);

-- Update role_permissions rows
UPDATE public.role_permissions SET role = 'team_leader'::user_role WHERE role = 'team_leader'::user_role;
