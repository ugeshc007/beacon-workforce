
-- Add custom domain column (one per company, optional)
ALTER TABLE public.companies ADD COLUMN domain text UNIQUE;

-- Seed BeBright's custom domain
UPDATE public.companies
   SET domain = 'planner.bebright.global'
 WHERE id = '00000000-0000-0000-0000-000000000001'::uuid;

-- Public tenant-resolver: callable from the login page before auth.
-- Returns ONLY safe display fields. Never exposes contact info, plan, etc.
CREATE OR REPLACE FUNCTION public.resolve_tenant(_host text DEFAULT NULL, _slug text DEFAULT NULL)
RETURNS TABLE (
  id uuid,
  name text,
  slug text,
  logo_url text,
  primary_color text,
  accent_color text,
  is_active boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, name, slug, logo_url, primary_color, accent_color, is_active
  FROM public.companies
  WHERE (_host IS NOT NULL AND domain = _host)
     OR (_slug IS NOT NULL AND slug = _slug)
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.resolve_tenant(text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.resolve_tenant(text, text) TO anon, authenticated, service_role;
