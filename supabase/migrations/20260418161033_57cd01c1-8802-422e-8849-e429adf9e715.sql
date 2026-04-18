-- Make base_skill_type optional (custom skills are now just labels)
ALTER TABLE public.custom_skills
  ALTER COLUMN base_skill_type DROP NOT NULL,
  ALTER COLUMN base_skill_type DROP DEFAULT;

-- Per-skill permissions (mirrors role_permissions)
CREATE TABLE public.skill_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  custom_skill_id uuid NOT NULL REFERENCES public.custom_skills(id) ON DELETE CASCADE,
  module text NOT NULL,
  can_view boolean NOT NULL DEFAULT true,
  can_create boolean NOT NULL DEFAULT false,
  can_edit boolean NOT NULL DEFAULT false,
  can_delete boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.users(id),
  UNIQUE (custom_skill_id, module)
);

ALTER TABLE public.skill_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view skill permissions"
  ON public.skill_permissions FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage skill permissions"
  ON public.skill_permissions FOR ALL
  USING (is_admin());

-- Auto-seed default permissions (view-only) for every module when a new custom skill is created
CREATE OR REPLACE FUNCTION public.seed_skill_permissions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.skill_permissions (custom_skill_id, module, can_view, can_create, can_edit, can_delete)
  SELECT NEW.id, m, true, false, false, false
  FROM unnest(ARRAY['dashboard','projects','employees','schedule','attendance','timesheets','reports','settings']) AS m;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_seed_skill_permissions
  AFTER INSERT ON public.custom_skills
  FOR EACH ROW
  EXECUTE FUNCTION public.seed_skill_permissions();

-- Backfill default permissions for existing custom skills
INSERT INTO public.skill_permissions (custom_skill_id, module, can_view)
SELECT cs.id, m, true
FROM public.custom_skills cs
CROSS JOIN unnest(ARRAY['dashboard','projects','employees','schedule','attendance','timesheets','reports','settings']) AS m
ON CONFLICT (custom_skill_id, module) DO NOTHING;