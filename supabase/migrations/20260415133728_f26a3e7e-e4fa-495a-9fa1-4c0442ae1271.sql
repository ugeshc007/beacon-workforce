ALTER TABLE public.projects
ADD COLUMN has_warranty boolean NOT NULL DEFAULT false,
ADD COLUMN warranty_start_date date,
ADD COLUMN warranty_end_date date,
ADD COLUMN warranty_notes text,
ADD COLUMN warranty_notification_sent boolean NOT NULL DEFAULT false;