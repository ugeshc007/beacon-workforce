
-- Create project daily logs table
CREATE TABLE public.project_daily_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT NOT NULL,
  completion_pct INTEGER DEFAULT NULL CHECK (completion_pct >= 0 AND completion_pct <= 100),
  issues TEXT DEFAULT NULL,
  photo_urls TEXT[] DEFAULT '{}',
  posted_by UUID REFERENCES public.users(id),
  employee_id UUID REFERENCES public.employees(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.project_daily_logs ENABLE ROW LEVEL SECURITY;

-- Admins full access
CREATE POLICY "Admins can manage all daily logs"
ON public.project_daily_logs FOR ALL
USING (is_admin());

-- Branch managers full access
CREATE POLICY "Branch managers can manage branch daily logs"
ON public.project_daily_logs FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = project_daily_logs.project_id
    AND p.branch_id = get_user_branch_id()
  )
  AND EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN users u ON u.id = ur.user_id
    WHERE u.auth_id = auth.uid()
    AND ur.role IN ('manager', 'admin')
  )
);

-- Branch team leaders can view and insert
CREATE POLICY "Team leaders can view branch daily logs"
ON public.project_daily_logs FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = project_daily_logs.project_id
    AND p.branch_id = get_user_branch_id()
  )
  AND EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN users u ON u.id = ur.user_id
    WHERE u.auth_id = auth.uid()
    AND ur.role = 'team_leader'
  )
);

CREATE POLICY "Team leaders can insert branch daily logs"
ON public.project_daily_logs FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = project_daily_logs.project_id
    AND p.branch_id = get_user_branch_id()
  )
  AND EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN users u ON u.id = ur.user_id
    WHERE u.auth_id = auth.uid()
    AND ur.role = 'team_leader'
  )
);

-- Assigned employees can view and insert
CREATE POLICY "Assigned employees can view project logs"
ON public.project_daily_logs FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM project_assignments pa
    JOIN employees e ON e.id = pa.employee_id
    WHERE pa.project_id = project_daily_logs.project_id
    AND e.auth_id = auth.uid()
  )
);

CREATE POLICY "Assigned employees can insert project logs"
ON public.project_daily_logs FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM project_assignments pa
    JOIN employees e ON e.id = pa.employee_id
    WHERE pa.project_id = project_daily_logs.project_id
    AND e.auth_id = auth.uid()
  )
);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.project_daily_logs;

-- Storage bucket for daily log photos
INSERT INTO storage.buckets (id, name, public) VALUES ('daily-log-photos', 'daily-log-photos', true);

-- Storage policies
CREATE POLICY "Anyone can view daily log photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'daily-log-photos');

CREATE POLICY "Authenticated users can upload daily log photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'daily-log-photos');

CREATE POLICY "Authenticated users can delete own photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'daily-log-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
