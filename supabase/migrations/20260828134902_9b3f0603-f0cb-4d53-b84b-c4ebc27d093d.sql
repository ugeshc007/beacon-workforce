CREATE OR REPLACE FUNCTION public.invalidate_derived_metrics()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.office_punch_in IS DISTINCT FROM OLD.office_punch_in
     OR NEW.office_punch_out IS DISTINCT FROM OLD.office_punch_out
     OR NEW.travel_start_time IS DISTINCT FROM OLD.travel_start_time
     OR NEW.site_arrival_time IS DISTINCT FROM OLD.site_arrival_time
     OR NEW.work_start_time IS DISTINCT FROM OLD.work_start_time
     OR NEW.work_end_time IS DISTINCT FROM OLD.work_end_time
     OR NEW.break_start_time IS DISTINCT FROM OLD.break_start_time
     OR NEW.break_end_time IS DISTINCT FROM OLD.break_end_time
     OR NEW.break_minutes IS DISTINCT FROM OLD.break_minutes
     OR NEW.return_travel_start_time IS DISTINCT FROM OLD.return_travel_start_time
     OR NEW.office_arrival_time IS DISTINCT FROM OLD.office_arrival_time
  THEN
    NEW.derived_computed_at := NULL;
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.invalidate_derived_metrics() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.invalidate_derived_metrics() FROM anon;
REVOKE ALL ON FUNCTION public.invalidate_derived_metrics() FROM authenticated;

DROP TRIGGER IF EXISTS trg_invalidate_derived_metrics ON public.attendance_logs;
CREATE TRIGGER trg_invalidate_derived_metrics
  BEFORE UPDATE ON public.attendance_logs
  FOR EACH ROW EXECUTE FUNCTION public.invalidate_derived_metrics();

CREATE OR REPLACE FUNCTION public.invalidate_derived_metrics_from_session()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _log uuid;
BEGIN
  _log := COALESCE(NEW.attendance_log_id, OLD.attendance_log_id);
  IF _log IS NOT NULL THEN
    UPDATE public.attendance_logs SET derived_computed_at = NULL WHERE id = _log;
  END IF;
  RETURN NULL;
END;
$function$;

REVOKE ALL ON FUNCTION public.invalidate_derived_metrics_from_session() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.invalidate_derived_metrics_from_session() FROM anon;
REVOKE ALL ON FUNCTION public.invalidate_derived_metrics_from_session() FROM authenticated;

DROP TRIGGER IF EXISTS trg_pws_invalidate_derived ON public.project_work_sessions;
CREATE TRIGGER trg_pws_invalidate_derived
  AFTER INSERT OR UPDATE OR DELETE ON public.project_work_sessions
  FOR EACH ROW EXECUTE FUNCTION public.invalidate_derived_metrics_from_session();