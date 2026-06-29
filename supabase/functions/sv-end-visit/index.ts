import { createSupabaseAdmin, jsonResponse, errorResponse, corsResponse, resolveTimestamp, checkIdempotency, recordIdempotencyResult, authenticateEmployee } from "../_shared/helpers.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse();
  try {
    const { employee_id, session_id, client_timestamp, idempotency_key } = await req.json();
    if (!employee_id || !session_id) return errorResponse("employee_id, session_id required");

    const supabase = createSupabaseAdmin();
    const auth = await authenticateEmployee(req, supabase, employee_id);
    if (auth.error) return auth.error;

    const dup = await checkIdempotency(supabase, idempotency_key, employee_id, "sv-end-visit");
    if (dup) return dup;

    const { data: session } = await supabase
      .from("site_visit_work_sessions")
      .select("work_start_time, work_end_time, break_start_time, break_end_time, break_minutes, employee_id, total_work_minutes")
      .eq("id", session_id)
      .eq("employee_id", employee_id)
      .maybeSingle();
    if (!session) return errorResponse("Session not found", 404);
    if (session.work_end_time) {
      const out = { success: true, timestamp: session.work_end_time, total_work_minutes: session.total_work_minutes ?? 0, deduped: true };
      await recordIdempotencyResult(supabase, idempotency_key, out);
      return jsonResponse(out);
    }
    if (!session.work_start_time) return errorResponse("Survey was never started", 400);

    // Resolve effective end timestamp. Must not be before work_start; if a break
    // is still open, we DO NOT collapse the break to "now" — we close it at the
    // moment work_end is recorded but only count the elapsed break minutes.
    let now = resolveTimestamp(client_timestamp);
    if (new Date(now).getTime() < new Date(session.work_start_time).getTime()) {
      now = session.work_start_time;
    }

    let breakMinutes = session.break_minutes ?? 0;
    const updates: Record<string, unknown> = { work_end_time: now, status: "completed" };
    if (session.break_start_time && !session.break_end_time) {
      let breakEnd = now;
      if (new Date(breakEnd).getTime() < new Date(session.break_start_time).getTime()) {
        breakEnd = session.break_start_time;
      }
      const add = Math.max(0, Math.round((new Date(breakEnd).getTime() - new Date(session.break_start_time).getTime()) / 60000));
      breakMinutes += add;
      updates.break_end_time = breakEnd;
      updates.break_minutes = breakMinutes;
    }

    const grossMin = Math.max(0, Math.round((new Date(now).getTime() - new Date(session.work_start_time).getTime()) / 60000));
    const totalWorkMinutes = Math.max(0, grossMin - breakMinutes);
    updates.total_work_minutes = totalWorkMinutes;

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
      .from("site_visit_work_sessions")
      .update(updates)
      .eq("id", session_id);
    if (error) return errorResponse(error.message, 500);
    const out = { success: true, timestamp: now, total_work_minutes: totalWorkMinutes };
    await recordIdempotencyResult(supabase, idempotency_key, out);
    return jsonResponse(out);
  } catch (err) {
    return errorResponse((err as Error).message, 500);
  }
});
