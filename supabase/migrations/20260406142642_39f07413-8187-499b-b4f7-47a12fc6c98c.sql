
CREATE OR REPLACE FUNCTION public.update_absent_check_cron(cron_expr text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _supabase_url text;
  _anon_key text;
BEGIN
  -- Get config values from vault/env
  SELECT decrypted_secret INTO _supabase_url FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;
  SELECT decrypted_secret INTO _anon_key FROM vault.decrypted_secrets WHERE name = 'SUPABASE_ANON_KEY' LIMIT 1;

  -- Unschedule existing job (ignore if not exists)
  BEGIN
    PERFORM cron.unschedule('check-absent-daily-9am-uae');
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- Schedule new job
  PERFORM cron.schedule(
    'check-absent-daily-9am-uae',
    cron_expr,
    format(
      $cron$
      SELECT net.http_post(
        url:='%s/functions/v1/check-absent',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer %s"}'::jsonb,
        body:='{}'::jsonb
      ) as request_id;
      $cron$,
      _supabase_url,
      _anon_key
    )
  );
END;
$$;
