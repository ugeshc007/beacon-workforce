import { createSupabaseAdmin, jsonResponse, errorResponse, corsResponse, todayDate, nowTimestamp, resolveTimestamp, checkIdempotency, authenticateEmployee, findOpenAttendanceLog } from "../_shared/helpers.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse();

  try {
    const { employee_id, client_timestamp, idempotency_key, lat, lng } = await req.json();

    if (!employee_id || lat == null || lng == null) {
      return errorResponse("employee_id, lat, and lng are required");
    }

    const supabase = createSupabaseAdmin();

    const auth = await authenticateEmployee(req, supabase, employee_id);
    if (auth.error) return auth.error;

    const today = todayDate();
    const now = resolveTimestamp(client_timestamp);
    const dup = await checkIdempotency(supabase, idempotency_key, employee_id, "start-travel");
    if (dup) return dup;

    const { data: log } = await supabase
      .from("attendance_logs")
      .select("id, office_punch_in, travel_start_time, work_end_time, office_punch_out")
      .eq("employee_id", employee_id)
      .eq("date", today)
      .maybeSingle();

    if (!log) return errorResponse("Must punch in at office first", 400);
    if (!log.office_punch_in) return errorResponse("Must punch in at office first", 400);
    if (log.office_punch_out) return errorResponse("Already punched out for the day", 400);
    if (log.travel_start_time) return errorResponse("Travel already started", 400);

    const { error } = await supabase
      .from("attendance_logs")
      .update({
        travel_start_time: now,
        travel_start_lat: lat,
        travel_start_lng: lng,
      })
      .eq("id", log.id);

    if (error) return errorResponse(error.message, 500);

    return jsonResponse({ success: true, attendance_id: log.id, timestamp: now });
  } catch (err) {
    return errorResponse(err, 500);
  }
});
