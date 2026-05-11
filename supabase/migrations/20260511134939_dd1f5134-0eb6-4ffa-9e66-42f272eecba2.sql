
CREATE TYPE public.work_location_type AS ENUM ('in_house', 'site');

CREATE TABLE public.project_day_work_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  date date NOT NULL,
  location public.work_location_type NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, date)
);

CREATE INDEX idx_pdwl_project_date ON public.project_day_work_locations(project_id, date);

ALTER TABLE public.project_day_work_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all work locations"
ON public.project_day_work_locations FOR ALL
USING (is_admin());

CREATE POLICY "Branch managers manage branch work locations"
ON public.project_day_work_locations FOR ALL
USING (
  EXISTS (SELECT 1 FROM projects p WHERE p.id = project_id AND p.branch_id = get_user_branch_id())
  AND EXISTS (SELECT 1 FROM user_roles ur JOIN users u ON u.id = ur.user_id
    WHERE u.auth_id = auth.uid() AND ur.role IN ('manager','admin','team_leader'))
);

CREATE POLICY "Branch users view branch work locations"
ON public.project_day_work_locations FOR SELECT
USING (
  EXISTS (SELECT 1 FROM projects p WHERE p.id = project_id AND p.branch_id = get_user_branch_id())
);

CREATE POLICY "Assigned employees view own project work locations"
ON public.project_day_work_locations FOR SELECT
USING (employee_has_project_assignment(project_id));

CREATE TRIGGER trg_pdwl_updated_at
BEFORE UPDATE ON public.project_day_work_locations
FOR EACH ROW EXECUTE FUNCTION public.update_pws_updated_at();
