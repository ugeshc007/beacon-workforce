-- Allow admins and branch managers to delete branches
CREATE POLICY "Admins can delete branches"
ON public.branches
FOR DELETE
USING (is_admin());
