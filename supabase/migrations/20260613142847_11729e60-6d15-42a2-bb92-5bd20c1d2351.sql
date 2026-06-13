
-- daily-log-photos (projects has company_id directly)
DROP POLICY IF EXISTS "Anyone can view daily log photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view daily log photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload daily log photos" ON storage.objects;
DROP POLICY IF EXISTS "Project members can upload daily log photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete own photos" ON storage.objects;

CREATE POLICY "Tenant users view daily log photos"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'daily-log-photos' AND (
      public.is_super_admin() OR EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id::text = (storage.foldername(name))[1]
          AND p.company_id = public.get_user_company_id()
      )
    )
  );

CREATE POLICY "Tenant users upload daily log photos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'daily-log-photos' AND auth.uid() IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id::text = (storage.foldername(name))[1]
        AND p.company_id = public.get_user_company_id()
    )
  );

CREATE POLICY "Tenant users delete daily log photos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'daily-log-photos' AND (
      public.is_super_admin() OR EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id::text = (storage.foldername(name))[1]
          AND p.company_id = public.get_user_company_id()
      )
    )
  );

-- maintenance-images (join through branches.company_id)
DROP POLICY IF EXISTS "Auth users can view maintenance images" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can upload maintenance images" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can delete maintenance images" ON storage.objects;

CREATE POLICY "Tenant users view maintenance images"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'maintenance-images' AND (
      public.is_super_admin() OR EXISTS (
        SELECT 1 FROM public.maintenance_calls mc
        JOIN public.branches b ON b.id = mc.branch_id
        WHERE mc.id::text = (storage.foldername(name))[1]
          AND b.company_id = public.get_user_company_id()
      )
    )
  );

CREATE POLICY "Tenant users upload maintenance images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'maintenance-images' AND auth.uid() IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.maintenance_calls mc
      JOIN public.branches b ON b.id = mc.branch_id
      WHERE mc.id::text = (storage.foldername(name))[1]
        AND b.company_id = public.get_user_company_id()
    )
  );

CREATE POLICY "Tenant users delete maintenance images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'maintenance-images' AND (
      public.is_super_admin() OR EXISTS (
        SELECT 1 FROM public.maintenance_calls mc
        JOIN public.branches b ON b.id = mc.branch_id
        WHERE mc.id::text = (storage.foldername(name))[1]
          AND b.company_id = public.get_user_company_id()
      )
    )
  );
