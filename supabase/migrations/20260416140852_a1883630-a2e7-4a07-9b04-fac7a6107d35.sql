CREATE OR REPLACE FUNCTION public.prevent_employee_sensitive_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Allow service role (no auth.uid set) to update freely
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Only restrict non-admin/non-manager users
  IF NOT EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN users u ON u.id = ur.user_id
    WHERE u.auth_id = auth.uid()
      AND ur.role IN ('admin', 'manager')
  ) THEN
    -- Prevent changes to sensitive computed/payroll/audit fields
    NEW.total_work_minutes := OLD.total_work_minutes;
    NEW.overtime_minutes := OLD.overtime_minutes;
    NEW.regular_cost := OLD.regular_cost;
    NEW.overtime_cost := OLD.overtime_cost;
    NEW.is_manual_override := OLD.is_manual_override;
    NEW.override_reason := OLD.override_reason;
    NEW.override_by := OLD.override_by;
    NEW.office_punch_in_spoofed := OLD.office_punch_in_spoofed;
    NEW.office_punch_in_valid := OLD.office_punch_in_valid;
    NEW.office_punch_in_accuracy := OLD.office_punch_in_accuracy;
    NEW.office_punch_in_distance_m := OLD.office_punch_in_distance_m;
    NEW.site_arrival_valid := OLD.site_arrival_valid;
    NEW.site_arrival_distance_m := OLD.site_arrival_distance_m;
    NEW.employee_id := OLD.employee_id;
    NEW.date := OLD.date;
    NEW.project_id := OLD.project_id;
  END IF;
  RETURN NEW;
END;
$function$;