import { createSupabaseAdmin, jsonResponse, errorResponse, corsResponse, todayDate, nowTimestamp, resolveTimestamp, checkIdempotency, authenticateEmployee } from "../_shared/helpers.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse();

  try {
    const { employee_id, client_timestamp, idempotency_key } = await req.json();
    if (!employee_id) return errorResponse("employee_id is required");

    const supabase = createSupabaseAdmin();

    const auth = await authenticateEmployee(req, supabase, employee_id);
    if (auth.error) return auth.error;

    const today = todayDate();
    const now = resolveTimestamp(client_timestamp);
    const dup = await checkIdempotency(supabase, idempotency_key, employee_id, "start-break");
    if (dup) return dup;

    const { data: log } = await supabase
      .from("attendance_logs")
      .select("id, work_start_time, work_end_time, break_start_time, break_end_time, office_punch_out")
      .eq("employee_id", employee_id)
      .eq("date", today)
      .maybeSingle();

    if (!log) return errorResponse("Must punch in first", 400);
    if (log.office_punch_out) return errorResponse("Already punched out for the day", 400);
    if (!log.work_start_time) return errorResponse("Must start work before taking a break", 400);
    if (log.work_end_time) return errorResponse("Work already ended", 400);
    if (log.break_start_time && !log.break_end_time) return errorResponse("Break already in progress", 400);

    const { error } = await supabase
      .from("attendance_logs")
      .update({ break_start_time: now })
      .eq("id", log.id);

    if (error) return errorResponse(error.message, 500);

    return jsonResponse({ success: true, attendance_id: log.id, timestamp: now });
  } catch (err) {
    return errorResponse(err, 500);
  }
});
