import { createSupabaseAdmin, jsonResponse, errorResponse, corsResponse, nowTimestamp, authenticateEmployee } from "../_shared/helpers.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse();
  try {
    const { employee_id, session_id } = await req.json();
    if (!employee_id || !session_id) return errorResponse("employee_id, session_id required");

    const supabase = createSupabaseAdmin();
    const auth = await authenticateEmployee(req, supabase, employee_id);
    if (auth.error) return auth.error;

    const now = nowTimestamp();

    const { data: session } = await supabase
      .from("project_work_sessions")
      .select("work_start_time, break_start_time, break_end_time, break_minutes, employee_id")
      .eq("id", session_id)
      .eq("employee_id", employee_id)
      .maybeSingle();
    if (!session) return errorResponse("Session not found", 404);
    if (!session.work_start_time) return errorResponse("Work was never started", 400);

    // Auto-close any open break
    let breakMinutes = session.break_minutes ?? 0;
    const updates: Record<string, unknown> = { work_end_time: now, status: "completed" };
    if (session.break_start_time && !session.break_end_time) {
      const add = Math.max(0, Math.round((new Date(now).getTime() - new Date(session.break_start_time).getTime()) / 60000));
      breakMinutes += add;
      updates.break_end_time = now;
      updates.break_minutes = breakMinutes;
    }

    // Total work minutes = end - start - breaks
    const grossMin = Math.round((new Date(now).getTime() - new Date(session.work_start_time).getTime()) / 60000);
    const totalWorkMinutes = Math.max(0, grossMin - breakMinutes);
    updates.total_work_minutes = totalWorkMinutes;

    // Cost calculation using employee rates
    const { data: emp } = await supabase
      .from("employees")
      .select("hourly_rate, overtime_rate, standard_hours_per_day")
      .eq("id", session.employee_id)
      .single();

    if (emp) {
      const hourly = Number(emp.hourly_rate ?? 0);
      const otRate = Number(emp.overtime_rate ?? hourly);
      const stdMin = Number(emp.standard_hours_per_day ?? 8) * 60;
      const regularMin = Math.min(totalWorkMinutes, stdMin);
      const overtimeMin = Math.max(0, totalWorkMinutes - stdMin);
      updates.regular_cost = Math.round(((regularMin / 60) * hourly) * 100) / 100;
      updates.overtime_cost = Math.round(((overtimeMin / 60) * otRate) * 100) / 100;
      updates.overtime_minutes = overtimeMin;
    }

    const { error } = await supabase
      .from("project_work_sessions")
      .update(updates)
      .eq("id", session_id);

    if (error) return errorResponse(error.message, 500);
    return jsonResponse({ success: true, timestamp: now, total_work_minutes: totalWorkMinutes });
  } catch (err) {
    return errorResponse((err as Error).message, 500);
  }
});
