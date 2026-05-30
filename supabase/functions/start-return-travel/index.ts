import { createSupabaseAdmin, jsonResponse, errorResponse, corsResponse, todayDate, nowTimestamp, resolveTimestamp, checkIdempotency, authenticateEmployee, findOpenAttendanceLog } from "../_shared/helpers.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse();

  try {
    const { employee_id, client_timestamp, idempotency_key, lat, lng, accuracy } = await req.json();

    if (!employee_id || lat == null || lng == null) {
      return errorResponse("employee_id, lat, and lng are required");
    }

    const supabase = createSupabaseAdmin();

    const auth = await authenticateEmployee(req, supabase, employee_id);
    if (auth.error) return auth.error;

    const today = todayDate();
    const now = resolveTimestamp(client_timestamp);
    const dup = await checkIdempotency(supabase, idempotency_key, employee_id, "start-return-travel");
    if (dup) return dup;

    const log = await findOpenAttendanceLog(
      supabase,
      employee_id,
      "id, date, work_end_time"
    );

    if (!log) return errorResponse("Must punch in first", 400);

    // If work_end_time isn't set on attendance_logs, allow if all today's
    // project work sessions are completed (project-based flow). Aggregate
    // totals from those sessions onto the attendance log.
    if (!log.work_end_time) {
      const { data: sessions } = await supabase
        .from("project_work_sessions")
        .select("work_end_time, total_work_minutes, overtime_minutes, regular_cost, overtime_cost, break_minutes, status")
        .eq("employee_id", employee_id)
        .eq("date", log.date);

      const sess = sessions ?? [];
      if (sess.length === 0) return errorResponse("Must end work first", 400);
      const allDone = sess.every((s: any) => s.status === "completed" && s.work_end_time);
      if (!allDone) return errorResponse("Finish all projects before returning to office", 400);

      const sum = (k: string) => sess.reduce((a: number, s: any) => a + Number(s[k] ?? 0), 0);
      await supabase
        .from("attendance_logs")
        .update({
          work_end_time: now,
          total_work_minutes: sum("total_work_minutes"),
          overtime_minutes: sum("overtime_minutes"),
          regular_cost: Math.round(sum("regular_cost") * 100) / 100,
          overtime_cost: Math.round(sum("overtime_cost") * 100) / 100,
          break_minutes: sum("break_minutes"),
        })
        .eq("id", log.id);
    }

    const { error } = await supabase
      .from("attendance_logs")
      .update({
        return_travel_start_time: now,
        return_travel_start_lat: lat,
        return_travel_start_lng: lng,
        return_travel_start_accuracy: accuracy ?? null,
      })
      .eq("id", log.id);

    if (error) return errorResponse(error.message, 500);

    return jsonResponse({ success: true, attendance_id: log.id, timestamp: now });
  } catch (err) {
    return errorResponse(err, 500);
  }
});
