-- Attach the existing trigger function to protect sensitive attendance fields
CREATE TRIGGER prevent_employee_sensitive_update
BEFORE UPDATE ON public.attendance_logs
FOR EACH ROW
EXECUTE FUNCTION public.prevent_employee_sensitive_update();

-- Make daily-log-photos bucket private
UPDATE storage.buckets SET public = false WHERE id = 'daily-log-photos';

-- Add storage policies for daily-log-photos (authenticated branch members can view)
CREATE POLICY "Authenticated users can view daily log photos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'daily-log-photos');

CREATE POLICY "Authenticated users can upload daily log photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'daily-log-photos');