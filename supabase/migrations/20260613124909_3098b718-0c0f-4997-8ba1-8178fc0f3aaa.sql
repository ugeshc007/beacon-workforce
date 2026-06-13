
-- Always-override trigger: for authenticated users, force company_id to their own,
-- regardless of what the caller sent. Falls back to BeBright only for service-role inserts.
CREATE OR REPLACE FUNCTION public.set_company_id_default()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _company uuid;
BEGIN
  _company := public.get_user_company_id();
  IF _company IS NOT NULL THEN
    NEW.company_id := _company;
  ELSIF NEW.company_id IS NULL THEN
    NEW.company_id := '00000000-0000-0000-0000-000000000001'::uuid;
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.set_user_company_id_default()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _company uuid;
BEGIN
  _company := public.get_user_company_id();
  IF _company IS NOT NULL THEN
    NEW.company_id := _company;
  END IF;
  RETURN NEW;
END; $$;

-- Add column defaults so TypeScript treats company_id as optional on insert
ALTER TABLE public.branches  ALTER COLUMN company_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;
ALTER TABLE public.employees ALTER COLUMN company_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;
ALTER TABLE public.projects  ALTER COLUMN company_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;
