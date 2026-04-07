
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
