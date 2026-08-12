-- Move sessions off the blank duplicate log, then delete it
UPDATE public.project_work_sessions SET attendance_log_id = '07b28f0a-0b0b-47dc-aa81-09be9d2ae228'
WHERE attendance_log_id = '5f42d5a0-7f96-476d-add5-d20e40488e51';
UPDATE public.site_visit_work_sessions SET attendance_log_id = '07b28f0a-0b0b-47dc-aa81-09be9d2ae228'
WHERE attendance_log_id = '5f42d5a0-7f96-476d-add5-d20e40488e51';
UPDATE public.common_task_sessions SET attendance_log_id = '07b28f0a-0b0b-47dc-aa81-09be9d2ae228'
WHERE attendance_log_id = '5f42d5a0-7f96-476d-add5-d20e40488e51';
DELETE FROM public.travel_pings WHERE attendance_log_id = '5f42d5a0-7f96-476d-add5-d20e40488e51';
DELETE FROM public.attendance_logs WHERE id = '5f42d5a0-7f96-476d-add5-d20e40488e51';

-- File the 22:27 (Dubai) punch-in under the day it actually started
UPDATE public.attendance_logs
SET date = (office_punch_in + interval '4 hours')::date
WHERE id = '07b28f0a-0b0b-47dc-aa81-09be9d2ae228';