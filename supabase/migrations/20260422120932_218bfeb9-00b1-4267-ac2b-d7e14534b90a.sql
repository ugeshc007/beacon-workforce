-- Enums
CREATE TYPE public.site_visit_status AS ENUM ('pending', 'in_progress', 'completed', 'cancelled', 'converted');
CREATE TYPE public.site_visit_priority AS ENUM ('low', 'normal', 'high', 'urgent');

-- Main table
CREATE TABLE public.site_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  -- Lead info (admin)
  client_name TEXT NOT NULL,
  client_contact TEXT,
  client_email TEXT,
  site_address TEXT,
  site_latitude NUMERIC,
  site_longitude NUMERIC,
  project_type TEXT,
  scope_brief TEXT,
  visit_date DATE NOT NULL,
  priority public.site_visit_priority NOT NULL DEFAULT 'normal',
  lead_source TEXT,
  admin_notes TEXT,
  -- Assignment
  assigned_employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  assigned_by UUID REFERENCES public.users(id),
  status public.site_visit_status NOT NULL DEFAULT 'pending',
  -- Site report (employee)
  site_accessibility TEXT,
  site_dimensions TEXT,
  screen_type TEXT,
  screen_size TEXT,
  mounting_type TEXT,
  power_availability TEXT,
  data_availability TEXT,
  internet_available BOOLEAN,
  structural_notes TEXT,
  environmental_notes TEXT,
  challenges TEXT,
  recommendations TEXT,
  employee_notes TEXT,
  -- Completion
  completed_at TIMESTAMPTZ,
  signature_url TEXT,
  signed_by_name TEXT,
  converted_to_project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_site_visits_branch ON public.site_visits(branch_id);
CREATE INDEX idx_site_visits_employee ON public.site_visits(assigned_employee_id);
CREATE INDEX idx_site_visits_status ON public.site_visits(status);
CREATE INDEX idx_site_visits_visit_date ON public.site_visits(visit_date);

-- Photos table
CREATE TABLE public.site_visit_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_visit_id UUID NOT NULL REFERENCES public.site_visits(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  caption TEXT,
  uploaded_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_site_visit_photos_visit ON public.site_visit_photos(site_visit_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_site_visits_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_site_visits_updated_at
BEFORE UPDATE ON public.site_visits
FOR EACH ROW EXECUTE FUNCTION public.update_site_visits_updated_at();

-- RLS
ALTER TABLE public.site_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_visit_photos ENABLE ROW LEVEL SECURITY;

-- site_visits policies
CREATE POLICY "Admins manage all site visits" ON public.site_visits
FOR ALL USING (is_admin());

CREATE POLICY "Branch managers manage branch site visits" ON public.site_visits
FOR ALL USING (
  branch_id = get_user_branch_id()
  AND EXISTS (
    SELECT 1 FROM user_roles ur JOIN users u ON u.id = ur.user_id
    WHERE u.auth_id = auth.uid() AND ur.role IN ('manager','admin')
  )
);

CREATE POLICY "Branch users view branch site visits" ON public.site_visits
FOR SELECT USING (
  branch_id = get_user_branch_id()
  AND EXISTS (
    SELECT 1 FROM user_roles ur JOIN users u ON u.id = ur.user_id
    WHERE u.auth_id = auth.uid() AND ur.role IN ('admin','manager','team_leader')
  )
);

CREATE POLICY "Assigned employees view own site visits" ON public.site_visits
FOR SELECT USING (
  EXISTS (SELECT 1 FROM employees e WHERE e.id = assigned_employee_id AND e.auth_id = auth.uid())
);

CREATE POLICY "Assigned employees update own site visits" ON public.site_visits
FOR UPDATE USING (
  EXISTS (SELECT 1 FROM employees e WHERE e.id = assigned_employee_id AND e.auth_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM employees e WHERE e.id = assigned_employee_id AND e.auth_id = auth.uid())
);

-- site_visit_photos policies
CREATE POLICY "Admins manage all site visit photos" ON public.site_visit_photos
FOR ALL USING (is_admin());

CREATE POLICY "Branch managers manage branch site visit photos" ON public.site_visit_photos
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM site_visits sv WHERE sv.id = site_visit_id AND sv.branch_id = get_user_branch_id()
  ) AND EXISTS (
    SELECT 1 FROM user_roles ur JOIN users u ON u.id = ur.user_id
    WHERE u.auth_id = auth.uid() AND ur.role IN ('manager','admin')
  )
);

CREATE POLICY "Branch users view branch site visit photos" ON public.site_visit_photos
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM site_visits sv WHERE sv.id = site_visit_id AND sv.branch_id = get_user_branch_id()
  ) AND EXISTS (
    SELECT 1 FROM user_roles ur JOIN users u ON u.id = ur.user_id
    WHERE u.auth_id = auth.uid() AND ur.role IN ('admin','manager','team_leader')
  )
);

CREATE POLICY "Assigned employees view own site visit photos" ON public.site_visit_photos
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM site_visits sv JOIN employees e ON e.id = sv.assigned_employee_id
    WHERE sv.id = site_visit_id AND e.auth_id = auth.uid()
  )
);

CREATE POLICY "Assigned employees insert own site visit photos" ON public.site_visit_photos
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM site_visits sv JOIN employees e ON e.id = sv.assigned_employee_id
    WHERE sv.id = site_visit_id AND e.auth_id = auth.uid()
  )
);

CREATE POLICY "Assigned employees delete own site visit photos" ON public.site_visit_photos
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM site_visits sv JOIN employees e ON e.id = sv.assigned_employee_id
    WHERE sv.id = site_visit_id AND e.auth_id = auth.uid()
  )
);

-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('site-visit-photos', 'site-visit-photos', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('site-visit-signatures', 'site-visit-signatures', false);

-- Storage policies (path format: {site_visit_id}/{filename})
CREATE POLICY "Branch users view site visit photo files" ON storage.objects
FOR SELECT USING (
  bucket_id = 'site-visit-photos'
  AND (
    is_admin()
    OR EXISTS (
      SELECT 1 FROM site_visits sv
      WHERE sv.id::text = (storage.foldername(name))[1]
        AND (
          sv.branch_id = get_user_branch_id()
          OR EXISTS (SELECT 1 FROM employees e WHERE e.id = sv.assigned_employee_id AND e.auth_id = auth.uid())
        )
    )
  )
);

CREATE POLICY "Authorized users upload site visit photos" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'site-visit-photos'
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM site_visits sv
    WHERE sv.id::text = (storage.foldername(name))[1]
      AND (
        is_admin()
        OR sv.branch_id = get_user_branch_id()
        OR EXISTS (SELECT 1 FROM employees e WHERE e.id = sv.assigned_employee_id AND e.auth_id = auth.uid())
      )
  )
);

CREATE POLICY "Authorized users delete site visit photos" ON storage.objects
FOR DELETE USING (
  bucket_id = 'site-visit-photos'
  AND EXISTS (
    SELECT 1 FROM site_visits sv
    WHERE sv.id::text = (storage.foldername(name))[1]
      AND (
        is_admin()
        OR sv.branch_id = get_user_branch_id()
        OR EXISTS (SELECT 1 FROM employees e WHERE e.id = sv.assigned_employee_id AND e.auth_id = auth.uid())
      )
  )
);

CREATE POLICY "Branch users view site visit signatures" ON storage.objects
FOR SELECT USING (
  bucket_id = 'site-visit-signatures'
  AND (
    is_admin()
    OR EXISTS (
      SELECT 1 FROM site_visits sv
      WHERE sv.id::text = (storage.foldername(name))[1]
        AND (
          sv.branch_id = get_user_branch_id()
          OR EXISTS (SELECT 1 FROM employees e WHERE e.id = sv.assigned_employee_id AND e.auth_id = auth.uid())
        )
    )
  )
);

CREATE POLICY "Authorized users upload site visit signatures" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'site-visit-signatures'
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM site_visits sv
    WHERE sv.id::text = (storage.foldername(name))[1]
      AND (
        is_admin()
        OR sv.branch_id = get_user_branch_id()
        OR EXISTS (SELECT 1 FROM employees e WHERE e.id = sv.assigned_employee_id AND e.auth_id = auth.uid())
      )
  )
);

-- Seed permissions for site_visits module
INSERT INTO public.role_permissions (role, module, can_view, can_create, can_edit, can_delete) VALUES
  ('admin', 'site_visits', true, true, true, true),
  ('manager', 'site_visits', true, true, true, true),
  ('team_leader', 'site_visits', true, false, false, false)
ON CONFLICT DO NOTHING;