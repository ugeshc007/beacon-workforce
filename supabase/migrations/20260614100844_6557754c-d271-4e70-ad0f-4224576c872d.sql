
DROP POLICY IF EXISTS "Anyone view company logos" ON storage.objects;
CREATE POLICY "Anyone view company logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'company-logos');

DROP POLICY IF EXISTS "Super admins upload company logos" ON storage.objects;
CREATE POLICY "Super admins upload company logos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'company-logos' AND public.is_super_admin());

DROP POLICY IF EXISTS "Super admins update company logos" ON storage.objects;
CREATE POLICY "Super admins update company logos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'company-logos' AND public.is_super_admin());

DROP POLICY IF EXISTS "Super admins delete company logos" ON storage.objects;
CREATE POLICY "Super admins delete company logos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'company-logos' AND public.is_super_admin());
