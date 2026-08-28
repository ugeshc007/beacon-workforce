REVOKE ALL ON FUNCTION public.update_derived_backfill_cron(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_derived_backfill_cron(text) FROM anon;
REVOKE ALL ON FUNCTION public.update_derived_backfill_cron(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.update_derived_backfill_cron(text) TO service_role;