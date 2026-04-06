
CREATE OR REPLACE FUNCTION public.update_morning_briefing_cron(cron_expr text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _supabase_url text;
  _anon_key text;
BEGIN
  SELECT decrypted_secret INTO _supabase_url FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;
  SELECT decrypted_secret INTO _anon_key FROM vault.decrypted_secrets WHERE name = 'SUPABASE_ANON_KEY' LIMIT 1;

  BEGIN
    PERFORM cron.unschedule('morning-briefing-daily');
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  PERFORM cron.schedule(
    'morning-briefing-daily',
    cron_expr,
    format(
      $cron$
      SELECT net.http_post(
        url:='%s/functions/v1/morning-briefing',
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
