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
      .select("id, work_start_time, break_minutes, project_id")
      .eq("employee_id", employee_id)
      .eq("date", today)
      .maybeSingle();

    if (!log) return errorResponse("Must punch in first", 400);
    if (!log.work_start_time) return errorResponse("Work not started", 400);

    // Get employee rates
    const { data: emp } = await supabase
      .from("employees")
      .select("hourly_rate, overtime_rate, standard_hours_per_day")
      .eq("id", employee_id)
      .single();

    if (!emp) return errorResponse("Employee not found", 404);

    const workStart = new Date(log.work_start_time).getTime();
    const workEnd = new Date(now).getTime();
    const totalWorkMinutes = Math.round((workEnd - workStart) / 60000) - (log.break_minutes ?? 0);
    const standardMinutes = Number(emp.standard_hours_per_day) * 60;
    const overtimeMinutes = Math.max(0, totalWorkMinutes - standardMinutes);
    const regularHours = Math.min(totalWorkMinutes / 60, Number(emp.standard_hours_per_day));
    const regularCost = Math.round(regularHours * Number(emp.hourly_rate) * 100) / 100;
    const overtimeCost = Math.round((overtimeMinutes / 60) * Number(emp.overtime_rate) * 100) / 100;

    const { error } = await supabase
      .from("attendance_logs")
      .update({
        work_end_time: now,
        total_work_minutes: totalWorkMinutes,
        overtime_minutes: overtimeMinutes,
        regular_cost: regularCost,
        overtime_cost: overtimeCost,
      })
      .eq("id", log.id);

    if (error) return errorResponse(error.message, 500);

    return jsonResponse({
      success: true,
      attendance_id: log.id,
      total_work_minutes: totalWorkMinutes,
      overtime_minutes: overtimeMinutes,
      regular_cost: regularCost,
      overtime_cost: overtimeCost,
      timestamp: now,
    });
  } catch (err) {
    return errorResponse(err.message, 500);
  }
});
