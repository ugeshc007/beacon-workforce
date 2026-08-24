CREATE OR REPLACE FUNCTION public.update_day_incomplete_cron(cron_expr text DEFAULT '30 20 * * *')
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
    PERFORM cron.unschedule('close-day-incomplete-nightly');
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  PERFORM cron.schedule(
    'close-day-incomplete-nightly',
    cron_expr,
    format(
      $cron$
      SELECT net.http_post(
        url:='%s/functions/v1/close-day-incomplete',
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

-- 20:30 UTC = 00:30 Dubai (next day)
SELECT public.update_day_incomplete_cron('30 20 * * *');