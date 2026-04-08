
-- Add team_member to skill_type enum
ALTER TYPE public.skill_type ADD VALUE IF NOT EXISTS 'team_member';

-- Add required_team_members column to projects
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS required_team_members integer NOT NULL DEFAULT 0;

-- Add required_team_members column to project_templates
ALTER TABLE public.project_templates ADD COLUMN IF NOT EXISTS required_team_members integer NOT NULL DEFAULT 0;
