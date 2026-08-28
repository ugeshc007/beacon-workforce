ALTER TABLE public.attendance_logs
  ADD COLUMN IF NOT EXISTS derived_worked_minutes integer,
  ADD COLUMN IF NOT EXISTS derived_travel_minutes integer,
  ADD COLUMN IF NOT EXISTS derived_idle_minutes integer,
  ADD COLUMN IF NOT EXISTS derived_break_minutes integer,
  ADD COLUMN IF NOT EXISTS derived_overtime_minutes integer,
  ADD COLUMN IF NOT EXISTS derived_computed_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS idx_attendance_logs_derived_pending
  ON public.attendance_logs (date)
  WHERE derived_computed_at IS NULL;

CREATE TABLE IF NOT EXISTS public.backfill_jobs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_name text NOT NULL UNIQUE,
  is_paused boolean NOT NULL DEFAULT false,
  pause_reason text,
  cursor_date date,
  earliest_date date,
  lock_owner text,
  lock_expires_at timestamp with time zone,
  last_run_at timestamp with time zone,
  last_error text,
  dates_processed integer NOT NULL DEFAULT 0,
  rows_processed integer NOT NULL DEFAULT 0,
  is_complete boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.backfill_jobs TO authenticated;
GRANT ALL ON public.backfill_jobs TO service_role;

ALTER TABLE public.backfill_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and managers can view backfill jobs"
  ON public.backfill_jobs FOR SELECT TO authenticated
  USING (
    public.has_role(public.get_user_id(), 'admin')
    OR public.has_role(public.get_user_id(), 'manager')
    OR public.is_super_admin()
  );

CREATE TRIGGER trg_backfill_jobs_updated_at
  BEFORE UPDATE ON public.backfill_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_pws_updated_at();

INSERT INTO public.backfill_jobs (job_name)
VALUES ('derived-attendance-metrics')
ON CONFLICT (job_name) DO NOTHING;

CREATE OR REPLACE FUNCTION public.update_derived_backfill_cron(cron_expr text DEFAULT '*/10 * * * *')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _supabase_url text;
  _anon_key text;
BEGIN
  SELECT decrypted_secret INTO _supabase_url FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;
  SELECT decrypted_secret INTO _anon_key FROM vault.decrypted_secrets WHERE name = 'SUPABASE_ANON_KEY' LIMIT 1;

  BEGIN
    PERFORM cron.unschedule('backfill-derived-metrics');
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  PERFORM cron.schedule(
    'backfill-derived-metrics',
    cron_expr,
    format(
      $cron$
      SELECT net.http_post(
        url:='%s/functions/v1/backfill-derived-metrics',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer %s"}'::jsonb,
        body:='{}'::jsonb
      ) as request_id;
      $cron$,
      _supabase_url,
      _anon_key
    )
  );
END;
$function$;