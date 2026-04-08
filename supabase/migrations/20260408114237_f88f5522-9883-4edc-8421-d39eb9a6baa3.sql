
-- Update all existing employees
UPDATE public.employees SET skill_type = 'team_member' WHERE skill_type IN ('technician', 'helper');

-- Populate required_team_members from existing columns
UPDATE public.projects SET required_team_members = required_technicians + required_helpers;

-- Populate required_team_members on templates
UPDATE public.project_templates SET required_team_members = required_technicians + required_helpers;
