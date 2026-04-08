
-- Create enums
CREATE TYPE public.maintenance_priority AS ENUM ('emergency', 'high', 'normal', 'low');
CREATE TYPE public.maintenance_status AS ENUM ('open', 'scheduled', 'in_progress', 'completed', 'closed');

-- Create maintenance_calls table
CREATE TABLE public.maintenance_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  contact_number text,
  location text,
  scope text,
  permit_required boolean NOT NULL DEFAULT false,
  priority maintenance_priority NOT NULL DEFAULT 'normal',
  status maintenance_status NOT NULL DEFAULT 'open',
  scheduled_date date,
  notes text,
  branch_id uuid NOT NULL REFERENCES public.branches(id),
  created_by uuid REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.maintenance_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all maintenance calls"
ON public.maintenance_calls FOR ALL TO public
USING (is_admin());

CREATE POLICY "Branch managers can manage branch maintenance"
ON public.maintenance_calls FOR ALL TO public
USING (
  branch_id = get_user_branch_id()
  AND EXISTS (
    SELECT 1 FROM user_roles ur JOIN users u ON u.id = ur.user_id
    WHERE u.auth_id = auth.uid() AND ur.role = ANY(ARRAY['manager'::user_role, 'admin'::user_role])
  )
);

CREATE POLICY "Branch users can view branch maintenance"
ON public.maintenance_calls FOR SELECT TO authenticated
USING (
  branch_id = get_user_branch_id()
  AND EXISTS (
    SELECT 1 FROM user_roles ur JOIN users u ON u.id = ur.user_id
    WHERE u.auth_id = auth.uid() AND ur.role = ANY(ARRAY['admin'::user_role, 'manager'::user_role, 'team_leader'::user_role])
  )
);

-- Create maintenance_assignments table
CREATE TABLE public.maintenance_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  maintenance_call_id uuid NOT NULL REFERENCES public.maintenance_calls(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id),
  date date NOT NULL,
  shift_start time DEFAULT '08:00',
  shift_end time DEFAULT '17:00',
  assigned_by uuid REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(maintenance_call_id, employee_id, date)
);

ALTER TABLE public.maintenance_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all maintenance assignments"
ON public.maintenance_assignments FOR ALL TO public
USING (is_admin());

CREATE POLICY "Branch managers can manage branch maintenance assignments"
ON public.maintenance_assignments FOR ALL TO public
USING (
  EXISTS (
    SELECT 1 FROM maintenance_calls mc
    WHERE mc.id = maintenance_assignments.maintenance_call_id
    AND mc.branch_id = get_user_branch_id()
  )
  AND EXISTS (
    SELECT 1 FROM user_roles ur JOIN users u ON u.id = ur.user_id
    WHERE u.auth_id = auth.uid() AND ur.role = ANY(ARRAY['manager'::user_role, 'admin'::user_role])
  )
);

CREATE POLICY "Branch users can view branch maintenance assignments"
ON public.maintenance_assignments FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM maintenance_calls mc
    WHERE mc.id = maintenance_assignments.maintenance_call_id
    AND mc.branch_id = get_user_branch_id()
  )
  AND EXISTS (
    SELECT 1 FROM user_roles ur JOIN users u ON u.id = ur.user_id
    WHERE u.auth_id = auth.uid() AND ur.role = ANY(ARRAY['admin'::user_role, 'manager'::user_role, 'team_leader'::user_role])
  )
);
