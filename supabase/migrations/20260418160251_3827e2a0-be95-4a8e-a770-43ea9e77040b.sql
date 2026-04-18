-- Custom skill roles (admin-managed)
CREATE TABLE public.custom_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  base_skill_type public.skill_type NOT NULL DEFAULT 'team_member',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.users(id)
);

ALTER TABLE public.custom_skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view custom skills"
  ON public.custom_skills FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage custom skills"
  ON public.custom_skills FOR ALL
  USING (is_admin());

-- Add custom_skill reference on employees (nullable; system still uses skill_type enum)
ALTER TABLE public.employees
  ADD COLUMN custom_skill_id uuid REFERENCES public.custom_skills(id) ON DELETE SET NULL;