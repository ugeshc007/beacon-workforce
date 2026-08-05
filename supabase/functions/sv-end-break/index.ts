import { createSupabaseAdmin, jsonResponse, errorResponse, corsResponse, resolveTimestamp, checkIdempotency, recordIdempotencyResult, authenticateEmployee } from "../_shared/helpers.ts";

const MAX_BREAK_MINUTES = 60;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse();
  try {
    const { employee_id, session_id, client_timestamp, idempotency_key } = await req.json();
    if (!employee_id || !session_id) return errorResponse("employee_id, session_id required");

    const supabase = createSupabaseAdmin();
    const auth = await authenticateEmployee(req, supabase, employee_id);
    if (auth.error) return auth.error;

    const dup = await checkIdempotency(supabase, idempotency_key, employee_id, "sv-end-break");
    if (dup) return dup;

    const { data: session } = await supabase
      .from("site_visit_work_sessions")
      .select("break_start_time, break_end_time, break_minutes, work_end_time")
      .eq("id", session_id)
      .eq("employee_id", employee_id)
      .maybeSingle();
    if (!session) return errorResponse("Session not found", 404);
    if (session.work_end_time) return errorResponse("Visit already ended", 400);
    if (!session.break_start_time) return errorResponse("Break was never started", 400);
    if (session.break_end_time) {
      const out = { success: true, timestamp: session.break_end_time, deduped: true };
      await recordIdempotencyResult(supabase, idempotency_key, out);
      return jsonResponse(out);
    }

    // Use client timestamp (offline-safe), but never before the break started.
    let now = resolveTimestamp(client_timestamp);
    if (new Date(now).getTime() < new Date(session.break_start_time).getTime()) {
      now = session.break_start_time;
    }
    const addBreak = Math.max(0, Math.round((new Date(now).getTime() - new Date(session.break_start_time).getTime()) / 60000));
    const { error } = await supabase
      .from("site_visit_work_sessions")
      .update({ break_end_time: now, break_minutes: Math.min(MAX_BREAK_MINUTES, (session.break_minutes ?? 0) + addBreak) })
      .eq("id", session_id);
    if (error) return errorResponse(error.message, 500);
    const out = { success: true, timestamp: now, added_break_minutes: addBreak };
    await recordIdempotencyResult(supabase, idempotency_key, out);
    return jsonResponse(out);
  } catch (err) {
    return errorResponse((err as Error).message, 500);
  }
});
