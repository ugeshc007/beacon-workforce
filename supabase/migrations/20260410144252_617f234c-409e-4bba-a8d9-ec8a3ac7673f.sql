
-- Create a security definer function to check project assignments without RLS recursion
CREATE OR REPLACE FUNCTION public.employee_has_project_assignment(_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM project_assignments pa
    JOIN employees e ON e.id = pa.employee_id
    WHERE pa.project_id = _project_id
      AND e.auth_id = auth.uid()
  )
$$;

-- Drop the recursive policy
DROP POLICY IF EXISTS "Employees can view assigned projects" ON public.projects;

-- Recreate with the security definer function
CREATE POLICY "Employees can view assigned projects"
ON public.projects
FOR SELECT
USING (public.employee_has_project_assignment(id));
