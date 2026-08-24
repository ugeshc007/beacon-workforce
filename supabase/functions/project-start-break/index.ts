import { createSupabaseAdmin, jsonResponse, errorResponse, corsResponse, nowTimestamp, resolveTimestamp, authenticateEmployee, checkIdempotency, recordIdempotencyResult } from "../_shared/helpers.ts";

const MAX_BREAK_MINUTES = 60;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse();
  try {
    const { employee_id, session_id, client_timestamp, idempotency_key } = await req.json();
    if (!employee_id || !session_id) return errorResponse("employee_id, session_id required");

    const supabase = createSupabaseAdmin();
    const auth = await authenticateEmployee(req, supabase, employee_id);
    if (auth.error) return auth.error;

    const dup = await checkIdempotency(supabase, idempotency_key, employee_id, "project-start-break");
    if (dup) return dup;

    const { data: session } = await supabase
      .from("project_work_sessions")
      .select("id, work_start_time, work_end_time, break_start_time, break_end_time, break_minutes")
      .eq("id", session_id)
      .eq("employee_id", employee_id)
      .maybeSingle();
    if (!session) return errorResponse("Session not found", 404);
    if (session.work_end_time) return errorResponse("Session already ended", 400);
    // Never block: allow a break even if "Start Work" wasn't recorded — the
    // session's work start is back-filled when the break begins.
    const backfillWorkStart = !session.work_start_time;

    if (session.break_start_time && !session.break_end_time) {
      return jsonResponse({ success: true, timestamp: session.break_start_time, deduped: true });
    }
    // Multiple breaks are allowed per session, capped at MAX_BREAK_MINUTES total.
    if ((session.break_minutes ?? 0) >= MAX_BREAK_MINUTES) {
      return errorResponse(`Break limit of ${MAX_BREAK_MINUTES} minutes already used`, 400);
    }

    const now = resolveTimestamp(client_timestamp);
    const { error } = await supabase
      .from("project_work_sessions")
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
