-- Enum for holiday rate type
CREATE TYPE public.holiday_rate_type AS ENUM ('multiplier', 'fixed');

-- Public holidays table
CREATE TABLE public.public_holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  name TEXT NOT NULL,
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_public_holidays_date ON public.public_holidays(date);
CREATE UNIQUE INDEX idx_public_holidays_unique ON public.public_holidays(date, COALESCE(branch_id, '00000000-0000-0000-0000-000000000000'::uuid));

ALTER TABLE public.public_holidays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage public holidays"
  ON public.public_holidays FOR ALL
  USING (is_admin());

CREATE POLICY "Authenticated can view public holidays"
  ON public.public_holidays FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Add holiday rate columns to custom_skills
ALTER TABLE public.custom_skills
  ADD COLUMN holiday_rate_type public.holiday_rate_type NOT NULL DEFAULT 'multiplier',
  ADD COLUMN holiday_rate_value NUMERIC NOT NULL DEFAULT 1.5;

-- Add holiday tracking to attendance_logs
ALTER TABLE public.attendance_logs
  ADD COLUMN is_holiday BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN holiday_premium_cost NUMERIC DEFAULT 0;