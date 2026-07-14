import { createSupabaseAdmin, jsonResponse, errorResponse, corsResponse, resolveTimestamp, checkIdempotency, recordIdempotencyResult, authenticateEmployee } from "../_shared/helpers.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse();
  try {
    const { employee_id, session_id, client_timestamp, idempotency_key } = await req.json();
    if (!employee_id || !session_id) return errorResponse("employee_id, session_id required");

    const supabase = createSupabaseAdmin();
    const auth = await authenticateEmployee(req, supabase, employee_id);
    if (auth.error) return auth.error;

    const dup = await checkIdempotency(supabase, idempotency_key, employee_id, "sv-start-break");
    if (dup) return dup;

    const { data: session } = await supabase
      .from("site_visit_work_sessions")
      .select("id, work_start_time, work_end_time, break_start_time, break_end_time")
      .eq("id", session_id)
      .eq("employee_id", employee_id)
      .maybeSingle();
    if (!session) return errorResponse("Session not found", 404);
    if (session.work_end_time) return errorResponse("Visit already ended", 400);
    if (!session.work_start_time) return errorResponse("Must start work before taking a break", 400);
    if (session.break_start_time && !session.break_end_time) {
      const out = { success: true, timestamp: session.break_start_time, deduped: true };
      await recordIdempotencyResult(supabase, idempotency_key, out);
      return jsonResponse(out);
    }

    let now = resolveTimestamp(client_timestamp);
    if (new Date(now).getTime() < new Date(session.work_start_time).getTime()) {
      now = session.work_start_time;
    }
    const { error } = await supabase
      .from("site_visit_work_sessions")
      .update({ break_start_time: now, break_end_time: null })
      .eq("id", session_id)
      .eq("employee_id", employee_id);
    if (error) return errorResponse(error.message, 500);
    const out = { success: true, timestamp: now };
    await recordIdempotencyResult(supabase, idempotency_key, out);
    return jsonResponse(out);
  } catch (err) {
    return errorResponse((err as Error).message, 500);
  }
});
