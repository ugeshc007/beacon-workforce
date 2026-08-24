REVOKE EXECUTE ON FUNCTION public.update_day_incomplete_cron(text) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_day_incomplete_cron(text) TO service_role;