-- Create maintenance_images table
CREATE TABLE public.maintenance_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  maintenance_call_id uuid NOT NULL REFERENCES public.maintenance_calls(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  caption text,
  uploaded_by uuid REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.maintenance_images ENABLE ROW LEVEL SECURITY;

-- Admins full access
CREATE POLICY "Admins can manage all maintenance images"
ON public.maintenance_images FOR ALL
USING (is_admin());

-- Branch managers full access
CREATE POLICY "Branch managers can manage branch maintenance images"
ON public.maintenance_images FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM maintenance_calls mc
    WHERE mc.id = maintenance_images.maintenance_call_id
    AND mc.branch_id = get_user_branch_id()
  )
  AND EXISTS (
    SELECT 1 FROM user_roles ur JOIN users u ON u.id = ur.user_id
    WHERE u.auth_id = auth.uid() AND ur.role IN ('manager', 'admin')
  )
);

-- Branch users can view
CREATE POLICY "Branch users can view branch maintenance images"
ON public.maintenance_images FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM maintenance_calls mc
    WHERE mc.id = maintenance_images.maintenance_call_id
    AND mc.branch_id = get_user_branch_id()
  )
  AND EXISTS (
    SELECT 1 FROM user_roles ur JOIN users u ON u.id = ur.user_id
    WHERE u.auth_id = auth.uid() AND ur.role IN ('admin', 'manager', 'team_leader')
  )
);

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('maintenance-images', 'maintenance-images', false);

CREATE POLICY "Auth users can view maintenance images"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'maintenance-images');

CREATE POLICY "Auth users can upload maintenance images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'maintenance-images');

CREATE POLICY "Auth users can delete maintenance images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'maintenance-images');