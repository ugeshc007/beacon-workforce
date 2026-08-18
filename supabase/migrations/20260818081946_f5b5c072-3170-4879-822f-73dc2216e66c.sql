UPDATE public.attendance_logs
SET office_punch_out = NULL,
    office_punch_out_lat = NULL,
    office_punch_out_lng = NULL,
    office_punch_out_accuracy = NULL,
    office_punch_out_distance_m = NULL,
    office_punch_out_valid = NULL,
    is_incomplete_process = false,
    auto_closed_by_user = false,
    notes = NULL
WHERE date = CURRENT_DATE
  AND notes = 'Bulk-closed pending shift by admin (fresh start)';