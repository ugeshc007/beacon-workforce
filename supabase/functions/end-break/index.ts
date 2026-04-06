import { createSupabaseAdmin, jsonResponse, errorResponse, corsResponse, todayDate, nowTimestamp } from "../_shared/helpers.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse();

  try {
    const { employee_id } = await req.json();
    if (!employee_id) return errorResponse("employee_id is required");

    const supabase = createSupabaseAdmin();
    const today = todayDate();
    const now = nowTimestamp();

    const { data: log } = await supabase
      .from("attendance_logs")
      .select("id, break_start_time, break_minutes")
      .eq("employee_id", employee_id)
      .eq("date", today)
      .maybeSingle();

    if (!log) return errorResponse("Must punch in first", 400);
    if (!log.break_start_time) return errorResponse("Break not started", 400);

    // Calculate this break duration and add to cumulative
    const breakStart = new Date(log.break_start_time).getTime();
    const breakEnd = new Date(now).getTime();
    const thisBreakMinutes = Math.round((breakEnd - breakStart) / 60000);
    const totalBreakMinutes = (log.break_minutes ?? 0) + thisBreakMinutes;

    const { error } = await supabase
      .from("attendance_logs")
      .update({
        break_end_time: now,
        break_minutes: totalBreakMinutes,
      })
      .eq("id", log.id);

    if (error) return errorResponse(error.message, 500);

    return jsonResponse({
      success: true,
      attendance_id: log.id,
      break_duration_minutes: thisBreakMinutes,
      total_break_minutes: totalBreakMinutes,
      timestamp: now,
    });
  } catch (err) {
    return errorResponse(err.message, 500);
  }
});
