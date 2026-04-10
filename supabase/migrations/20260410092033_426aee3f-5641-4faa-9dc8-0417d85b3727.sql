
-- Rename old values and add new one
ALTER TYPE public.project_status RENAME VALUE 'planned' TO 'on_hold';

-- Move 'assigned' projects to 'on_hold' first
UPDATE public.projects SET status = 'on_hold' WHERE status = 'assigned';

-- Remove 'assigned' by recreating the enum
-- Step 1: Create new enum
CREATE TYPE public.project_status_new AS ENUM ('on_hold', 'in_progress', 'completed');

-- Step 2: Alter column to use new enum
ALTER TABLE public.projects
  ALTER COLUMN status DROP DEFAULT,
  ALTER COLUMN status TYPE public.project_status_new USING status::text::public.project_status_new,
  ALTER COLUMN status SET DEFAULT 'on_hold'::public.project_status_new;

-- Step 3: Drop old enum and rename
DROP TYPE public.project_status;
ALTER TYPE public.project_status_new RENAME TO project_status;
