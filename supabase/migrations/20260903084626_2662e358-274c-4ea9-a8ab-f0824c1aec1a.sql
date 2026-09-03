UPDATE public.driver_trip_legs l
SET attendance_log_id = NULL
WHERE l.attendance_log_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.attendance_logs a WHERE a.id = l.attendance_log_id);

ALTER TABLE public.driver_trip_legs
  ADD CONSTRAINT driver_trip_legs_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.employees(id),
  ADD CONSTRAINT driver_trip_legs_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id),
  ADD CONSTRAINT driver_trip_legs_attendance_log_id_fkey FOREIGN KEY (attendance_log_id) REFERENCES public.attendance_logs(id);